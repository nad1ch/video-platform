/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { approveAdminPaymentRequest, cancelAdminSubscription, fetchAdminBillingList, fetchAdminSubscriptions, forceAdminMonoPoll, rejectAdminPaymentRequest, } from '@/services/billingApi';
import { appConfirm } from '@/utils/appConfirm';
/**
 * Admin billing review queue.
 *
 * Lists every PaymentRequest in non-terminal state (waiting_payment, checking,
 * needs_review) plus recently observed unmatched transactions. Approving sets
 * the request to `approved` and activates Pro for the user; rejecting sets it
 * to `rejected`. Both endpoints are idempotent on the server.
 *
 * Per-row mutation is single-flight: while a row's approve/reject is in
 * flight, both buttons on that row are disabled. Refresh of the whole queue
 * happens after any mutation completes.
 *
 * Auto-refresh: the queue polls every `AUTO_REFRESH_MS` (≈6s) so freshly
 * marked-paid requests appear without a page reload. The poll is paused
 * while any approve/reject is in flight (avoids a race that could overwrite
 * the per-row "Pro активовано…" message), while the document is hidden
 * (battery / data), and while the manual "Оновити" call is in flight. List
 * is only replaced on a successful response — transient failures keep the
 * previous snapshot visible so the operator never stares at a blank page.
 */
const AUTO_REFRESH_MS = 6000;
const data = ref(null);
const subscriptionsData = ref(null);
const loading = ref(false);
const lastError = ref(null);
const lastFetchedAt = ref(null);
const noteDraft = ref({});
const pending = ref({});
const rowMessage = ref({});
const pendingSubCancel = ref({});
const subRowMessage = ref({});
const pollMonoPending = ref(false);
const pollMonoMessage = ref(null);
const totalRequests = computed(() => data.value?.requests.length ?? 0);
const totalSubscriptions = computed(() => subscriptionsData.value?.subscriptions.length ?? 0);
const activeSubscriptions = computed(() => subscriptionsData.value?.subscriptions.filter((s) => s.isActive) ?? []);
const inactiveSubscriptions = computed(() => subscriptionsData.value?.subscriptions.filter((s) => !s.isActive) ?? []);
const hasPendingMutation = computed(() => Object.keys(pending.value).length > 0 ||
    Object.keys(pendingSubCancel.value).length > 0 ||
    pollMonoPending.value);
let inflightLoad = null;
let autoRefreshTimer = null;
let unmounted = false;
/**
 * Single-flight parallel loader for both the payment-request queue and the
 * subscriptions list. Only the first concurrent caller actually fetches —
 * subsequent callers (manual + auto-refresh tick + post-mutation refresh)
 * piggy-back on the in-flight promise. Crucially, we DO NOT clear `data` /
 * `subscriptionsData` on load: a transient failure keeps the previous
 * snapshot visible (no flicker, no blank queue).
 */
