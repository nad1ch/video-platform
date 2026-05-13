import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { useMafiaGameStore } from '@/stores/mafiaGame'

/**
 * Mafia "speaking-order" host hint state machine (Phase 2B extraction).
 *
 * Toggled on when the host enters `speaking` interaction mode from any
 * non-speaking state, and auto-clears after `MAFIA_SPEAKING_HINT_VISIBLE_MS`.
 * Gated to host-only and non-view-mode, matching the original behaviour
 * extracted from `useMafiaCallHostUi`.
 *
 * Owned independently so it can be consumed from a Mafia-owned adapter
 * (mounted as a sibling of `<CallPage>` from `MafiaPage`) without dragging in
 * the orchestrator-bound handlers from `useMafiaCallHostUi`. The rendering of
 * the toast itself (`<div class="call-page__mafia-speak-hint">`) lives in the
 * adapter; this composable only owns the visibility ref + watcher + timer.
 *
 * Behaviour preserved 1:1 from the original speak-hint watcher (same source,
 * same guards, same edge condition, same 4500 ms TTL, same per-mount
 * onBeforeUnmount cleanup that Phase 2A introduced).
 */

type MafiaGameStore = ReturnType<typeof useMafiaGameStore>

const MAFIA_SPEAKING_HINT_VISIBLE_MS = 4500

export interface UseMafiaSpeakingHintDeps {
  /** True when `route.name === 'mafia'`. */
  isMafiaRoute: Ref<boolean>
  /** True when the Mafia OBS/spectator UI is active (`?mode=view`). */
  mafiaViewUi: Ref<boolean>
  /** Mafia game store instance; the watcher source is `mafiaGameStore.hostInteractionMode`. */
  mafiaGameStore: MafiaGameStore
}

export interface UseMafiaSpeakingHintReturn {
  /** Visibility ref for the "speaking order" host hint toast. */
  mafiaSpeakingOrderHintVisible: Ref<boolean>
}

export function useMafiaSpeakingHint(
  deps: UseMafiaSpeakingHintDeps,
): UseMafiaSpeakingHintReturn {
  const { isMafiaRoute, mafiaViewUi, mafiaGameStore } = deps

  const mafiaSpeakingOrderHintVisible = ref(false)
  let mafiaSpeakingOrderHintTimer: ReturnType<typeof setTimeout> | undefined

  function clearSpeakingHintTimer(): void {
    if (mafiaSpeakingOrderHintTimer != null) {
      clearTimeout(mafiaSpeakingOrderHintTimer)
      mafiaSpeakingOrderHintTimer = undefined
    }
  }

  watch(
    () => mafiaGameStore.hostInteractionMode,
    (mode, prev) => {
      if (!isMafiaRoute.value || mafiaViewUi.value || !mafiaGameStore.isMafiaHost) {
        return
      }
      if (mode !== 'speaking' || prev == null || prev === 'speaking') {
        return
      }
      mafiaSpeakingOrderHintVisible.value = true
      clearSpeakingHintTimer()
      mafiaSpeakingOrderHintTimer = setTimeout(() => {
        mafiaSpeakingOrderHintVisible.value = false
        mafiaSpeakingOrderHintTimer = undefined
      }, MAFIA_SPEAKING_HINT_VISIBLE_MS)
    },
  )

  onBeforeUnmount(() => {
    clearSpeakingHintTimer()
  })

  return {
    mafiaSpeakingOrderHintVisible,
  }
}
