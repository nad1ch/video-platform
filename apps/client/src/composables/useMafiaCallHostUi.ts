import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { MafiaWs } from '@/composables/mafiaWsProtocol'
import type { useMafiaGameStore } from '@/stores/mafiaGame'
import {
  decodeSpeakingNominationFlat,
  nominationTargetSeatsFromSpeakingFlat,
} from '@/utils/speakingNominationQueue'
import type { MafiaEliminationBackground } from '@/utils/mafiaGameTypes'

/**
 * Mafia call-host UI composable (Phase 2 extraction from CallPage).
 *
 * Owns the host-side UI behaviour that drives the Mafia call grid:
 *   - thin outbound WS-send handlers (`mafia:force-mute-all`, `mafia:force-camera-off`)
 *   - thin Mafia store dispatchers (life toggle, elimination background)
 *   - host-side seat-highlight computeds for the tile-wrap class bindings
 *   - the "speaking-order hint" transient toast state machine
 *   - the host tile-click router (swap / speaking / night-action assignment) —
 *     Mafia branch only; the EatFirst branch of the original click handler
 *     remains in CallPage where the EatFirst state lives.
 *
 * The composable does NOT own:
 *   - any media/WebRTC state (call-core owns the orchestrator)
 *   - inbound WS dispatch (`useMafiaHostSignaling` owns that)
 *   - audio-mix host broadcast (`useMafiaAudioMixSignaling` owns that)
 *   - participant ordering (CallPage's `orderedTiles` owns that; this
 *     composable only consumes the resolved `mafiaNumberByPeer` map)
 *   - host identity (mafia store + `useMafiaHostSignaling` triple-gate)
 *
 * Behaviour preserved 1:1 from the original inline forms in CallPage. Every
 * branch, guard, toast key, and stop-propagation is reproduced verbatim.
 */

type MafiaGameStore = ReturnType<typeof useMafiaGameStore>

/** Minimal row shape accepted by `handleMafiaHostTileClick`. */
export interface MafiaCallTileRow {
  tile: { peerId: string }
}

export interface UseMafiaCallHostUiDeps {
  /** True when `route.name === 'mafia'`. */
  isMafiaRoute: Ref<boolean>
  /** True when the Mafia OBS/spectator UI is active (`?mode=view`). */
  mafiaViewUi: Ref<boolean>
  /** Current local peer id (call-core session). Used to forbid self force-camera-off. */
  selfPeerId: Ref<string | null | undefined>
  /** Mafia game store instance from CallPage's setup; reuse — do not re-instantiate. */
  mafiaGameStore: MafiaGameStore
  /** Resolved peerId → seat number map (Mafia-only; excludes host). */
  mafiaNumberByPeer: Ref<Map<string, number>>
  /** Call-core outbound signaling. */
  sendSignalingMessage: (msg: { type: string; payload: unknown }) => void
  /** CallPage toast pusher; the speak-hint and nomination collision toasts go through it. */
  pushCallToast: (text: string, kind?: 'join' | 'leave') => void
  /** i18n translator (same `t` CallPage uses). */
  t: (key: string, named?: Record<string, unknown>) => string
}

export interface UseMafiaCallHostUiReturn {
  /** Visibility ref for the "speaking order" host hint toast. */
  mafiaSpeakingOrderHintVisible: Ref<boolean>
  /** Tile-wrap class predicate: highlight night-action target seats. */
  isMafiaHostNightActionSeat: (seat: number | undefined) => boolean
  /** Tile-wrap class predicate: highlight queued speaking-nomination targets. */
  isMafiaHostSpeakingNominationUiSeat: (seat: number | undefined) => boolean
  /** `@mafia-toggle-life` handler from ParticipantTile (host-only life flip). */
  onMafiaToggleLifeFromTile: (peerId: string) => void
  /** `@mafia-force-camera-off` handler from ParticipantTile (host-only camera force). */
  onMafiaForceCameraOffFromTile: (peerId: string) => void
  /** `@force-mute-all` handler from `MafiaHostActionsBar`. */
  onMafiaForceMuteAll: (muted: boolean) => void
  /** `@mafia-set-elimination-background` handler from ParticipantTile. */
  onMafiaSetEliminationBackground: (payload: { peerId: string; background: MafiaEliminationBackground }) => void
  /** Mafia tile-click branch (swap / speaking / night-action). CallPage chains this after the EatFirst branch. */
  handleMafiaHostTileClick: (ev: MouseEvent, row: MafiaCallTileRow) => void
}

const MAFIA_FORCE_CAMERA_OFF_SIGNAL = MafiaWs.forceCameraOff
const MAFIA_FORCE_MUTE_ALL_SIGNAL = MafiaWs.forceMuteAll

/** Speak-hint visibility duration (ms); preserved from the original inline timer. */
const MAFIA_SPEAKING_HINT_VISIBLE_MS = 4500

