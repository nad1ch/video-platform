import { onBeforeUnmount, onMounted, onUnmounted, watch, type Ref } from 'vue'
import {
  installMediaDebugGlobal,
  isMediaDebugEnabled,
  recordMediaDebugSignalingIncoming,
  recordMediaDebugWsTransition,
  setMediaDebugEnvInfo,
  startMediaDebugRafProbe,
  startMediaDebugTimerDriftProbe,
} from '@/utils/mediaDebugRuntime'

/**
 * Block 24 — pure media-debug-taps composable extracted from `CallPage.vue`
 * and `GameTemplateCallPage.vue`. Both routes carried this code
 * byte-equivalently except for the `setMediaDebugEnvInfo` payload — that
 * payload is route-specific (Mafia stamps `isMafiaView` + `isEatFirstView`;
 * Game Template stamps `isGameRoomView`) and is therefore taken as a thunk.
 *
 * Scope: diagnostics-only taps that feed `?mediaDebug=1` panel and the
 * `__MEDIA_DEBUG__` console accessor:
 *   - WS lifecycle counter (open/close/error + `closed → open` reconnects)
 *   - signaling-message counter (per-type, with a syncReason carve-out for
 *     `producer-sync`)
 *   - always-on timer-drift probe + companion rAF probe (start at mount,
 *     detach at unmount)
 *   - env-info stamp (called ONCE at mount with the route-provided payload)
 *   - optional `installMediaDebugGlobal` when `?mediaDebug=1` is set (the
 *     `forceSoftResync` hook calls the page-injected `requestForcedProducerResync`)
 *
 * Cleanup: `onBeforeUnmount` detaches the signaling-message subscriber;
 * `onUnmounted` detaches the timer-drift probe, rAF probe, and the global
 * install — matches the original split the pages used (subscriber detach
 * happens in `onBeforeUnmount`; probe/global detach happens in `onUnmounted`
 * alongside other DOM teardown).
 *
 * No store or protocol imports. `subscribeSignalingMessage` and
 * `requestForcedProducerResync` are call-core handles supplied by the page
 * out of its `useCallOrchestrator` destructure.
 */

export type SubscribeSignalingMessage = (
  cb: (data: unknown) => void,
) => () => void

export interface UseCallMediaDebugTapsOptions {
  /**
   * Current WS status from `useCallOrchestrator`. Compared as a string so
   * non-string transients (transitionally `null` during reconnect) are
   * normalized — same `String(next)` coercion the pages used.
   */
  wsStatus: Ref<string>
  /**
   * Subscribe handle from `useCallOrchestrator`. The composable registers a
   * single diagnostics-only counting subscriber and detaches it at unmount.
   */
  subscribeSignalingMessage: SubscribeSignalingMessage
  /**
   * Forced producer resync from `useCallOrchestrator`. Called from the
   * `__MEDIA_DEBUG__.forceSoftResync()` console accessor only when
   * `?mediaDebug=1` enabled and the global install ran.
   */
  requestForcedProducerResync: () => void
  /**
   * Route-specific env-info payload. Called once at mount; the shared
   * `mediaDebugRuntime` reader ORs the route-specific keys into the
   * `isViewMode` summary used by `MediaDiagnosticsPanel`.
   */
  envInfo: () => Record<string, boolean>
}

export function useCallMediaDebugTaps(options: UseCallMediaDebugTapsOptions): void {
  const { wsStatus, subscribeSignalingMessage, requestForcedProducerResync, envInfo } = options

  // Diagnostics-only WS lifecycle counter. Reads the existing `wsStatus` ref;
  // no call-core change required. Records open/close/error counts and
  // detects `closed → open` (i.e. WS reconnect) transitions for the
  // `?mediaDebug=1` panel + `__MEDIA_DEBUG__.wsStats()` console accessor.
  let lastObservedWsStatus: string | null = null
  watch(
    () => wsStatus.value,
    (next) => {
      const nextStr = typeof next === 'string' ? next : String(next)
      if (lastObservedWsStatus === nextStr) return
      recordMediaDebugWsTransition(lastObservedWsStatus, nextStr)
      lastObservedWsStatus = nextStr
    },
    { immediate: true },
  )

  // Diagnostics-only counting subscriber. Does NOT apply state — every other
  // `subscribeSignalingMessage` registration handles real apply paths. This
  // one increments per-type counters so post-incident analysis can correlate
  // flicker / blackout reports with WS message bursts. Cost: one switch +
  // counter per inbound message.
  const offMediaDebugSignalingCounter = subscribeSignalingMessage((data) => {
    if (!data || typeof data !== 'object') return
    const type = (data as { type?: unknown }).type
    if (typeof type !== 'string') return
    if (type === 'producer-sync') {
      const payload = (data as { payload?: { syncReason?: unknown } }).payload
      const syncReason =
        payload && typeof payload.syncReason === 'string' ? payload.syncReason : undefined
      recordMediaDebugSignalingIncoming(type, { syncReason })
      return
    }
    recordMediaDebugSignalingIncoming(type)
  })
  onBeforeUnmount(offMediaDebugSignalingCounter)

  let detachMediaDebugGlobal: (() => void) | null = null
  let detachMediaDebugTimerDriftProbe: (() => void) | null = null
  let detachMediaDebugRafProbe: (() => void) | null = null

  onMounted(() => {
    // Always-on timer-drift probe — diagnostic only, no media side effects.
    // Surfaces OBS browser-source / hidden-tab throttling that would otherwise
    // silently break the StreamVideo currentTime stall watchdog and the
    // StreamAudio AudioContext heartbeat. Cost is one setInterval at 2 s per
    // call route; result accessible via `__MEDIA_DEBUG__.timerDrift()` and
    // surfaced in the `?mediaDebug=1` panel.
    detachMediaDebugTimerDriftProbe = startMediaDebugTimerDriftProbe()
    // Companion rAF probe. setInterval and rAF are throttled differently in
    // some Chromium versions; the rAF probe surfaces render-loop pressure
    // (long frames, low FPS) that the timer-drift probe cannot. Pure counter
    // updates per frame; no DOM access in the callback.
    detachMediaDebugRafProbe = startMediaDebugRafProbe()
    // Stamp env info ONCE at mount. Live `documentVisibilityState` is
    // included by the reader, so no need to track it reactively.
    setMediaDebugEnvInfo(envInfo())
    if (isMediaDebugEnabled()) {
      detachMediaDebugGlobal = installMediaDebugGlobal({
        forceSoftResync: () => {
          try {
            requestForcedProducerResync()
          } catch (err) {
            console.warn('[mediaDebug] forceSoftResync failed', err)
          }
        },
      })
    }
  })

  onUnmounted(() => {
    detachMediaDebugTimerDriftProbe?.()
    detachMediaDebugTimerDriftProbe = null
    detachMediaDebugRafProbe?.()
    detachMediaDebugRafProbe = null
    detachMediaDebugGlobal?.()
    detachMediaDebugGlobal = null
  })
}
