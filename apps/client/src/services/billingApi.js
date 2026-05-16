import { apiFetch } from '@/utils/apiFetch';
async function readErrorBody(res) {
    try {
        const j = (await res.json());
        const code = typeof j.error?.code === 'string' ? j.error.code : 'ERROR';
        const message = typeof j.error?.message === 'string' ? j.error.message : `HTTP ${res.status}`;
        return { code, message };
    }
    catch {
        return { code: 'ERROR', message: `HTTP ${res.status}` };
    }
}
async function jsonRequest(path, init) {
    try {
        const res = await apiFetch(path, init);
        if (!res.ok) {
            const { code, message } = await readErrorBody(res);
            return { ok: false, status: res.status, code, message };
        }
        const data = (await res.json());
        return { ok: true, data };
    }
    catch (err) {
        return { ok: false, status: 0, code: 'NETWORK', message: err.message };
    }
}
export function fetchSubscriptionMe() {
    return jsonRequest('/api/billing/subscription/me');
}
/**
 * Set (or clear, with empty string) the billing notification email. Returns
 * the same shape as `subscription/me` so callers can update the singleton
 * snapshot atomically. Server-side validation rejects malformed addresses
 * with `400 INVALID_EMAIL`.
 */
export function updateBillingEmail(email) {
    return jsonRequest('/api/billing/billing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
}
export function createJarPaymentRequest() {
    return jsonRequest('/api/billing/jar/create-payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
}
export function markJarPaymentPaid(paymentRequestId) {
    return jsonRequest('/api/billing/jar/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRequestId }),
    });
}
/**
 * Owner-only payment-request snapshot. Used by `useJarBillingFlow` to poll
 * status (so admin reject / needs_review / expired update the modal without
 * a page reload). Read-only — does NOT trigger statement matching.
 */
export function fetchJarPaymentRequest(paymentRequestId) {
    return jsonRequest(`/api/billing/jar/payment-request/${encodeURIComponent(paymentRequestId)}`);
}
export function fetchBillingConfig() {
    return jsonRequest('/api/billing/config');
}
export function fetchAdminSubscriptions(opts) {
    const qs = opts?.limit ? `?limit=${encodeURIComponent(String(opts.limit))}` : '';
    return jsonRequest(`/api/admin/billing/subscriptions${qs}`);
}
/**
 * Admin: force a one-shot monobank statement poll, bypassing the in-process
 * 60s cool-down. Surfaces a structured outcome so the admin UI can render a
 * useful status line ("fetched X transactions" / "rate limited" / etc.).
 */
export function forceAdminMonoPoll() {
    return jsonRequest('/api/admin/billing/poll-mono', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
}
/**
 * Admin: cancel an active Pro subscription. Idempotent on the backend —
 * repeated calls collapse to no-ops at the service layer.
 */
export function cancelAdminSubscription(subscriptionId) {
    return jsonRequest(`/api/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
}
export function fetchAdminBillingList(opts) {
    const qs = opts?.limit ? `?limit=${encodeURIComponent(String(opts.limit))}` : '';
    return jsonRequest(`/api/admin/billing/payment-requests${qs}`);
}
export function approveAdminPaymentRequest(id, adminNote) {
    return jsonRequest(`/api/admin/billing/payment-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminNote ? { adminNote } : {}),
    });
}
export function rejectAdminPaymentRequest(id, adminNote) {
    return jsonRequest(`/api/admin/billing/payment-requests/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminNote ? { adminNote } : {}),
    });
}
