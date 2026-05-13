/**
 * Generic game-room signaling message type constants (server side).
 *
 * Parallel to {@link ./mafiaWsProtocol.ts MafiaWs} but for the
 * `gameroom:<base>` room-id namespace. Mirrors only the GENERIC subset of
 * the Mafia protocol — explicitly OMITS Mafia-specific surfaces:
 *
 *   - `mafia:mode-update`       (old/new mode is a Mafia game variant)
 *   - `mafia:settings-update`   (dead-background gallery is Mafia UI theming)
 *   - `mafia:page-background-settings` (page-background gallery is Mafia UI)
 *   - role assignment inside `mafia:reshuffle`
 *   - `mafia:players-update.nightActions / clearRoles / oldMafiaMode`
 *
 * The client maintains a matching copy at
 * `apps/client/src/composables/gameRoomWsProtocol.ts` (added in Phase 3B).
 * The two copies must stay in sync; the separate constants avoid an unwanted
 * server↔client import boundary crossing (same per-side pattern Mafia /
 * Nadle / Checkers already use).
 *
 * Do NOT delete or rename any literal. Each value is a wire-format identity
 * that the client is also pinned to.
 */
export const GameRoomWs = {
  /** Server → client / client → server: host authority updated. */
  hostUpdated: 'gameroom:host-updated',

  claimHost: 'gameroom:claim-host',

  transferHost: 'gameroom:transfer-host',

  queueUpdate: 'gameroom:queue-update',

  /**
   * Host-driven generic "new round / shuffle order" event. Payload is a
   * `string[]` of peerIds (seat ordering). No role assignment, unlike the
   * Mafia equivalent. Server clears every life-state and drops per-peer kill
   * enforcement (mirroring Mafia behaviour) so a fresh round starts clean.
   */
  reshuffle: 'gameroom:reshuffle',

  /**
   * Host-driven generic players-update: order + shared speaking queue.
   * The Mafia equivalent also carries `nightActions`, `clearRoles`,
   * `oldMafiaMode` — those are intentionally NOT part of the generic shape.
   */
  playersUpdate: 'gameroom:players-update',

  /** Host-driven rename. Server applies it to the target peer's `displayName`
   * and broadcasts `peer-display-name` via the existing call signaling path. */
  playerNameUpdate: 'gameroom:player-name-update',

  /** Server → client: nickname override (label only, not identity). */
  playerNicknameUpdate: 'gameroom:player-nickname-update',

  /**
   * Host-only per-participant audio mix (volume + mute). Same contract as
   * `mafia:audio-mix-update`: server validates host authority, stores keyed by
   * stable `userId` when present (peerId fallback), and replays it to late
   * joiners (notably `?mode=view` OBS clients). Listening only — does not
   * touch mediasoup producer/consumer lifecycle.
   */
  audioMixUpdate: 'gameroom:audio-mix-update',

  timerStart: 'gameroom:timer-start',

  timerStop: 'gameroom:timer-stop',

  playerKick: 'gameroom:player-kick',

  playerRevive: 'gameroom:player-revive',

  playerLifeState: 'gameroom:player-life-state',

  forceCameraOff: 'gameroom:force-camera-off',

  forceMuteAll: 'gameroom:force-mute-all',

  /**
   * Per-peer mic-force signal. Server-emitted only (no client→server variant)
   * as a side effect of `gameroom:player-kick` / `gameroom:player-revive`.
   * Same semantics as `mafia:force-peer-mic`.
   */
  forcePeerMic: 'gameroom:force-peer-mic',

  /**
   * Client → server: request the full game-room state snapshot. Re-emits the
   * same snapshot block as `handleJoinRoom` to the requesting socket only.
   * Used by OBS / `?mode=view` clients on WS reconnect to recover state
   * without forcing a full reload. No host authority required: the snapshot
   * is read-only state already broadcast to the room.
   */
  requestSnapshot: 'gameroom:request-snapshot',
} as const
