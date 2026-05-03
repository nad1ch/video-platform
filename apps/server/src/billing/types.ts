/**
 * Types and constants for the StreamAssist Pro Jar/Banka billing module.
 *
 * Wire format note:
 *   - `PaymentRequest.amount` is integer kopecks (UAH ×100) so DB writes are exact.
 *   - DTOs returned to clients carry kopecks under `amount` and an explicit
 *     `amountUah` decimal label so the UI never reconstructs the price itself.
 *   - All timestamps are ISO-8601 strings (UTC) on the wire.
 *
 * Only the matcher (`auto_matched`) and the admin `approve` endpoint may activate
 * a Subscription. Frontend signal alone never grants Pro.
 */

export const CURRENCY_UAH = 'UAH' as const
export const PLAN_PRO = 'pro' as const
export const PROVIDER_MONO_JAR = 'mono_jar' as const

export type PaymentRequestStatus =
  | 'created'
  | 'waiting_payment'
  | 'checking'
  | 'auto_matched'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export const ELIGIBLE_FOR_MATCH: ReadonlyArray<PaymentRequestStatus> = [
  'waiting_payment',
  'checking',
] as const

export const TERMINAL_STATUSES: ReadonlyArray<PaymentRequestStatus> = [
  'auto_matched',
  'approved',
  'rejected',
  'expired',
] as const

export type SubscriptionStatus = 'active' | 'inactive' | 'expired'

export type TransactionDirection = 'incoming' | 'outgoing'


export type SubscriptionDto = {
  status: SubscriptionStatus | null
  plan: typeof PLAN_PRO | null
  expiresAt: string | null
  isActive: boolean
  /**
   * Effective notification address for billing emails. `User.billingEmail`
   * when set, otherwise the user's auth `email`, otherwise `null` (Twitch
   * sign-up without email and no notification address configured).
   */
  billingEmail: string | null
  
  accountEmail: string | null
}


export type UpdateBillingEmailRequest = {
  
  email: string
}


export type UpdateBillingEmailResponse = SubscriptionDto


export type PaymentRequestDto = {
  paymentRequestId: string
  amount: number
  amountUah: string
  currency: typeof CURRENCY_UAH
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

/**
 * Public DTO returned by `GET /api/billing/jar/payment-request/:id`.
 * Owner-only — never leaks `internalReference`, admin note, matched transaction
 * details, or any cross-user information. Used by the FE modal to poll request
 * status (so we react to admin reject / needs_review / expired without waiting
 * for an `isActive` flip on the subscription).
 */
export type OwnedPaymentRequestDto = {
  paymentRequestId: string
  status: PaymentRequestStatus
  expiresAt: string
  amount: number
  amountUah: string
  currency: typeof CURRENCY_UAH
  subscription: SubscriptionDto
}

/**
 * Public DTO returned by `GET /api/billing/config`. Authoritative source of
 * truth for the FE pricing card and modal copy. The frontend MUST NOT
 * hardcode amount/duration — every visible price comes from this snapshot
 * (or the persisted `PaymentRequest.amountUah` for already-created rows).
 *
 * `MONO_JAR_URL` is deliberately NOT included; only `jarConfigured: boolean`
 * is exposed. The Jar URL itself ships with the per-request DTO from
 * `POST /api/billing/jar/create-payment-request`, where it is used at most
 * once per checkout flow.
 */
export type BillingConfigDto = {
  
  priceUah: number
  
  amount: number
  
  amountUah: string
  currency: typeof CURRENCY_UAH
  
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

export type AdminPaymentRequestRow = {
  id: string
  userId: string
  userEmail: string | null
  userDisplayName: string
  amount: number
  amountUah: string
  currency: typeof CURRENCY_UAH
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

export type AdminTransactionRow = {
  id: string
  monoTransactionId: string
  amount: number
  amountUah: string
  currency: string
  direction: TransactionDirection
  description: string | null
  operationTime: string
  matchedPaymentRequestId: string | null
}

export type AdminListDto = {
  requests: AdminPaymentRequestRow[]
  
  unmatchedTransactions: AdminTransactionRow[]
}
