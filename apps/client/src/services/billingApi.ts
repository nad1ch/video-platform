import { apiFetch } from '@/utils/apiFetch'

/**
 * Typed wrapper for `/api/billing/*` endpoints. Every call returns a
 * discriminated `BillingApiResult<T>` so callers can render error states
 * without throwing — the UI must NOT mistake a network blip for "Pro denied".
 *
 * Activation authority lives entirely on the server. The frontend reads
 * snapshots; it never decides Pro state on its own.
 */

export type PaymentRequestStatus =
  | 'created'
  | 'waiting_payment'
  | 'checking'
  | 'auto_matched'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export type SubscriptionStatus = 'active' | 'inactive' | 'expired'

export type SubscriptionDto = {
  status: SubscriptionStatus | null
  plan: 'pro' | null
  expiresAt: string | null
  isActive: boolean
  /**
   * Effective notification address used by billing emails:
   * `User.billingEmail` (if explicitly set via `POST /api/billing/billing-email`)
   * or fallback to the user's auth `email`. `null` when neither is available
   * (Twitch sign-up without email and no override).
   */
  billingEmail: string | null
  
  accountEmail: string | null
}

export type PaymentRequestDto = {
  paymentRequestId: string
  amount: number
  amountUah: string
  currency: 'UAH'
  jarUrl: string
  status: PaymentRequestStatus
  expiresAt: string
}

export type MarkPaidDto = {
  paymentRequestId: string
  status: PaymentRequestStatus
  expiresAt: string
  subscription: SubscriptionDto
}


export type OwnedPaymentRequestDto = {
  paymentRequestId: string
  status: PaymentRequestStatus
  expiresAt: string
  amount: number
  amountUah: string
  currency: 'UAH'
  subscription: SubscriptionDto
}

/**
 * Public DTO returned by `GET /api/billing/config`. The frontend pricing
 * card and modal MUST read from this — there is no client-side fallback
 * price. Existing PaymentRequest rows continue to display their persisted
 * `amountUah` (which may differ if env was changed after creation).
 */
export type BillingConfigDto = {
  priceUah: number
  amount: number
  amountUah: string
  currency: 'UAH'
  durationDays: number
  matchWindowMinutes: number
  jarConfigured: boolean
}


export type AdminSubscriptionRow = {
  id: string
  userId: string
  userEmail: string | null
  userDisplayName: string
  plan: string
  status: SubscriptionStatus
  isActive: boolean
  startsAt: string
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export type AdminSubscriptionListDto = {
  subscriptions: AdminSubscriptionRow[]
}

export type CancelSubscriptionDto = {
  subscription: AdminSubscriptionRow
  
  cancelledNow: boolean
}


export type AdminForcePollResultDto =
  | { ok: true; itemCount: number; accountId: string }
  | {
      ok: false
      reason: 'not_configured' | 'rate_limited' | 'error'
      message?: string
    }

export type AdminTransactionRow = {
  id: string
  monoTransactionId: string
  amount: number
  amountUah: string
  currency: string
  direction: 'incoming' | 'outgoing'
  description: string | null
  operationTime: string
  matchedPaymentRequestId: string | null
}

export type AdminPaymentRequestRow = {
  id: string
  userId: string
  userEmail: string | null
  userDisplayName: string
  amount: number
  amountUah: string
  currency: 'UAH'
  status: PaymentRequestStatus
  internalReference: string | null
  adminNote: string | null
  createdAt: string
  expiresAt: string
  markedPaidAt: string | null
  matchedTransactionId: string | null
  matchedTransaction: AdminTransactionRow | null
  candidateTransactions: AdminTransactionRow[]
}

export type AdminListDto = {
  requests: AdminPaymentRequestRow[]
  unmatchedTransactions: AdminTransactionRow[]
}

export type ApproveRejectDto = {
  status: PaymentRequestStatus
  activated?: boolean
  rejected?: boolean
}

export type BillingApiOk<T> = { ok: true; data: T }
export type BillingApiError = {
  ok: false
  status: number
  
  code: string
  message: string
}
export type BillingApiResult<T> = BillingApiOk<T> | BillingApiError

async function readErrorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const j = (await res.json()) as { error?: { code?: unknown; message?: unknown } }
    const code = typeof j.error?.code === 'string' ? j.error.code : 'ERROR'
    const message = typeof j.error?.message === 'string' ? j.error.message : `HTTP ${res.status}`
    return { code, message }
  } catch {
    return { code: 'ERROR', message: `HTTP ${res.status}` }
  }
}

