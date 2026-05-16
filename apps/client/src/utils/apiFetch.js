import { apiUrl } from '@/utils/apiUrl';
import { trackClientError } from '@/utils/clientAnalytics';
function shouldTrackApiError(path) {
    return !path.startsWith('/api/events/');
}
/**
 * Same-origin API `fetch` with `credentials: 'include'` (session cookie).
 * Pass `path` as for `apiUrl` (e.g. `/api/auth/me`). Optional `init` overrides/extends defaults.
 *
 * Always sends `X-Requested-With: streamassist-fetch` so the server-side CSRF
 * guard accepts the request even when the browser elides the Origin header
 * (happens on some same-site navigations / non-CORS flows). Cross-origin
 * attackers cannot set this header without triggering a preflight, which the
 * CORS middleware 403s for non-allow-listed origins.
 */
const CSRF_HEADER_NAME = 'X-Requested-With';
const CSRF_HEADER_VALUE = 'streamassist-fetch';
/**
 * Default network-level timeout for every `apiFetch` request. Keeps a slow
 * upstream from pinning the UI (e.g. a stalled `/api/auth/me` or
 * `/api/billing/subscription/me` previously stretched into 20-40s waits
 * and blocked initial paint).
 *
 * Callers that genuinely need a longer ceiling can override via
 * `apiFetch(path, { timeoutMs: … })`; pass `0` or a negative number to
 * opt out entirely. A caller-supplied `init.signal` still wins for early
 * cancellation — both signals can abort the same request.
 */
const DEFAULT_API_TIMEOUT_MS = 12_000;
function withCsrfHeader(init) {
    const next = { credentials: 'include', ...(init ?? {}) };
    const headers = new Headers(next.headers ?? undefined);
    if (!headers.has(CSRF_HEADER_NAME)) {
        headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
    }
    next.headers = headers;
    return next;
}
/**
 * Compose an internal timeout `AbortController` with the caller-provided
 * `init.signal` (if any) so either side can cancel the request. The
 * external signal is forwarded — including its `reason` — to the internal
 * controller, preserving existing `try/catch` semantics. Returns the
 * timer id (or `null` if the timeout is disabled) plus a cleanup hook.
 */
function setupTimeoutSignal(init) {
    const timeoutMs = typeof init?.timeoutMs === 'number' ? init.timeoutMs : DEFAULT_API_TIMEOUT_MS;
    const controller = new AbortController();
    let timedOut = false;
    let timer = null;
    let onExternalAbort = null;
    if (timeoutMs > 0) {
        timer = setTimeout(() => {
            timedOut = true;
            controller.abort(new DOMException('apiFetch timeout', 'TimeoutError'));
        }, timeoutMs);
    }
    const external = init?.signal;
    if (external) {
        if (external.aborted) {
            controller.abort(external.reason);
        }
        else {
            onExternalAbort = () => controller.abort(external.reason);
            external.addEventListener('abort', onExternalAbort, { once: true });
        }
    }
    return {
        signal: controller.signal,
        cleanup() {
            if (timer != null)
                clearTimeout(timer);
            if (external && onExternalAbort) {
                external.removeEventListener('abort', onExternalAbort);
            }
        },
        didTimeOut: () => timedOut,
    };
}
export function apiFetch(path, init) {
    const { signal, cleanup, didTimeOut } = setupTimeoutSignal(init);
    // Strip `timeoutMs` from what we hand to `fetch` (RequestInit does not know
    // about it). Keep every other caller-provided init field intact.
    const { timeoutMs: _timeoutMs, signal: _externalSignal, ...passThrough } = init ?? {};
    void _timeoutMs;
    void _externalSignal;
    const requestInit = withCsrfHeader({ ...passThrough, signal });
    return fetch(apiUrl(path), requestInit).then((res) => {
        cleanup();
        if (!res.ok && shouldTrackApiError(path)) {
            trackClientError(new Error(`API ${res.status} ${res.statusText || 'Request failed'}`), { apiPath: path.split('?')[0], status: res.status, method: init?.method ?? 'GET' }, 'apiFetch');
        }
        return res;
    }, (error) => {
        cleanup();
        if (shouldTrackApiError(path)) {
            const reason = didTimeOut() ? 'timeout' : 'fetch';
            trackClientError(error, { apiPath: path.split('?')[0], method: init?.method ?? 'GET', reason }, 'apiFetch');
        }
        throw error;
    });
}
export const apiFetchJson = apiFetch;
export async function readJsonIfOk(res) {
    if (!res.ok) {
        return null;
    }
    try {
        return (await res.json());
    }
    catch {
        return null;
    }
}
