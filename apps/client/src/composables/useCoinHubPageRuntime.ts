import { onMounted, onUnmounted, ref, type Ref } from 'vue'

const REFRESH_INTERVAL_MS = 60_000
const COOLDOWN_EDGE_THROTTLE_MS = 8_000

/**
 * 1s clock for cooldown labels, 60s poll, optional “edge” refresh when a cooldown instant has just passed.
 * (No `window` focus refetch — avoids extra snapshot churn and layout jump when returning to the tab.)
 */
export function useCoinHubPageRuntime(opts: {
  onBackgroundLoad: () => void
  shouldRefreshOnCooldownEdge: (now: number) => boolean
}): { nowMs: Ref<number> } {
  const nowMs = ref<number>(Date.now())
  let tickId = 0
  let pollId = 0
  let lastEdgeRefresh = 0

  onMounted(() => {
    tickId = window.setInterval(() => {
      const now = Date.now()
      nowMs.value = now
      if (now - lastEdgeRefresh >= COOLDOWN_EDGE_THROTTLE_MS && opts.shouldRefreshOnCooldownEdge(now)) {
        lastEdgeRefresh = now
        opts.onBackgroundLoad()
      }
    }, 1000)
    pollId = window.setInterval(() => {
      opts.onBackgroundLoad()
    }, REFRESH_INTERVAL_MS)
    onUnmounted(() => {
      clearInterval(tickId)
      clearInterval(pollId)
    })
  })
  return { nowMs }
}
