import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { useGameTemplateGameStore } from '@/stores/gameTemplateGame'

/**
 * Generic "speaking-order" host hint state machine (Phase 3B).
 *
 * Parallel of `useMafiaSpeakingHint.ts`. Toggles on when the host enters
 * the `'speaking'` interaction mode from any non-speaking state, and auto-
 * clears after `GAME_ROOM_SPEAKING_HINT_VISIBLE_MS`. Gated to host-only and
 * non-view-mode.
 *
 * The store contract (`hostInteractionMode`, `isGameRoomHost`) is the
 * Game Template generic store — the composable does NOT reach into Mafia.
 */

type GameTemplateGameStore = ReturnType<typeof useGameTemplateGameStore>

const GAME_ROOM_SPEAKING_HINT_VISIBLE_MS = 4500

export interface UseGameRoomSpeakingHintDeps {
  /** True when `route.name === 'game-template'`. */
  isGameRoomRoute: Ref<boolean>
  /** True when the OBS/spectator view UI is active (`?mode=view`). */
  viewUi: Ref<boolean>
  /** Generic game-room store; watcher source is `hostInteractionMode`. */
  gameStore: GameTemplateGameStore
}

export interface UseGameRoomSpeakingHintReturn {
  /** Visibility ref for the "speaking order" host hint toast. */
  speakingOrderHintVisible: Ref<boolean>
}

export function useGameRoomSpeakingHint(
  deps: UseGameRoomSpeakingHintDeps,
): UseGameRoomSpeakingHintReturn {
  const { isGameRoomRoute, viewUi, gameStore } = deps

  const speakingOrderHintVisible = ref(false)
  let speakingOrderHintTimer: ReturnType<typeof setTimeout> | undefined

  function clearSpeakingHintTimer(): void {
    if (speakingOrderHintTimer != null) {
      clearTimeout(speakingOrderHintTimer)
      speakingOrderHintTimer = undefined
    }
  }

  watch(
    () => gameStore.hostInteractionMode,
    (mode, prev) => {
      if (!isGameRoomRoute.value || viewUi.value || !gameStore.isGameRoomHost) {
        return
      }
      if (mode !== 'speaking' || prev == null || prev === 'speaking') {
        return
      }
      speakingOrderHintVisible.value = true
      clearSpeakingHintTimer()
      speakingOrderHintTimer = setTimeout(() => {
        speakingOrderHintVisible.value = false
        speakingOrderHintTimer = undefined
      }, GAME_ROOM_SPEAKING_HINT_VISIBLE_MS)
    },
  )

  onBeforeUnmount(() => {
    clearSpeakingHintTimer()
  })

  return {
    speakingOrderHintVisible,
  }
}
