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
  
  claimHost: 'mafia:claim-host',
  
  transferHost: 'mafia:transfer-host',
  
  queueUpdate: 'mafia:queue-update',
  
  reshuffle: 'mafia:reshuffle',
  
  playersUpdate: 'mafia:players-update',

  /**
   * Host-driven rename for Mafia UI.
   * Server applies it to the target peer's `displayName` and broadcasts
   * `peer-display-name` so every client updates via the normal call signaling path.
   */
  playerNameUpdate: 'mafia:player-name-update',

  /** Server → client: Mafia nickname override (label only, not identity). */
  playerNicknameUpdate: 'mafia:player-nickname-update',
  
  modeUpdate: 'mafia:mode-update',
  
  settingsUpdate: 'mafia:settings-update',
  
  pageBackgroundSettings: 'mafia:page-background-settings',
  /**
   * Host-only per-participant audio mix (volume + mute). Server validates host
   * authority via `isMafiaHostPeer`, stores the latest snapshot keyed by stable
   * `userId` when present (peerId fallback), and replays it to late joiners
   * (notably `?mode=view` OBS clients). Listening only — does not touch
   * mediasoup producer/consumer lifecycle; clients map this to the existing
   * `setRemoteListenVolume` / `setRemoteListenMuted` (call-core).
   */
  audioMixUpdate: 'mafia:audio-mix-update',
  
  timerStart: 'mafia:timer-start',
  
  timerStop: 'mafia:timer-stop',
  
  playerKick: 'mafia:player-kick',
  
  playerRevive: 'mafia:player-revive',
  
  playerLifeState: 'mafia:player-life-state',
  
  forceCameraOff: 'mafia:force-camera-off',
  
  forceMuteAll: 'mafia:force-mute-all',
  /**
   * Per-peer Mafia mic-force signal. Server-emitted only (no client→server
   * variant) as a side effect of `mafia:player-kick` / `mafia:player-revive`.
   * The target peer flips its local mic UI off when `muted: true` arrives;
   * `muted: false` clears any local "forced" hint but does NOT auto-unmute
   * the user's mic — the player must unmute manually after revive.
   */
  forcePeerMic: 'mafia:force-peer-mic',
  /**
   * Client → server: request the full Mafia state snapshot. Re-emits the
   * same snapshot block as `handleJoinRoom` to the requesting socket only.
   * Used by OBS / `?mode=view` clients on WS reconnect to recover state
   * without forcing a full reload. No host authority required: the snapshot
   * is read-only state already broadcast to the room.
   */
  requestSnapshot: 'mafia:request-snapshot',
} as const