async function load() {
    if (inflightLoad)
        return inflightLoad;
    loading.value = true;
    inflightLoad = (async () => {
        try {
            const [reqRes, subRes] = await Promise.all([
                fetchAdminBillingList(),
                fetchAdminSubscriptions(),
            ]);
            if (unmounted)
                return;
            let nextError = null;
            if (reqRes.ok) {
                data.value = reqRes.data;
            }
            else {
                nextError = `${reqRes.code}: ${reqRes.message}`;
            }
            if (subRes.ok) {
                subscriptionsData.value = subRes.data;
            }
            else if (!nextError) {
                nextError = `${subRes.code}: ${subRes.message}`;
            }
            if (reqRes.ok || subRes.ok) {
                lastFetchedAt.value = new Date().toISOString();
            }
            lastError.value = nextError;
        }
        finally {
            loading.value = false;
            inflightLoad = null;
        }
    })();
    return inflightLoad;
}
function shouldSkipAutoRefresh() {
    if (unmounted)
        return true;
    if (inflightLoad)
        return true;
    if (hasPendingMutation.value)
        return true;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden')
        return true;
    return false;
}
async function autoRefreshTick() {
    if (shouldSkipAutoRefresh())
        return;
    await load();
}
function startAutoRefresh() {
    if (autoRefreshTimer)
        return;
    autoRefreshTimer = setInterval(() => {
        void autoRefreshTick();
    }, AUTO_REFRESH_MS);
}
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}
function onVisibilityChange() {
    if (typeof document === 'undefined')
        return;
    if (document.visibilityState === 'visible') {
        void autoRefreshTick();
    }
}
async function approve(row) {
    if (pending.value[row.id])
        return;
    pending.value = { ...pending.value, [row.id]: 'approve' };
    rowMessage.value = { ...rowMessage.value, [row.id]: null };
    try {
        const r = await approveAdminPaymentRequest(row.id, noteDraft.value[row.id] ?? null);
        if (!r.ok) {
            rowMessage.value = {
                ...rowMessage.value,
                [row.id]: `Помилка: ${r.code} — ${r.message}`,
            };
            return;
        }
        rowMessage.value = {
            ...rowMessage.value,
            [row.id]: r.data.activated
                ? 'Pro активовано та запит відмічено як approved.'
                : `Без змін: статус — ${r.data.status}.`,
        };
        await load();
    }
    finally {
        const next = { ...pending.value };
        delete next[row.id];
        pending.value = next;
    }
}
async function reject(row) {
    if (pending.value[row.id])
        return;
    pending.value = { ...pending.value, [row.id]: 'reject' };
    rowMessage.value = { ...rowMessage.value, [row.id]: null };
    try {
        const r = await rejectAdminPaymentRequest(row.id, noteDraft.value[row.id] ?? null);
        if (!r.ok) {
            rowMessage.value = {
                ...rowMessage.value,
                [row.id]: `Помилка: ${r.code} — ${r.message}`,
            };
            return;
        }
        rowMessage.value = {
            ...rowMessage.value,
            [row.id]: r.data.rejected
                ? 'Запит відхилено.'
                : `Без змін: статус — ${r.data.status}.`,
        };
        await load();
    }
    finally {
        const next = { ...pending.value };
        delete next[row.id];
        pending.value = next;
    }
}
function isPending(row) {
    return Boolean(pending.value[row.id]);
}
function isSubPending(row) {
    return Boolean(pendingSubCancel.value[row.id]);
}
/**
 * Admin: force-poll the monobank Personal API once, bypassing the in-process
 * 60s cool-down. Useful when a `checking` request is stuck because:
 *   - we just changed `MONO_ACCOUNT_ID` and want to verify it works;
 *   - the user just paid and wants to re-attempt without waiting.
 *
 * Surfaces a structured outcome:
 *   - "Отримано N транзакцій" — if any of them match a pending request, the
 *     queue auto-refresh (Promise.all) reflects it on the next tick.
 *   - "Mono API не налаштовано" — MONO_PERSONAL_TOKEN/ACCOUNT_ID missing.
 *   - "Mono обмежив запити" — server-side 429 (the in-process cool-down was
 *     bypassed but monobank still throttled us).
 *   - "Помилка mono: …" — network/auth/etc.
 */
async function onPollMonoNow() {
    if (pollMonoPending.value)
        return;
    pollMonoPending.value = true;
    pollMonoMessage.value = null;
    try {
        const r = await forceAdminMonoPoll();
        if (!r.ok) {
            pollMonoMessage.value = { kind: 'err', text: `${r.code}: ${r.message}` };
            return;
        }
        if (r.data.ok) {
            pollMonoMessage.value = {
                kind: 'ok',
                text: `Отримано ${r.data.itemCount} транзакцій з рахунку ${r.data.accountId}.`,
            };
        }
        else if (r.data.reason === 'not_configured') {
            pollMonoMessage.value = {
                kind: 'warn',
                text: 'Mono API не налаштовано (MONO_PERSONAL_TOKEN або MONO_ACCOUNT_ID відсутні).',
            };
        }
        else if (r.data.reason === 'rate_limited') {
            pollMonoMessage.value = {
                kind: 'warn',
                text: 'Monobank обмежив запити (429). Зачекайте хвилину й повторіть.',
            };
        }
        else {
            pollMonoMessage.value = {
                kind: 'err',
                text: `Помилка mono: ${r.data.message ?? 'невідома'}.`,
            };
        }
        await load();
    }
    finally {
        pollMonoPending.value = false;
    }
}
/**
 * Admin: deactivate an active Pro subscription. Idempotent on the server —
 * if the row is already inactive/expired, the response carries
 * `cancelledNow: false` and we surface that without re-confirming.
 *
 * The `appConfirm` step is the existing project pattern (see AdminUsers.vue).
 * Per-subscription `pendingSubCancel` map blocks double-submits at the FE
 * AND pauses the auto-refresh tick (via `hasPendingMutation`) so a refresh
 * cannot overwrite the row's "Підписку скасовано" message mid-flight.
 */
