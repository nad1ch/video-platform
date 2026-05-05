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
  traitStateSync: 'eat:trait-state-sync',
} as const
