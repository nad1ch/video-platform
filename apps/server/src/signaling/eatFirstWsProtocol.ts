/**
 * Eat First signaling message type constants — server side.
 *
 * Audit #44: the server previously used string literals (`'eat:trait-revealed'`,
 * etc.) scattered across `messageHandlers.ts`, while the client kept its own
 * `EatFirstWs` constant in `apps/client/src/eat-first/eatFirstWsProtocol.ts`.
 * Either side could rename a string and the other side would silently no-op.
 * This module mirrors the client file so future server code can reference
 * names that the typechecker validates.
 *
 * The existing string literals in `messageHandlers.ts` are intentionally
 * left in place for minimum-diff; new code should import from here.
 */
export const EatFirstWs = {
  hostUpdated: 'eat:host-updated',
  forceMuteAll: 'eat:force-mute-all',
  reshuffleCameras: 'eat:reshuffle-cameras',
  slotClaim: 'eat:slot-claim',
  traitRevealRequest: 'eat:trait-reveal-request',
  traitRevealed: 'eat:trait-revealed',
  traitRegenerateRequest: 'eat:trait-regenerate-request',
  traitRegenerated: 'eat:trait-regenerated',
  traitTypeRerollRequest: 'eat:trait-type-reroll-request',
  traitTypeRerolled: 'eat:trait-type-rerolled',
  actionCardRerollRequest: 'eat:action-card-reroll-request',
  actionCardRerolled: 'eat:action-card-rerolled',
  actionCardUse: 'eat:action-card-use',
  actionCardUsed: 'eat:action-card-used',
  playersUpdate: 'eat:players-update',
  speakingQueueUpdate: 'eat:speaking-queue-update',
  tableRoundDeal: 'eat:table-round-deal',
  timerStart: 'eat:timer-start',
  timerStop: 'eat:timer-stop',
  timerPresetSelect: 'eat:timer-preset-select',
  traitStateSync: 'eat:trait-state-sync',
  tableStateSync: 'eat:table-state-sync',
  audioMixUpdate: 'eat:audio-mix-update',
} as const

export type EatFirstWsType = (typeof EatFirstWs)[keyof typeof EatFirstWs]