async function onCancelSubscription(row) {
    if (pendingSubCancel.value[row.id])
        return;
    const confirmed = appConfirm(`Скасувати Pro для ${row.userDisplayName || row.userEmail || row.userId}? ` +
        'Доступ буде відключено негайно. Платіжна історія залишається без змін.');
    if (!confirmed)
        return;
    pendingSubCancel.value = { ...pendingSubCancel.value, [row.id]: true };
    subRowMessage.value = { ...subRowMessage.value, [row.id]: null };
    try {
        const r = await cancelAdminSubscription(row.id);
        if (!r.ok) {
            subRowMessage.value = {
                ...subRowMessage.value,
                [row.id]: `Помилка: ${r.code} — ${r.message}`,
            };
            return;
        }
        subRowMessage.value = {
            ...subRowMessage.value,
            [row.id]: r.data.cancelledNow
                ? 'Підписку скасовано. Доступ Pro відключено.'
                : `Без змін: статус — ${r.data.subscription.status}.`,
        };
        await load();
    }
    finally {
        const next = { ...pendingSubCancel.value };
        delete next[row.id];
        pendingSubCancel.value = next;
    }
}
function fmtIso(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
function statusBadgeClasses(status) {
    if (status === 'needs_review') {
        return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40';
    }
    if (status === 'checking') {
        return 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40';
    }
    if (status === 'auto_matched' || status === 'approved') {
        return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40';
    }
    if (status === 'rejected' || status === 'expired') {
        return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40';
    }
    return 'bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/40';
}
function subBadgeClasses(row) {
    if (row.isActive) {
        return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40';
    }
    if (row.status === 'inactive') {
        return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40';
    }
    return 'bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/40';
}
function transactionLine(t) {
    return `${t.amountUah} ${t.currency} · ${fmtIso(t.operationTime)} · ${t.description ?? '—'}`;
}
onMounted(() => {
    void load();
    startAutoRefresh();
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
    }
});
onBeforeUnmount(() => {
    unmounted = true;
    stopAutoRefresh();
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full min-w-0 space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex shrink-0 flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.onPollMonoNow) },
    type: "button",
    ...{ class: "rounded-lg bg-amber-900/80 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-700/50 hover:bg-amber-800/80 disabled:opacity-50" },
    disabled: (__VLS_ctx.pollMonoPending),
    title: ('Bypass the 60s mono rate-limit and run one fetch+match. Useful when a payment ' +
        'is stuck in checking (likely MONO_ACCOUNT_ID misconfigured or rate-limited).'),
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-900/80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-100']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-amber-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-amber-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
(__VLS_ctx.pollMonoPending ? 'Опитуємо mono…' : 'Перевірити mono зараз');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.load) },
    type: "button",
    ...{ class: "rounded-lg bg-cyan-950/80 px-3 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-700/50 hover:bg-cyan-900/80 disabled:opacity-50" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-cyan-950/80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-cyan-100']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-cyan-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-cyan-900/80']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
(__VLS_ctx.loading ? 'Оновлення…' : 'Оновити');
if (__VLS_ctx.pollMonoMessage) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs" },
        ...{ class: (__VLS_ctx.pollMonoMessage.kind === 'ok'
                ? 'text-emerald-200'
                : __VLS_ctx.pollMonoMessage.kind === 'warn'
                    ? 'text-amber-200'
                    : 'text-rose-300') },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.pollMonoMessage.text);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-xl border border-amber-700/40 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-100/90" },
});
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-700/40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-950/30']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-100/90']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
    ...{ class: "text-amber-200" },
});
/** @type {__VLS_StyleScopedClasses['text-amber-200']} */ ;
if (__VLS_ctx.lastError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-rose-700/40 bg-rose-950/40 p-3 text-xs text-rose-200" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-rose-700/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-rose-950/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-200']} */ ;
    (__VLS_ctx.lastError);
}
if (__VLS_ctx.lastFetchedAt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-[11px] text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.fmtIso(__VLS_ctx.lastFetchedAt));
    (__VLS_ctx.totalRequests);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-sm font-semibold uppercase tracking-wide text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
