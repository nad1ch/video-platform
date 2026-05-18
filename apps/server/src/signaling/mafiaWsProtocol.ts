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

  /**
   * Legacy single-phase transfer-host wire name. Retained for backward
   * compatibility with any deployed client that may emit it; the server now
   * routes it through the two-phase consent path (see {@link transferHostOffer})
   * so consent cannot be bypassed.
   */
  transferHost: 'mafia:transfer-host',
  /**
   * Two-phase transfer-host consent (audit Finding I).
   *
   * Client → server: current host requests transfer to `targetUserId`.
   * Server validates host authority + target presence, creates a pending
   * offer in `mafiaTransferOfferStore`, and unicasts {@link transferHostPending}
   * to the target. The host change is applied only after the target sends
   * {@link transferHostAccept}.
   */
  transferHostOffer: 'mafia:transfer-host-offer',
  /**
   * Server → target peer: a pending transfer is awaiting accept/reject.
   * Payload carries the requesting host's userId, optional display name, and
   * the absolute `expiresAt` ms timestamp. The target peer surfaces this to
   * the user and replies with {@link transferHostAccept} or
   * {@link transferHostReject}. Auto-cancelled on disconnect or timeout.
   */
  transferHostPending: 'mafia:transfer-host-pending',
  /** Target → server: accept the pending offer (no payload). */
  transferHostAccept: 'mafia:transfer-host-accept',
  /** Target → server: reject the pending offer (no payload). */
  transferHostReject: 'mafia:transfer-host-reject',
  /**
   * Server → original host: outcome of a pending offer. `accepted` fires
   * alongside the normal {@link hostUpdated} broadcast; the host's tile loses
   * host UI as a side effect of the host-updated apply. `rejected` / `expired`
   * / `cancelled` leave host unchanged.
   */
  transferHostResult: 'mafia:transfer-host-result',
  
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

  /**
   * Host-only: live preset selection broadcast. Lets non-host peers
   * preview the upcoming start duration before the host presses Start,
   * and is replayed on join so OBS / late joiners see the same idle
   * value the host has picked. Mirrors `gameroom:timer-preset-select`
   * and `eat:timer-preset-select`; gated by `isMafiaHostPeer` server-side.
   */
  timerPresetSelect: 'mafia:timer-preset-select',
  
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
