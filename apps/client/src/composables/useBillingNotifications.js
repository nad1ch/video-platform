import { computed, ref } from 'vue';
import { fetchJarPaymentRequest, } from '@/services/billingApi';
import { refreshSubscription as refreshProSubscription, subscriptionState as subscriptionRef, } from '@/composables/useProSubscription';
import { createLogger } from '@/utils/logger';
/**
 * Global, singleton-ish billing notifications.
 *
 * Surfaces ephemeral toasts on whichever page the user is currently on when:
 *   - Their pending payment request transitions to a terminal status
 *     (`auto_matched` / `approved` / `needs_review` / `rejected` / `expired`).
 *   - Their subscription transitions inactive ↔ active (covers admin cancel,
 *     natural expiry, and post-modal-close activation).
 *
 * Key safety properties:
 *   - Backend stays the source of truth — toasts are read-only signals.
 *   - Safe 20 s interval polling (no WebSocket/SSE).
 *   - Visibility-aware: skips while `document.hidden`, immediate catch-up on
 *     focus.
 *   - Baseline-on-first-tick: no toast fires on initial page load even if
 *     subscription is already active (prevents reload-spam).
 *   - De-duplicated via `seenEventKeys` so the in-modal poll and the global
 *     tick can both call `notifyTerminalRequestStatus(...)` without producing
 *     a duplicate toast.
 *   - Auth-gated by the caller (`BillingToastSurface.vue`) — polling stops
 *     on logout and never runs on landing/auth pages.
 */
const log = createLogger('billing-notify');
const TOAST_TTL_MS = 8000;
const toasts = ref([]);
let nextToastId = 1;
function pushToast(input) {
    const id = nextToastId++;
    toasts.value = [...toasts.value, { id, ...input }];
    if (typeof window !== 'undefined') {
        window.setTimeout(() => dismissToast(id), TOAST_TTL_MS);
    }
}
export function dismissToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
}
const PENDING_KEY = 'streamassist_billing_pending_request_v1';
export function writePendingPaymentRequestId(id) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        if (id && id.length > 0) {
            localStorage.setItem(PENDING_KEY, id);
        }
        else {
            localStorage.removeItem(PENDING_KEY);
        }
    }
    catch {
        /* ignore quota/private-mode */
    }
}
export function readPendingPaymentRequestId() {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const v = localStorage.getItem(PENDING_KEY);
        return v && v.length > 0 ? v : null;
    }
    catch {
        return null;
    }
}
/**
 * In-memory cache of (event-key) we have already shown a toast for. Cleared
 * on logout (`resetBillingNotifierState`). Survives page navigation within
 * the same SPA session — exactly what we want.
 */
const seenEventKeys = new Set();
function fmtDate(iso) {
    if (!iso)
        return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
}
function emitTerminalRequestToast(paymentRequestId, status) {
    const key = `req:${paymentRequestId}:${status}`;
    if (seenEventKeys.has(key))
        return false;
    seenEventKeys.add(key);
    if (status === 'auto_matched') {
        pushToast({
            kind: 'success',
            title: 'StreamAssist Pro активовано',
            message: 'Ваш платіж підтверджено автоматично.',
        });
        return true;
    }
    if (status === 'approved') {
        pushToast({
            kind: 'success',
            title: 'StreamAssist Pro активовано',
            message: 'Адміністратор підтвердив ваш платіж.',
        });
        return true;
    }
    if (status === 'rejected') {
        pushToast({
            kind: 'error',
            title: 'Платіж відхилено',
            message: 'Адміністратор не зміг підтвердити цей платіж. Якщо це помилка — зверніться у підтримку.',
        });
        return true;
    }
    if (status === 'needs_review') {
        pushToast({
            kind: 'info',
            title: 'Платіж на ручній перевірці',
            message: 'Адміністратор перевіряє ваш платіж. Ми надішлемо лист, коли підтвердимо активацію.',
        });
        return true;
    }
    if (status === 'expired') {
        pushToast({
            kind: 'warning',
            title: 'Час на оплату вийшов',
            message: 'Створіть новий запит на оплату, щоб продовжити.',
        });
        return true;
    }
    return false;
}
function emitSubscriptionTransitionToast(prev, next) {
    if (prev.isActive && !next.isActive) {
        if (next.status === 'inactive') {
            const key = `sub:cancelled:${next.expiresAt ?? ''}`;
            if (seenEventKeys.has(key))
                return;
            seenEventKeys.add(key);
            pushToast({
                kind: 'warning',
                title: 'Pro доступ скасовано',
                message: 'Адміністратор скасував вашу підписку. Якщо це помилка — зверніться у підтримку.',
            });
            return;
        }
        const expKey = `sub:expired:${next.expiresAt ?? ''}`;
        if (seenEventKeys.has(expKey))
            return;
        seenEventKeys.add(expKey);
        pushToast({
            kind: 'info',
            title: 'Pro період закінчився',
            message: 'Поновіть Pro у розділі білінгу.',
        });
        return;
    }
    if (!prev.isActive && next.isActive) {
        const key = `sub:active:${next.expiresAt ?? ''}`;
        if (seenEventKeys.has(key))
            return;
        seenEventKeys.add(key);
        const expires = fmtDate(next.expiresAt);
        pushToast({
            kind: 'success',
            title: 'StreamAssist Pro активовано',
            message: expires ? `Доступ діє до ${expires}.` : null,
        });
    }
}
/**
 * Public helper: callers (the modal's local poll, the global notifier tick,
 * future admin tooling) all funnel terminal-status events through here so a
 * single toast fires per (paymentRequestId, status) within the SPA session.
 *
 * Also clears the persisted pending id so the global poller stops querying
 * the request endpoint after the terminal transition.
 */