export function useMafiaCallHostUi(
  deps: UseMafiaCallHostUiDeps,
): UseMafiaCallHostUiReturn {
  const {
    isMafiaRoute,
    mafiaViewUi,
    selfPeerId,
    mafiaGameStore,
    mafiaNumberByPeer,
    sendSignalingMessage,
    pushCallToast,
    t,
  } = deps

  // ---- Host-side seat-highlight computeds (drive the tile-wrap class bindings) ----

  const mafiaHostNightActionSeatSet = computed(() => {
    const a = mafiaGameStore.nightActions
    const s = new Set<number>()
    for (const x of [a.mafia, a.doctor, a.sheriff, a.don] as const) {
      if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
        s.add(x)
      }
    }
    return s
  })

  const mafiaHostSpeakingNominationTargetSeatSet = computed(() =>
    nominationTargetSeatsFromSpeakingFlat(mafiaGameStore.speakingQueue),
  )

  function isMafiaHostNightActionSeat(seat: number | undefined): boolean {
    if (seat == null) {
      return false
    }
    return mafiaHostNightActionSeatSet.value.has(seat)
  }

  function isMafiaHostSpeakingNominationUiSeat(seat: number | undefined): boolean {
    if (seat == null) {
      return false
    }
    return mafiaHostSpeakingNominationTargetSeatSet.value.has(seat)
  }

  // ---- Thin outbound handlers ----

  function onMafiaToggleLifeFromTile(peerId: string): void {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return
    }
    mafiaGameStore.hostToggleMafiaPlayerLife(peerId)
  }

  function onMafiaForceCameraOffFromTile(peerId: string): void {
    if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
      return
    }
    if (typeof peerId !== 'string' || peerId.length < 1 || peerId === selfPeerId.value) {
      return
    }
    sendSignalingMessage({ type: MAFIA_FORCE_CAMERA_OFF_SIGNAL, payload: { peerId } })
  }

  function onMafiaForceMuteAll(muted: boolean): void {
    if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
      return
    }
    sendSignalingMessage({ type: MAFIA_FORCE_MUTE_ALL_SIGNAL, payload: { muted } })
  }

  function onMafiaSetEliminationBackground(payload: { peerId: string; background: MafiaEliminationBackground }): void {
    mafiaGameStore.setPeerEliminationBackground(payload.peerId, payload.background)
  }

  // ---- Mafia tile-click router (swap / speaking / night-action) ----
  //
  // Mirrors the Mafia tail of the original `onMafiaHostTileClick` in CallPage,
  // line-for-line. The EatFirst branch of that function stays in CallPage; it
  // is not the Mafia composable's concern.

  function handleMafiaHostTileClick(ev: MouseEvent, row: MafiaCallTileRow): void {
    if (mafiaViewUi.value) {
      return
    }
    if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
      return
    }
    const clickTarget = ev.target
    if (clickTarget instanceof Element) {
      if (clickTarget.closest('button, input, textarea, a, [data-no-mafia-tile-host]')) {
        return
      }
      if (clickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
        return
      }
    }
    if (mafiaGameStore.hostInteractionMode === 'swap') {
      const pid = row.tile.peerId
      const sel = mafiaGameStore.hostSeatSwapSelectionPeerId
      if (sel == null) {
        mafiaGameStore.setSeatSwapSelectionPeerId(pid)
      } else if (sel === pid) {
        mafiaGameStore.setSeatSwapSelectionPeerId(null)
      } else {
        mafiaGameStore.swapSeatsByPeerId(sel, pid)
      }
      ev.stopPropagation()
      return
    }
    const seat = mafiaNumberByPeer.value.get(row.tile.peerId)
    if (seat == null) {
      return
    }
    if (mafiaGameStore.hostInteractionMode === 'speaking') {
      const draft = mafiaGameStore.speakingNominationDraftBySeat
      const segments = decodeSpeakingNominationFlat(mafiaGameStore.speakingQueue)
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
        mafiaGameStore.setSpeakingNominationDraftBySeat(seat)
      } else if (draft === seat) {
        mafiaGameStore.setSpeakingNominationDraftBySeat(null)
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
          mafiaGameStore.setSpeakingNominationDraftBySeat(null)
          ev.stopPropagation()
          return
        }
        mafiaGameStore.appendSpeakingNominationPair(draft, seat)
      }
    } else {
      mafiaGameStore.assignOrClearNightActionForActiveRole(seat)
    }
    ev.stopPropagation()
  }

  // ---- Speak-hint transient toast (host-only) ----
  //
  // Toggled on when the host enters `speaking` mode from any non-speaking
  // state; auto-clears after MAFIA_SPEAKING_HINT_VISIBLE_MS. The rendering of
  // the toast (`<div class="call-page__mafia-speak-hint">`) stays in
  // CallPage's `.call-page__toasts` stack — this composable only owns the
  // visibility ref and lifecycle.

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
    isMafiaHostNightActionSeat,
    isMafiaHostSpeakingNominationUiSeat,
    onMafiaToggleLifeFromTile,
    onMafiaForceCameraOffFromTile,
    onMafiaForceMuteAll,
    onMafiaSetEliminationBackground,
    handleMafiaHostTileClick,
  }
}