if (!__VLS_ctx.data && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
}
else if (__VLS_ctx.data && __VLS_ctx.data.requests.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
}
for (const [row] of __VLS_vFor((__VLS_ctx.data?.requests ?? []))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        key: (row.id),
        ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.03]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-start justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "break-all font-mono text-xs text-slate-100" },
    });
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    (row.id);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.userId);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.userEmail ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.userDisplayName || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase" },
        ...{ class: (__VLS_ctx.statusBadgeClasses(row.status)) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    (row.status);
    __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
        ...{ class: "mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.amountUah);
    (row.currency);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (__VLS_ctx.fmtIso(row.createdAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (__VLS_ctx.fmtIso(row.markedPaidAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (__VLS_ctx.fmtIso(row.expiresAt));
    if (row.adminNote) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sm:col-span-2 md:col-span-3" },
        });
        /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:col-span-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (row.adminNote);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "mt-4 rounded-lg border border-slate-800/70 bg-slate-950/40 p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-[11px] font-semibold uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    if (row.matchedTransaction) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (row.matchedTransaction.monoTransactionId);
        (row.matchedTransaction.amountUah);
        (row.matchedTransaction.currency);
        (__VLS_ctx.fmtIso(row.matchedTransaction.operationTime));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    if (row.candidateTransactions.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "mt-1 space-y-1 text-xs text-slate-300" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
        for (const [t] of __VLS_vFor((row.candidateTransactions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (t.id),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.transactionLine(t));
            // @ts-ignore
            [onPollMonoNow, pollMonoPending, pollMonoPending, load, loading, loading, loading, pollMonoMessage, pollMonoMessage, pollMonoMessage, pollMonoMessage, lastError, lastError, lastFetchedAt, lastFetchedAt, fmtIso, fmtIso, fmtIso, fmtIso, fmtIso, totalRequests, data, data, data, data, statusBadgeClasses, transactionLine,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "mt-4 block text-xs text-slate-300" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_ctx.noteDraft[row.id]),
        ...{ class: "mt-1 block w-full rounded-md border border-slate-700/70 bg-slate-950/70 p-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none" },
        rows: "2",
        maxlength: "500",
        placeholder: "Коментар, що буде збережено разом із запитом.",
        disabled: (__VLS_ctx.isPending(row)),
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['placeholder:text-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus:border-cyan-400/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.approve(row);
                // @ts-ignore
                [noteDraft, isPending, approve,];
            } },
        type: "button",
        ...{ class: "rounded-lg bg-emerald-700/80 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/50 hover:bg-emerald-600/80 disabled:opacity-50" },
        disabled: (__VLS_ctx.isPending(row)),
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-emerald-700/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-emerald-500/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-emerald-600/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.pending[row.id] === 'approve' ? 'Підтверджуємо…' : 'Підтвердити (Approve)');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.reject(row);
                // @ts-ignore
                [isPending, pending, reject,];
            } },
        type: "button",
        ...{ class: "rounded-lg bg-rose-800/80 px-3 py-2 text-xs font-semibold text-rose-50 ring-1 ring-rose-500/50 hover:bg-rose-700/80 disabled:opacity-50" },
        disabled: (__VLS_ctx.isPending(row)),
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-rose-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-rose-500/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-rose-700/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.pending[row.id] === 'reject' ? 'Відхиляємо…' : 'Відхилити (Reject)');
    if (__VLS_ctx.rowMessage[row.id]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs" },
            ...{ class: (__VLS_ctx.rowMessage[row.id]?.startsWith('Помилка') ? 'text-rose-300' : 'text-emerald-200') },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.rowMessage[row.id]);
    }
    // @ts-ignore
    [isPending, pending, rowMessage, rowMessage, rowMessage,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-3" },
});
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-sm font-semibold uppercase tracking-wide text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
if (__VLS_ctx.totalSubscriptions > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-2 text-[11px] text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.activeSubscriptions.length);
    (__VLS_ctx.totalSubscriptions);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "rounded-lg border border-amber-700/30 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/80" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-700/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-950/20']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-100/80']} */ ;
