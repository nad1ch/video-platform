import { computed, onUnmounted, ref } from 'vue'
import {
  createJarPaymentRequest,
  fetchJarPaymentRequest,
  markJarPaymentPaid,
  type PaymentRequestDto,
  type PaymentRequestStatus,
} from '@/services/billingApi'
import { refreshSubscription, useProSubscription } from '@/composables/useProSubscription'
import {
  notifyTerminalRequestStatus,
  writePendingPaymentRequestId,
} from '@/composables/useBillingNotifications'
import { createLogger } from '@/utils/logger'

const log = createLogger('billing-flow')

/**
 * Page-local payment-request lifecycle.
 *
 * The composable is the single owner of the four orthogonal concerns the
 * modal needs to render correctly:
 *
 *   1. The current `PaymentRequestDto` (id + status + jarUrl + expires).
 *   2. "Mark paid" submit-in-flight flag (`submittingCheck`).
 *   3. A bounded polling loop that re-reads `PaymentRequest.status` from the
 *      server while the request sits in `checking` (or, defensively, also if
 *      the user reopens the modal on an in-flight request).
 *   4. The matching subscription state so we can flip to "Pro active" the
 *      moment the matcher activates it.
 *
 * Why poll the request, not just the subscription? Subscription only flips
 * `isActive=true` on `auto_matched`/`approved`. It NEVER reflects
 * `needs_review`/`rejected`/`expired`. Polling only the subscription is what
 * caused the "infinite loader after admin reject" bug.
 *
 * All async actions are guarded against double-firing, and timers are cleared
 * on `onUnmounted`, on `reset()`, and on `stopPolling()` so closing the modal/
 * page cannot leak intervals.
 */
export type BillingFlowKind =
  | 'idle'
  | 'creating'
  | 'awaiting_payment'
  | 'submitting_check'
  | 'checking'
  | 'auto_matched'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'error'

export type BillingFlowError = {
  code: string
  message: string
  
  jarMisconfigured: boolean
}

const TERMINAL_STATUSES: ReadonlyArray<PaymentRequestStatus> = [
  'auto_matched',
  'approved',
  'needs_review',
  'rejected',
  'expired',
]

const SUCCESS_TERMINAL_STATUSES: ReadonlyArray<PaymentRequestStatus> = ['auto_matched', 'approved']

function isTerminalStatus(s: PaymentRequestStatus): boolean {
  return TERMINAL_STATUSES.includes(s)
}

const DEFAULT_POLL_INTERVAL_MS = 4000
/**
 * 3 minutes is generous enough to cover a slow webhook + admin response
 * window; after this we stop polling and show "still pending — close the
 * modal and come back later" copy. We never show an infinite loader.
 */
const DEFAULT_POLL_TIMEOUT_MS = 180_000