export function notifyTerminalRequestStatus(paymentRequestId, status) {
    emitTerminalRequestToast(paymentRequestId, status);
    if (readPendingPaymentRequestId() === paymentRequestId) {
        writePendingPaymentRequestId(null);
    }
}
/* Polling lifecycle                                                          */
const POLL_INTERVAL_MS = 20_000;
let prevSubscription = null;
let pollTimer = null;
let starts = 0;
let visibilityListenerInstalled = false;
let inflightTick = null;
function isHidden() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
async function tick() {
    if (isHidden())
        return;
    if (inflightTick)
        return inflightTick;
    inflightTick = (async () => {
        const pendingId = readPendingPaymentRequestId();
        let pendingResolvedThisTick = false;
        if (pendingId) {
            try {
                const r = await fetchJarPaymentRequest(pendingId);
                if (r.ok) {
                    const status = r.data.status;
                    const isTerminal = status === 'auto_matched' ||
                        status === 'approved' ||
                        status === 'needs_review' ||
                        status === 'rejected' ||
                        status === 'expired';
                    if (isTerminal) {
                        const shown = emitTerminalRequestToast(pendingId, status);
                        writePendingPaymentRequestId(null);
                        pendingResolvedThisTick = shown && (status === 'auto_matched' || status === 'approved');
                    }
                }
                else if (r.status === 404) {
                    writePendingPaymentRequestId(null);
                }
            }
            catch (err) {
                log.warn('payment-request poll failed', err);
            }
        }
        // badge (and any other consumer of `useProSubscription()`) stays fresh
        try {
            await refreshProSubscription();
            const next = subscriptionRef.value;
            if (next) {
                if (prevSubscription && !pendingResolvedThisTick) {
                    emitSubscriptionTransitionToast(prevSubscription, next);
                }
                prevSubscription = next;
            }
        }
        catch (err) {
            log.warn('subscription poll failed', err);
        }
    })().finally(() => {
        inflightTick = null;
    });
    return inflightTick;
}
/**
 * While the tab is hidden the interval is fully cleared (not just early-returned)
 * so the JS loop is not woken every 20 s on a backgrounded tab. On visible we
 * issue an immediate catch-up tick and resume the interval.
 */
function onVisibilityChange() {
    if (typeof document === 'undefined')
        return;
    if (document.visibilityState === 'visible') {
        if (starts > 0 && pollTimer === null) {
            pollTimer = setInterval(() => {
                void tick();
            }, POLL_INTERVAL_MS);
        }
        void tick();
    }
    else if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}
/**
 * Reset the in-memory baseline + dedupe cache. Called by the toast surface
 * when the user logs out, so a new sign-in does not compare against the
 * previous user's state and does not skip toasts because of stale `seen`
 * keys.
 */
export function resetBillingNotifierState() {
    prevSubscription = null;
    seenEventKeys.clear();
}
/**
 * Start the global poller. Reference-counted so multiple components mounting
 * (or HMR re-runs) do not multiply intervals. Caller should also `stop` on
 * unmount.
 */
export function startBillingNotifier() {
    starts++;
    if (typeof document !== 'undefined' && !visibilityListenerInstalled) {
        document.addEventListener('visibilitychange', onVisibilityChange);
        visibilityListenerInstalled = true;
    }
    if (pollTimer)
        return;
    if (!isHidden()) {
        void tick();
        pollTimer = setInterval(() => {
            void tick();
        }, POLL_INTERVAL_MS);
    }
}
export function stopBillingNotifier() {
    starts = Math.max(0, starts - 1);
    if (starts > 0)
        return;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (visibilityListenerInstalled && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        visibilityListenerInstalled = false;
    }
}
export function useBillingNotifications() {
    return {
        toasts: computed(() => toasts.value),
        dismissToast,
    };
}
