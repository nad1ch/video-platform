import { onBeforeUnmount, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'

/**
 * Block 24 — pure full-power-mode composable extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`. Both routes carried this code byte-equivalently.
 *
 * Scope: a single `isFullPowerMode` shallow ref + the debounced entry rule.
 * The mode turns ON when **both** the global playback health is good and the
 * receive device profile is `'strong'`, after a 4 s settle window. Either
 * condition going false flips the mode off immediately and cancels any
 * pending entry timer. The 4 s settle is what avoids flapping on transient
 * pressure spikes — see the inline comments preserved from the pages.
 *
 * `isFullPowerMode` is consumed by:
 *   - `suppressionWatcherKey` (Block 24 / `useRemoteTileBudget`) to retrigger
 *     playback-suppression reconciliation when full-power flips.
 *   - the route pages' `streamVideoMemoDeps` (NOT touched by this block).
 *
 * Cleanup: `onBeforeUnmount` cancels the pending entry timer and resets
 * `isFullPowerMode` to `false` — matches the inline cleanup the pages used
 * to do in their own `onBeforeUnmount`.
 *
 * The composable is store-free and protocol-free.
 */

const FULL_POWER_ENTER_AFTER_MS = 4000

export interface UseFullPowerModeOptions {
  /**
   * Global playback health. `true` when no remote tile is waiting and no peer
   * has render-FPS pressure. Owned by the page (it's the result of a per-page
   * computed over remote-playback / FPS state).
   */
  isSystemHealthy: ComputedRef<boolean> | Ref<boolean>
  /**
   * Receive device profile from `useCallOrchestrator`. The composable only
   * reads `.profile` — when it is `'strong'` AND health is good, the entry
   * timer is armed.
   */
  receiveDeviceProfile: Ref<{ profile: string }>
}

export interface UseFullPowerModeApi {
  isFullPowerMode: ShallowRef<boolean>
}

export function useFullPowerMode(options: UseFullPowerModeOptions): UseFullPowerModeApi {
  const { isSystemHealthy, receiveDeviceProfile } = options

  const isFullPowerMode = shallowRef(false)
  let fullPowerEnterTimer: ReturnType<typeof setTimeout> | null = null

  function clearFullPowerEnterTimer(): void {
    if (fullPowerEnterTimer != null) {
      clearTimeout(fullPowerEnterTimer)
      fullPowerEnterTimer = null
    }
  }

  watch(
    () =>
      [isSystemHealthy.value, receiveDeviceProfile.value.profile === 'strong'] as const,
    ([healthy, strongProfile]) => {
      if (!strongProfile || !healthy) {
        clearFullPowerEnterTimer()
        if (isFullPowerMode.value) {
          isFullPowerMode.value = false
        }
        return
      }
      if (isFullPowerMode.value) {
        return
      }
      if (fullPowerEnterTimer != null) {
        return
      }
      fullPowerEnterTimer = window.setTimeout(() => {
        fullPowerEnterTimer = null
        if (receiveDeviceProfile.value.profile === 'strong' && isSystemHealthy.value) {
          isFullPowerMode.value = true
        }
      }, FULL_POWER_ENTER_AFTER_MS)
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    clearFullPowerEnterTimer()
    isFullPowerMode.value = false
  })

  return { isFullPowerMode }
}
