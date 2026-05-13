import { computed, type Ref } from 'vue'
import { GameRoomWs } from '@/composables/gameRoomWsProtocol'
import type { useGameTemplateGameStore } from '@/stores/gameTemplateGame'
import {
  decodeSpeakingNominationFlat,
  nominationTargetSeatsFromSpeakingFlat,
} from '@/utils/speakingNominationQueue'

/**
 * Generic game-room call-host UI composable (Phase 3B).
 *
 * Parallel of `useMafiaCallHostUi.ts` with the Mafia night-action branch
 * removed: the generic protocol does NOT carry roles, so there is no
 * `night` host-interaction mode. The default mode is `'idle'` (no-op
 * click semantics) and only `'swap'` + `'speaking'` modes actually mutate
 * state.
 *
 * Owns:
 *   - thin outbound `gameroom:force-mute-all` / `gameroom:force-camera-off`
 *     senders
 *   - thin generic store dispatchers (life toggle)
 *   - host-side seat-highlight computed for queued speaking-nomination
 *     targets
 *   - the generic host tile-click router (swap / speaking branches only)
 *
 * Does NOT own:
 *   - any media/WebRTC state (call-core owns the orchestrator)
 *   - inbound WS dispatch (`useGameRoomHostSignaling` owns that)
 *   - audio-mix host broadcast (`useGameRoomAudioMixSignaling` owns that)
 *   - participant ordering (the consuming page owns that; this composable
 *     only consumes the resolved `seatNumberByPeer` map)
 *   - host identity (the generic store + `useGameRoomHostSignaling` triple-gate)
 *
 * Behaviour preserved 1:1 from the Mafia composable for every kept branch.
 * The night branch is dropped entirely; the default click is a no-op so
 * future games can hook in their own per-mode behaviour without inheriting
 * Mafia semantics by accident.
 */

type GameTemplateGameStore = ReturnType<typeof useGameTemplateGameStore>

/** Minimal row shape accepted by `handleHostTileClick`. */
export interface GameRoomCallTileRow {
  tile: { peerId: string }
}

export interface UseGameRoomCallHostUiDeps {
  /** True when `route.name === 'game-template'`. */
  isGameRoomRoute: Ref<boolean>
  /** True when the OBS/spectator view UI is active (`?mode=view`). */
  viewUi: Ref<boolean>
  /** Current local peer id (call-core session). Used to forbid self force-camera-off. */
  selfPeerId: Ref<string | null | undefined>
  /** Generic game-room store from the consuming page's setup; reuse — do not re-instantiate. */
  gameStore: GameTemplateGameStore
  /** Resolved peerId → seat number map (host excluded; consumer computes this). */
  seatNumberByPeer: Ref<Map<string, number>>
  /** Call-core outbound signaling. */
  sendSignalingMessage: (msg: { type: string; payload: unknown }) => void
  /** Toast pusher; the nomination collision toasts go through it. */
  pushCallToast: (text: string, kind?: 'join' | 'leave') => void
  /** Translator. Consumers pass their own `t` so the composable stays
   * i18n-key-agnostic. */
  t: (key: string, named?: Record<string, unknown>) => string
}

export interface UseGameRoomCallHostUiReturn {
  /** Tile-wrap class predicate: highlight queued speaking-nomination targets. */
  isHostSpeakingNominationUiSeat: (seat: number | undefined) => boolean
  /** Tile-emit handler: host-only life flip. */
  onToggleLifeFromTile: (peerId: string) => void
  /** Tile-emit handler: host-only camera force. */
  onForceCameraOffFromTile: (peerId: string) => void
  /** Bottom-bar handler: `force-mute-all`. */
  onForceMuteAll: (muted: boolean) => void
  /** Generic tile-click router (swap / speaking branches only). */
  handleHostTileClick: (ev: MouseEvent, row: GameRoomCallTileRow) => void
}

const FORCE_CAMERA_OFF_SIGNAL = GameRoomWs.forceCameraOff
const FORCE_MUTE_ALL_SIGNAL = GameRoomWs.forceMuteAll