async function jsonRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<BillingApiResult<T>> {
  try {
    const res = await apiFetch(path, init)
    if (!res.ok) {
      const { code, message } = await readErrorBody(res)
      return { ok: false, status: res.status, code, message }
    }
    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    return { ok: false, status: 0, code: 'NETWORK', message: (err as Error).message }
  }
}

export function fetchSubscriptionMe(): Promise<BillingApiResult<SubscriptionDto>> {
  return jsonRequest<SubscriptionDto>('/api/billing/subscription/me')
}

/**
 * Set (or clear, with empty string) the billing notification email. Returns
 * the same shape as `subscription/me` so callers can update the singleton
 * snapshot atomically. Server-side validation rejects malformed addresses
 * with `400 INVALID_EMAIL`.
 */
export function updateBillingEmail(
  email: string,
): Promise<BillingApiResult<SubscriptionDto>> {
  return jsonRequest<SubscriptionDto>('/api/billing/billing-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export function createJarPaymentRequest(): Promise<BillingApiResult<PaymentRequestDto>> {
  return jsonRequest<PaymentRequestDto>('/api/billing/jar/create-payment-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

export function markJarPaymentPaid(
  paymentRequestId: string,
): Promise<BillingApiResult<MarkPaidDto>> {
  return jsonRequest<MarkPaidDto>('/api/billing/jar/mark-paid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentRequestId }),
  })
}

/**
 * Owner-only payment-request snapshot. Used by `useJarBillingFlow` to poll
 * status (so admin reject / needs_review / expired update the modal without
 * a page reload). Read-only — does NOT trigger statement matching.
 */
export function fetchJarPaymentRequest(
  paymentRequestId: string,
): Promise<BillingApiResult<OwnedPaymentRequestDto>> {
  return jsonRequest<OwnedPaymentRequestDto>(
    `/api/billing/jar/payment-request/${encodeURIComponent(paymentRequestId)}`,
  )
}


export function fetchBillingConfig(): Promise<BillingApiResult<BillingConfigDto>> {
  return jsonRequest<BillingConfigDto>('/api/billing/config')
}


export function fetchAdminSubscriptions(opts?: {
  limit?: number
}): Promise<BillingApiResult<AdminSubscriptionListDto>> {
  const qs = opts?.limit ? `?limit=${encodeURIComponent(String(opts.limit))}` : ''
  return jsonRequest<AdminSubscriptionListDto>(`/api/admin/billing/subscriptions${qs}`)
}

/**
 * Admin: force a one-shot monobank statement poll, bypassing the in-process
 * 60s cool-down. Surfaces a structured outcome so the admin UI can render a
 * useful status line ("fetched X transactions" / "rate limited" / etc.).
 */
export function forceAdminMonoPoll(): Promise<BillingApiResult<AdminForcePollResultDto>> {
  return jsonRequest<AdminForcePollResultDto>('/api/admin/billing/poll-mono', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

/**
 * Admin: cancel an active Pro subscription. Idempotent on the backend —
 * repeated calls collapse to no-ops at the service layer.
 */
export function cancelAdminSubscription(
  subscriptionId: string,
): Promise<BillingApiResult<CancelSubscriptionDto>> {
  return jsonRequest<CancelSubscriptionDto>(
    `/api/admin/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  )
}

export function fetchAdminBillingList(opts?: {
  limit?: number
}): Promise<BillingApiResult<AdminListDto>> {
  const qs = opts?.limit ? `?limit=${encodeURIComponent(String(opts.limit))}` : ''
  return jsonRequest<AdminListDto>(`/api/admin/billing/payment-requests${qs}`)
}

export function approveAdminPaymentRequest(
  id: string,
  adminNote?: string | null,
): Promise<BillingApiResult<ApproveRejectDto>> {
  return jsonRequest<ApproveRejectDto>(
    `/api/admin/billing/payment-requests/${encodeURIComponent(id)}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminNote ? { adminNote } : {}),
    },
  )
}

export function rejectAdminPaymentRequest(
  id: string,
  adminNote?: string | null,
): Promise<BillingApiResult<ApproveRejectDto>> {
  return jsonRequest<ApproveRejectDto>(
    `/api/admin/billing/payment-requests/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminNote ? { adminNote } : {}),
    },
  )
}