if (!__VLS_ctx.subscriptionsData && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
}
else if (__VLS_ctx.subscriptionsData && __VLS_ctx.totalSubscriptions === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
}
for (const [row] of __VLS_vFor((__VLS_ctx.activeSubscriptions))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        key: (row.id),
        ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.03]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-start justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "break-all font-mono text-xs text-slate-100" },
    });
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    (row.id);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.userId);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.userEmail ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.userDisplayName || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase" },
        ...{ class: (__VLS_ctx.subBadgeClasses(row)) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    (row.isActive ? 'active' : row.status);
    __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
        ...{ class: "mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (row.plan);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (__VLS_ctx.fmtIso(row.expiresAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
        ...{ class: "uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
        ...{ class: "text-slate-200" },
    });
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    (__VLS_ctx.fmtIso(row.startsAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onCancelSubscription(row);
                // @ts-ignore
                [loading, fmtIso, fmtIso, totalSubscriptions, totalSubscriptions, totalSubscriptions, activeSubscriptions, activeSubscriptions, subscriptionsData, subscriptionsData, subBadgeClasses, onCancelSubscription,];
            } },
        type: "button",
        ...{ class: "rounded-lg bg-rose-800/80 px-3 py-2 text-xs font-semibold text-rose-50 ring-1 ring-rose-500/50 hover:bg-rose-700/80 disabled:opacity-50" },
        disabled: (__VLS_ctx.isSubPending(row)),
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-rose-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-rose-500/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-rose-700/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.isSubPending(row) ? 'Скасовуємо…' : 'Скасувати Pro');
    if (__VLS_ctx.subRowMessage[row.id]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs" },
            ...{ class: (__VLS_ctx.subRowMessage[row.id]?.startsWith('Помилка')
                    ? 'text-rose-300'
                    : 'text-emerald-200') },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.subRowMessage[row.id]);
    }
    // @ts-ignore
    [isSubPending, isSubPending, subRowMessage, subRowMessage, subRowMessage,];
}
if (__VLS_ctx.inactiveSubscriptions.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "rounded-xl border border-slate-800/70 bg-slate-950/30" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-950/30']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer px-3 py-2 text-xs uppercase tracking-wide text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.inactiveSubscriptions.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "w-full text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
        ...{ class: "bg-slate-900/60 text-left text-[11px] uppercase tracking-wide text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({
        ...{ class: "divide-y divide-slate-800/60" },
    });
    /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
    /** @type {__VLS_StyleScopedClasses['divide-slate-800/60']} */ ;
    for (const [row] of __VLS_vFor((__VLS_ctx.inactiveSubscriptions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (row.id),
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        (row.userDisplayName || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block text-[11px] text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (row.userEmail ?? '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase" },
            ...{ class: (__VLS_ctx.subBadgeClasses(row)) },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        (row.status);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        (row.plan);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        (__VLS_ctx.fmtIso(row.expiresAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        (__VLS_ctx.fmtIso(row.updatedAt));
        // @ts-ignore
        [fmtIso, fmtIso, subBadgeClasses, inactiveSubscriptions, inactiveSubscriptions, inactiveSubscriptions,];
    }
}
if (__VLS_ctx.data && __VLS_ctx.data.unmatchedTransactions.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-sm font-semibold uppercase tracking-wide text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 ring-1 ring-white/[0.03]" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "w-full text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
        ...{ class: "bg-slate-900/70 text-left text-[11px] uppercase tracking-wide text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-slate-900/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({
        ...{ class: "divide-y divide-slate-800/60" },
    });
    /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
    /** @type {__VLS_StyleScopedClasses['divide-slate-800/60']} */ ;
    for (const [t] of __VLS_vFor((__VLS_ctx.data.unmatchedTransactions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (t.id),
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2 font-mono break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (t.monoTransactionId);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2 tabular-nums" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        (t.amountUah);
        (t.currency);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        (t.direction);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        (__VLS_ctx.fmtIso(t.operationTime));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "px-3 py-2 text-slate-300" },
        });
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
        (t.description ?? '—');
        // @ts-ignore
        [fmtIso, data, data, data,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