export function useGameRoomCallHostUi(
  deps: UseGameRoomCallHostUiDeps,
): UseGameRoomCallHostUiReturn {
  const {
    isGameRoomRoute,
    viewUi,
    selfPeerId,
    gameStore,
    seatNumberByPeer,
    sendSignalingMessage,
    pushCallToast,
    t,
  } = deps

  // ---- Host-side seat-highlight ------------------------------------------

  const hostSpeakingNominationTargetSeatSet = computed(() =>
    nominationTargetSeatsFromSpeakingFlat(gameStore.speakingQueue),
  )

  function isHostSpeakingNominationUiSeat(seat: number | undefined): boolean {
    if (seat == null) {
      return false
    }
    return hostSpeakingNominationTargetSeatSet.value.has(seat)
  }

  // ---- Thin outbound handlers --------------------------------------------

  function onToggleLifeFromTile(peerId: string): void {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return
    }
    gameStore.hostToggleGameRoomPlayerLife(peerId)
  }

  function onForceCameraOffFromTile(peerId: string): void {
    if (!isGameRoomRoute.value || !gameStore.isGameRoomHost) {
      return
    }
    if (typeof peerId !== 'string' || peerId.length < 1 || peerId === selfPeerId.value) {
      return
    }
    sendSignalingMessage({ type: FORCE_CAMERA_OFF_SIGNAL, payload: { peerId } })
  }

  function onForceMuteAll(muted: boolean): void {
    if (!isGameRoomRoute.value || !gameStore.isGameRoomHost) {
      return
    }
    sendSignalingMessage({ type: FORCE_MUTE_ALL_SIGNAL, payload: { muted } })
  }

  // ---- Host tile-click router (swap / speaking) ---------------------------
  //
  // Mafia's `night` branch (`mafiaGameStore.assignOrClearNightActionForActiveRole`)
  // is intentionally NOT mirrored here — roles + night actions are Mafia-only.
  // For any non-swap, non-speaking mode the click is a no-op; future games
  // can layer their own per-mode click semantics on top of this composable
  // by exposing a `defaultModeHandler` dep in a follow-up phase.

  function handleHostTileClick(ev: MouseEvent, row: GameRoomCallTileRow): void {
    if (viewUi.value) {
      return
    }
    if (!isGameRoomRoute.value || !gameStore.isGameRoomHost) {
      return
    }
    const clickTarget = ev.target
    if (clickTarget instanceof Element) {
      if (
        clickTarget.closest('button, input, textarea, a, [data-no-mafia-tile-host], [data-no-game-room-tile-host]')
      ) {
        return
      }
      if (clickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
        return
      }
    }
    if (gameStore.hostInteractionMode === 'swap') {
      const pid = row.tile.peerId
      const sel = gameStore.hostSeatSwapSelectionPeerId
      if (sel == null) {
        gameStore.setSeatSwapSelectionPeerId(pid)
      } else if (sel === pid) {
        gameStore.setSeatSwapSelectionPeerId(null)
      } else {
        gameStore.swapSeatsByPeerId(sel, pid)
      }
      ev.stopPropagation()
      return
    }
    const seat = seatNumberByPeer.value.get(row.tile.peerId)
    if (seat == null) {
      return
    }
    if (gameStore.hostInteractionMode === 'speaking') {
      const draft = gameStore.speakingNominationDraftBySeat
      const segments = decodeSpeakingNominationFlat(gameStore.speakingQueue)
      if (draft == null) {
        const existingBy = segments.find((seg) => seg.bySeat === seat)
        if (existingBy) {
          pushCallToast(
            t('mafiaPage.speakingByAlreadyNominatedToast', {
              by: seat,
              target: existingBy.targetSeat,
            }),
            'leave',
          )
          ev.stopPropagation()
          return
        }
        gameStore.setSpeakingNominationDraftBySeat(seat)
      } else if (draft === seat) {
        gameStore.setSpeakingNominationDraftBySeat(null)
      } else {
        const existingTarget = segments.find((seg) => seg.targetSeat === seat)
        if (existingTarget) {
          pushCallToast(
            t('mafiaPage.speakingTargetAlreadyNominatedToast', {
              target: seat,
              by: existingTarget.bySeat ?? '?',
            }),
            'leave',
          )
          ev.stopPropagation()
          return
        }
        const existingBy = segments.find((seg) => seg.bySeat === draft)
        if (existingBy) {
          pushCallToast(
            t('mafiaPage.speakingByAlreadyNominatedToast', {
              by: draft,
              target: existingBy.targetSeat,
            }),
            'leave',
          )
          gameStore.setSpeakingNominationDraftBySeat(null)
          ev.stopPropagation()
          return
        }
        gameStore.appendSpeakingNominationPair(draft, seat)
      }
    }
    // Mafia's `else { ... assignOrClearNightActionForActiveRole ... }` branch
    // is deliberately omitted. Default click is a no-op for the generic
    // game-room.
    ev.stopPropagation()
  }

  return {
    isHostSpeakingNominationUiSeat,
    onToggleLifeFromTile,
    onForceCameraOffFromTile,
    onForceMuteAll,
    handleHostTileClick,
  }
}
