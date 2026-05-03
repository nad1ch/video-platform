/**
 * Mafia signaling message type constants (server side).
 *
 * Previously these were 49 inline `'mafia:*'` string literals scattered
 * through `messageHandlers.ts` (zod schemas, server-message union members,
 * broadcast helpers). Consolidating them here makes the protocol easy to
 * grep, keeps the literals identical, and lets future helpers reference
 * `MafiaWs.X` instead of copy-pasting strings.
 *
 * The client maintains its own matching copy at
 * `apps/client/src/composables/mafiaWsProtocol.ts`. Both sides must stay in
 * sync; the two separate constants avoid an unwanted server↔client import
 * boundary crossing (same pattern already used by Nadle/Checkers/Nadraw).
 */
export const MafiaWs = {
  /** Server → client / client → server: host authority updated. */
  hostUpdated: 'mafia:host-updated',
  /** Client → server: request to become host of this Mafia room. */
  claimHost: 'mafia:claim-host',
  /** Client → server (host only): hand off host role to another user. */
  transferHost: 'mafia:transfer-host',
  /** Server ↔ client: shared speaking queue (1-based seat indices). */
  queueUpdate: 'mafia:queue-update',
  /** Client → server (host only): round-start seat / role reshuffle snapshot. */
  reshuffle: 'mafia:reshuffle',
  /** Client → server (host only): per-round seat ordering + night actions. */
  playersUpdate: 'mafia:players-update',
  /** Server ↔ client: game mode ('old' / 'new'). */
  modeUpdate: 'mafia:mode-update',
  /** Client → server (host only): dead-player background library. */
  settingsUpdate: 'mafia:settings-update',
  /** Client → server (host only): page-wide background library. */
  pageBackgroundSettings: 'mafia:page-background-settings',
  /** Server ↔ client: shared round timer start (with `startedAt` / `duration`). */
  timerStart: 'mafia:timer-start',
  /** Server ↔ client: shared round timer stop. */
  timerStop: 'mafia:timer-stop',
  /** Client → server (host only): eliminate a player. */
  playerKick: 'mafia:player-kick',
  /** Client → server (host only): soft-revive a kicked player. */
  playerRevive: 'mafia:player-revive',
  /** Server → client: full per-player life state snapshot. */
  playerLifeState: 'mafia:player-life-state',
  /** Client → server (host only): force target peer's camera off. */
  forceCameraOff: 'mafia:force-camera-off',
  /** Client → server (host only): force all peers to mute. */
  forceMuteAll: 'mafia:force-mute-all',
} as const
