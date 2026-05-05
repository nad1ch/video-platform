/**
 * Eat First signaling message type constants (client side).
 * Must stay in lock-step with server-side `eat:*` cases in socketServer.ts.
 */
export const EatFirstWs = {
  hostUpdated: 'eat:host-updated',
  forceMuteAll: 'eat:force-mute-all',
  reshuffleCameras: 'eat:reshuffle-cameras',
  traitRevealRequest: 'eat:trait-reveal-request',
  traitRevealed: 'eat:trait-revealed',
  traitRegenerateRequest: 'eat:trait-regenerate-request',
  traitRegenerated: 'eat:trait-regenerated',
  traitStateSync: 'eat:trait-state-sync',
} as const
