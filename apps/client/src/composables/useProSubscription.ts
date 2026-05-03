import { computed, ref } from 'vue'
import { fetchSubscriptionMe, type SubscriptionDto } from '@/services/billingApi'
import { createLogger } from '@/utils/logger'

/**
 * Singleton-ish Pro subscription snapshot. Source of truth is the server
 * response from `GET /api/billing/subscription/me`. The frontend never decides
 * Pro access locally — `isProActive.value === true` means the server confirmed
 * `status === 'active' && expiresAt > now` at the last poll.
 *
 * Per-request status polling lives in `useJarBillingFlow.startStatusPolling`
 * (which polls the request, not the subscription, so it reacts to all
 * terminal statuses, not just activation). The global notifier
 * (`useBillingNotifications`) keeps this singleton fresh on a 20s tick.
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
  
  const billingEmail = computed(() => subscription.value?.billingEmail ?? null)
  
  const accountEmail = computed(() => subscription.value?.accountEmail ?? null)

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
  }
}