export function useJarBillingFlow() {
  const request = ref<PaymentRequestDto | null>(null)
  const loading = ref(false)
  
  const submittingCheck = ref(false)
  
  const isPolling = ref(false)
  const error = ref<BillingFlowError | null>(null)

  const { refreshSubscription: refreshSub } = useProSubscription()

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollDeadline = 0
  let activePollRequestId: string | null = null
  let disposed = false

  function statusToKind(s: PaymentRequestStatus | null): BillingFlowKind {
    if (s === 'waiting_payment' || s === 'created') return 'awaiting_payment'
    if (s === 'checking') return 'checking'
    if (s === 'auto_matched') return 'auto_matched'
    if (s === 'needs_review') return 'needs_review'
    if (s === 'approved') return 'approved'
    if (s === 'rejected') return 'rejected'
    if (s === 'expired') return 'expired'
    return 'idle'
  }

  const kind = computed<BillingFlowKind>(() => {
    if (error.value) return 'error'
    if (loading.value) return 'creating'
    if (submittingCheck.value) return 'submitting_check'
    if (!request.value) return 'idle'
    return statusToKind(request.value.status)
  })

  const isTerminal = computed(
    () =>
      kind.value === 'auto_matched' ||
      kind.value === 'approved' ||
      kind.value === 'needs_review' ||
      kind.value === 'rejected' ||
      kind.value === 'expired',
  )

  
  const isBusy = computed(() => loading.value || submittingCheck.value)

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    activePollRequestId = null
    if (isPolling.value) {
      isPolling.value = false
    }
  }

  function reset(): void {
    stopPolling()
    request.value = null
    error.value = null
    loading.value = false
    submittingCheck.value = false
  }

  /**
   * Apply a server-fresh status to the local request snapshot. Idempotent:
   * if the local request handle has changed under us, we ignore the update
   * (a different request is now in scope).
   */
  function applyServerStatus(
    expectedRequestId: string,
    nextStatus: PaymentRequestStatus,
    nextExpiresAt: string,
  ): void {
    const cur = request.value
    if (!cur || cur.paymentRequestId !== expectedRequestId) return
    if (cur.status === nextStatus && cur.expiresAt === nextExpiresAt) return
    request.value = { ...cur, status: nextStatus, expiresAt: nextExpiresAt }
  }

  /**
   * Bounded polling of the per-request status endpoint. Runs every 4s for up
   * to 3 minutes, stops on any terminal status, refreshes the subscription
   * singleton on success terminals (`auto_matched` / `approved`), and bails
   * out cleanly on timeout — modal then shows the existing "still pending"
   * copy instead of an infinite loader.
   *
   * Network errors during polling are intentionally non-fatal: the previous
   * status is preserved, polling continues until timeout. We do NOT surface
   * raw transport errors to the modal here — the error state is only used
   * for "create" / "mark-paid" failures the user can act on.
   */
  function startStatusPolling(
    requestId: string,
    opts?: { intervalMs?: number; timeoutMs?: number },
  ): void {
    stopPolling()
    activePollRequestId = requestId
    isPolling.value = true
    const intervalMs = Math.max(1000, opts?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    const timeoutMs = Math.max(intervalMs, opts?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS)
    pollDeadline = Date.now() + timeoutMs

    const tick = async (): Promise<void> => {
      if (disposed || activePollRequestId !== requestId) {
        stopPolling()
        return
      }
      let next: Awaited<ReturnType<typeof fetchJarPaymentRequest>>
      try {
        next = await fetchJarPaymentRequest(requestId)
      } catch (err) {
        
        // but a sync throw should not crash the interval.
        log.warn('payment-request poll threw', err)
        if (Date.now() >= pollDeadline) stopPolling()
        return
      }
      if (disposed || activePollRequestId !== requestId) {
        stopPolling()
        return
      }
      if (!next.ok) {
        
        
        
        if (next.status === 404) {
          stopPolling()
          return
        }
        if (Date.now() >= pollDeadline) stopPolling()
        return
      }

      applyServerStatus(requestId, next.data.status, next.data.expiresAt)

      if (isTerminalStatus(next.data.status)) {
        stopPolling()
        
        
        
        notifyTerminalRequestStatus(requestId, next.data.status)
        if (SUCCESS_TERMINAL_STATUSES.includes(next.data.status)) {
          
          
          void refreshSub()
        }
        return
      }
      if (Date.now() >= pollDeadline) {
        
        stopPolling()
      }
    }

    void tick()
    pollTimer = setInterval(() => {
      void tick()
    }, intervalMs)
  }

  /**
   * Create a new payment request (or reuse the user's currently-active one).
   * Idempotent on the backend — repeated clicks while loading are still
   * gated here by the `loading` flag so we never fire two parallel POSTs.
   *
   * If the backend hands back an already-`checking` request (user reopened
   * modal mid-flight), resume polling so the modal does not stall on stale
   * status copy.
   */
  async function startCheckout(): Promise<void> {
    if (loading.value) return
    error.value = null
    loading.value = true
    try {
      const r = await createJarPaymentRequest()
      if (disposed) return
      if (!r.ok) {
        error.value = {
          code: r.code,
          message: r.message,
          jarMisconfigured: r.code === 'MONO_JAR_NOT_CONFIGURED',
        }
        return
      }
      request.value = r.data
      if (r.data.status === 'checking') {
        startStatusPolling(r.data.paymentRequestId)
      } else if (isTerminalStatus(r.data.status) && SUCCESS_TERMINAL_STATUSES.includes(r.data.status)) {
        
        void refreshSub()
      }
    } finally {
      if (!disposed) loading.value = false
    }
  }

  /**
   * Send "I paid" to the server. Idempotent on the server (repeated clicks
   * during `checking` only bump `checkedAt`). On any successful response we
   * - update local request status,
   * - on `checking` → start a bounded status poll,
   * - on success terminals (`auto_matched`/`approved`) → refresh subscription,
   * - on any other terminal (`needs_review`/`rejected`/`expired`) → just
   *   reflect the status; the modal renders the matching state without
   *   keeping a loader spinning.
   *
   * Disabled while a previous check is in flight to prevent UI button-mashing.
   */
  async function markPaid(): Promise<void> {
    const id = request.value?.paymentRequestId
    if (!id) return
    if (submittingCheck.value) return
    error.value = null
    submittingCheck.value = true
    try {
      const r = await markJarPaymentPaid(id)
      if (disposed) return
      if (!r.ok) {
        error.value = { code: r.code, message: r.message, jarMisconfigured: false }
        return
      }
      applyServerStatus(id, r.data.status, r.data.expiresAt)
      
      
      void refreshSub()

      if (SUCCESS_TERMINAL_STATUSES.includes(r.data.status)) {
        
        stopPolling()
        notifyTerminalRequestStatus(id, r.data.status)
        return
      }
      if (r.data.status === 'checking') {
        
        
        
        
        
        writePendingPaymentRequestId(id)
        startStatusPolling(id)
        return
      }
      
      stopPolling()
      notifyTerminalRequestStatus(id, r.data.status)
    } catch (err) {
      if (disposed) return
      error.value = {
        code: 'NETWORK',
        message: 'Не вдалося звʼязатися із сервером. Спробуйте ще раз.',
        jarMisconfigured: false,
      }
      log.warn('mark-paid failed', err)
    } finally {
      if (!disposed) submittingCheck.value = false
    }
  }

  function openJarLinkInNewTab(): void {
    const url = request.value?.jarUrl
    if (!url) return
    
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  onUnmounted(() => {
    disposed = true
    stopPolling()
  })

  return {
    request,
    kind,
    isTerminal,
    isBusy,
    isPolling,
    loading,
    submittingCheck,
    error,
    startCheckout,
    markPaid,
    openJarLinkInNewTab,
    stopPolling,
    reset,
    refreshSubscription,
  }
}
