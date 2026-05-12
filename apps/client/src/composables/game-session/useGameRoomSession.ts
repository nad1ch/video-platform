/**
 * `useGameRoomSession` — canonical generic game-room session boundary.
 *
 * This is the **only** entry point pages and components should import to
 * obtain a game-room session. The shape returned here is the same regardless
 * of whether the implementation behind it is:
 *
 *   - the **temporary local fallback** (today: single-browser sessionStorage
 *     state; no cross-tab or cross-user coordination), or
 *   - a future **server-backed adapter** that subscribes to `gameroom:*`
 *     WS messages (host-updated, claim-host, players-update, timer, speaking
 *     queue) and produces the same reactive surface.
 *
 * The page-level UI and shared components (`<GameHostActionsBar>`,
 * `<GameSpeakingQueueBar>`, `<GameTimerOverlay>`) consume this interface and
 * are agnostic to the truth source.
 *
 * Backend gap (intentional):
 * --------------------------
 * Until a server-side game-room state block exists, this boundary delegates
 * to `useGameRoomTemporaryLocalAdapter`. The `isTemporaryLocalFallback` flag
 * on the return is `true` to let the page surface a clear "browser-local
 * only" banner. When the server adapter ships, the delegation in the body of
 * `useGameRoomSession` swaps to the server adapter and that flag becomes
 * `false` — no page changes required.
 */

import type { ComputedRef, Ref } from 'vue'
import type { SpeakingNominationSegment } from '@/utils/speakingNominationQueue'
import {
  useGameRoomTemporaryLocalAdapter,
  type GameInteractionMode,
  type GameTileEntry,
  type GameTileLifeState,
  type GameTileRole,
  type GameTimerState,
  type UseGameRoomTemporaryLocalAdapterDeps,
} from './useGameRoomTemporaryLocalAdapter'

// Re-export the public types so consumers import everything from a single
// module path.
export type {
  GameInteractionMode,
  GameTileEntry,
  GameTileLifeState,
  GameTileRole,
  GameTimerState,
}

export type UseGameRoomSessionDeps = UseGameRoomTemporaryLocalAdapterDeps

/**
 * Canonical generic game-room session contract. Any concrete adapter
 * (temporary-local or future server-backed) must implement this surface.
 */
export interface GameRoomSession {
  /**
   * `true` when host/player state comes from the browser-local fallback
   * (single tab, single browser, no server backing). Pages should surface
   * this with a visible banner so users understand the limitation. A
   * server-backed adapter will set this to `false`.
   */
  readonly isTemporaryLocalFallback: boolean

  // ---- Identity ----
  hostPeerId: Ref<string | null>
  isLocalUserHost: ComputedRef<boolean>
  isHostPeer: (peerId: string) => boolean

  // ---- Per-peer state ----
  byPeerId: Record<string, GameTileEntry>
  entryFor: (peerId: string) => GameTileEntry | null
  seatFor: (peerId: string) => number | null
  ensurePeer: (peerId: string) => void
  forgetPeer: (peerId: string) => void

  // ---- Ordering ----
  orderTilesHostLast: <T extends { peerId: string }>(
    tiles: readonly T[],
  ) => readonly T[]

  // ---- Host lifecycle (claim/release model — matches production Mafia) ----
  /** Promote `selfPeerId` to host iff `hostPeerId == null`. */
  claimHost: () => void
  /** Clear host iff the local user currently holds it. */
  releaseHost: () => void
  /** Direct host transfer (debug / future server-side admin tools). */
  setHost: (peerId: string | null) => void

  // ---- Host actions ----
  reshuffleSeats: () => void
  swapSeats: (peerA: string, peerB: string) => void
  kickPeer: (peerId: string) => void
  unkickPeer: (peerId: string) => void
  toggleLifeFor: (peerId: string) => void
  rotateRoleFor: (peerId: string) => void
  setMuteFor: (peerId: string, muted: boolean) => void
  toggleMuteAll: () => void
  setMuteAll: (muted: boolean) => void
  forceMuteAllActive: Ref<boolean>
  muteAllVisualActive: ComputedRef<boolean>

  // ---- Interaction mode ----
  interactionMode: Ref<GameInteractionMode>
  setInteractionMode: (mode: GameInteractionMode) => void
  swapSelectionPeerId: Ref<string | null>

  // ---- Speaking queue ----
  speakingQueue: Ref<number[]>
  speakingDraftSeat: Ref<number | null>
  speakingSegments: ComputedRef<readonly SpeakingNominationSegment[]>
  speakingTargetSeatSet: ComputedRef<ReadonlySet<number>>
  removeSpeakingPairAt: (pairIndex: number) => void
  clearSpeakingQueue: () => void
  speakingTileClick: (peerId: string) => void

  // ---- Combined tile click ----
  handleTileClick: (peerId: string) => void
  swapTileClick: (peerId: string) => void

  // ---- Timer ----
  timer: Ref<GameTimerState | null>
  startTimer: (durationMs: number) => void
  stopTimer: () => void

  // ---- Lifecycle ----
  resetAll: () => void
}

/**
 * Acquire the active game-room session for the current page. Today this
 * always returns the temporary local fallback; in the future, the body of
 * this function chooses between local and server adapters based on a
 * `gameRoomTransport` capability flag.
 */
export function useGameRoomSession(deps: UseGameRoomSessionDeps): GameRoomSession {
  const local = useGameRoomTemporaryLocalAdapter(deps)

  return {
    isTemporaryLocalFallback: true,

    // Identity
    hostPeerId: local.hostPeerId,
    isLocalUserHost: local.isLocalUserHost,
    isHostPeer: local.isHostPeer,

    // Per-peer
    byPeerId: local.byPeerId,
    entryFor: local.entryFor,
    seatFor: local.seatFor,
    ensurePeer: local.ensurePeer,
    forgetPeer: local.forgetPeer,

    // Ordering
    orderTilesHostLast: local.orderTilesHostLast,

    // Host lifecycle
    claimHost: local.claimHost,
    releaseHost: local.releaseHost,
    setHost: local.setHost,

    // Host actions
    reshuffleSeats: local.reshuffleSeats,
    swapSeats: local.swapSeats,
    kickPeer: local.kickPeer,
    unkickPeer: local.unkickPeer,
    toggleLifeFor: local.toggleLifeFor,
    rotateRoleFor: local.rotateRoleFor,
    setMuteFor: local.setMuteFor,
    toggleMuteAll: local.toggleMuteAll,
    setMuteAll: local.setMuteAll,
    forceMuteAllActive: local.forceMuteAllActive,
    muteAllVisualActive: local.muteAllVisualActive,

    // Interaction mode
    interactionMode: local.interactionMode,
    setInteractionMode: local.setInteractionMode,
    swapSelectionPeerId: local.swapSelectionPeerId,

    // Speaking queue
    speakingQueue: local.speakingQueue,
    speakingDraftSeat: local.speakingDraftSeat,
    speakingSegments: local.speakingSegments,
    speakingTargetSeatSet: local.speakingTargetSeatSet,
    removeSpeakingPairAt: local.removeSpeakingPairAt,
    clearSpeakingQueue: local.clearSpeakingQueue,
    speakingTileClick: local.speakingTileClick,

    // Combined click
    handleTileClick: local.handleTileClick,
    swapTileClick: local.swapTileClick,

    // Timer
    timer: local.timer,
    startTimer: local.startTimer,
    stopTimer: local.stopTimer,

    // Lifecycle
    resetAll: local.resetAll,
  }
}
