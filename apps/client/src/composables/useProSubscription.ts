import { computed, onUnmounted, ref } from 'vue'
import { fetchSubscriptionMe, type SubscriptionDto } from '@/services/billingApi'
import { createLogger } from '@/utils/logger'

/**
 * Singleton-ish Pro subscription snapshot. Source of truth is the server
 * response from `GET /api/billing/subscription/me`. The frontend never decides
 * Pro access locally — `isProActive.value === true` means the server confirmed
 * `status === 'active' && expiresAt > now` at the last poll.
 *
 * `pollUntilActive` is the post-`mark-paid` helper: after the user clicks
 * "I paid", we poll until either Pro turns on or the timeout elapses. Polling
 * stops automatically on component teardown.
 */

const log = createLogger('billing')

/**
 * Singleton subscription ref. Exported so non-component callers (the global
 * billing notifier, server-side stand-ins in tests) can read state without
 * having to invoke `useProSubscription()` (which registers `onUnmounted` and
 * therefore must run inside a Vue component instance).
 */
export const subscriptionState = ref<SubscriptionDto | null>(null)
const subscription = subscriptionState
const loading = ref(false)
const lastError = ref<string | null>(null)
let inflight: Promise<void> | null = null

async function refreshOnce(): Promise<void> {
  loading.value = true
  try {
    const r = await fetchSubscriptionMe()
    if (r.ok) {
      subscription.value = r.data
      lastError.value = null
    } else {
      // Keep the last known snapshot — do NOT flip to "no Pro" on transient errors.
      lastError.value = r.message
      log.warn('subscription/me failed', r.status, r.code, r.message)
    }
  } finally {
    loading.value = false
  }
}

export function refreshSubscription(): Promise<void> {
  if (inflight) return inflight
  inflight = refreshOnce().finally(() => {
    inflight = null
  })
  return inflight
}

export function useProSubscription() {
  const isProActive = computed(() => subscription.value?.isActive === true)
  const expiresAt = computed(() => subscription.value?.expiresAt ?? null)
  const status = computed(() => subscription.value?.status ?? null)
  /** Effective notification address (billingEmail override or auth email). */
  const billingEmail = computed(() => subscription.value?.billingEmail ?? null)
  /** Auth-side `User.email` — exposed so the FE can pre-fill the billing-email input. */
  const accountEmail = computed(() => subscription.value?.accountEmail ?? null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollDeadline = 0
  let pollResolve: ((activated: boolean) => void) | null = null
  let disposed = false

  function clearPoll(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (pollResolve) {
      const r = pollResolve
      pollResolve = null
      r(isProActive.value)
    }
  }

  function pollUntilActive(opts?: {
    intervalMs?: number
    timeoutMs?: number
  }): Promise<boolean> {
    const intervalMs = Math.max(1000, opts?.intervalMs ?? 4000)
    const timeoutMs = Math.max(intervalMs, opts?.timeoutMs ?? 90_000)
    pollDeadline = Date.now() + timeoutMs
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    return new Promise<boolean>((resolve) => {
      pollResolve = resolve
      const tick = (): void => {
        if (disposed) {
          clearPoll()
          return
        }
        void refreshSubscription().then(() => {
          if (disposed) return
          if (isProActive.value) {
            clearPoll()
            return
          }
          if (Date.now() >= pollDeadline) {
            clearPoll()
          }
        })
      }
      tick()
      pollTimer = setInterval(tick, intervalMs)
    })
  }

  onUnmounted(() => {
    disposed = true
    clearPoll()
  })

  return {
    subscription,
    isProActive,
    expiresAt,
    status,
    billingEmail,
    accountEmail,
    loading,
    lastError,
    refreshSubscription,
    pollUntilActive,
  }
}
