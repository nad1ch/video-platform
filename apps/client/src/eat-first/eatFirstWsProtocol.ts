/**
 * Eat First signaling message type constants (client side).
 * Must stay in lock-step with server-side `eat:*` cases in socketServer.ts.
 */
export const EatFirstWs = {
  hostUpdated: 'eat:host-updated',
  forceMuteAll: 'eat:force-mute-all',
  reshuffleCameras: 'eat:reshuffle-cameras',
  /**
   * Per-call peer-to-slot binding. Sent client→server after `room-state` so
   * the SFU can map this call peerId to the authoritative Eat First slot
   * (`p1..p11`). Server validates the slot via `verifyEatFirstSlotAuth`
   * (joinToken+deviceId against `EatFirstPlayer.data`) before binding.
   */
  slotClaim: 'eat:slot-claim',
  traitRevealRequest: 'eat:trait-reveal-request',
  traitRevealed: 'eat:trait-revealed',
  traitRegenerateRequest: 'eat:trait-regenerate-request',
  traitRegenerated: 'eat:trait-regenerated',
  /** Host-only: reroll one trait type for every active slot in the room. */
  traitTypeRerollRequest: 'eat:trait-type-reroll-request',
  traitTypeRerolled: 'eat:trait-type-rerolled',
  /** Host-only: reroll the action card for one slot or for every active slot ('*'). */
  actionCardRerollRequest: 'eat:action-card-reroll-request',
  actionCardRerolled: 'eat:action-card-rerolled',
  /** Seat owner (or host): mark action card used; server broadcasts `eat:action-card-used` + table sync. */
  actionCardUse: 'eat:action-card-use',
  actionCardUsed: 'eat:action-card-used',
  playersUpdate: 'eat:players-update',
  /**
   * Host-only: DB reshuffle + deal full traits/action cards + reset reveal ledger fields,
   * then broadcast `eat:table-state-sync` (lower cube / table start).
   */
  /** Host-only: sync nomination queue to every peer (same shape as Mafia `mafia:queue-update`). */
  speakingQueueUpdate: 'eat:speaking-queue-update',
  tableRoundDeal: 'eat:table-round-deal',
  /** Host-only: speaking timer (milliseconds), mirrored in `eat:table-state-sync`. */
  timerStart: 'eat:timer-start',
  timerStop: 'eat:timer-stop',
  /**
   * Host-only: live preset selection so non-host peers see the same
   * idle timer duration the host has picked before pressing Start.
   * Replayed on join. Mirrors `mafia:timer-preset-select` and
   * `gameroom:timer-preset-select`; gated by `isEatFirstHostPeer`
   * server-side.
   */
  timerPresetSelect: 'eat:timer-preset-select',
  traitStateSync: 'eat:trait-state-sync',
  tableStateSync: 'eat:table-state-sync',
} as const
