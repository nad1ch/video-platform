/**
 * Mafia signaling message type constants (client side).
 *
 * Must stay in lock-step with `apps/server/src/signaling/mafiaWsProtocol.ts`.
 * Each side keeps its own copy because there is no shared protocol package
 * for call-signaling messages (matches the existing Nadle / Checkers
 * per-side pattern, see `apps/client/src/nadle/ws/nadleWsTypes.ts` and
 * `apps/client/src/features/checkers/ws/checkersWs.ts`).
 *
 * Previously these strings were inline in `useMafiaHostSignaling.ts` (23
 * occurrences) and `components/call/CallPage.vue` (2 ad-hoc constants).
 */
export const MafiaWs = {
  hostUpdated: 'mafia:host-updated',
  claimHost: 'mafia:claim-host',
  transferHost: 'mafia:transfer-host',
  queueUpdate: 'mafia:queue-update',
  reshuffle: 'mafia:reshuffle',
  playersUpdate: 'mafia:players-update',
  playerNameUpdate: 'mafia:player-name-update',
  playerNicknameUpdate: 'mafia:player-nickname-update',
  modeUpdate: 'mafia:mode-update',
  settingsUpdate: 'mafia:settings-update',
  pageBackgroundSettings: 'mafia:page-background-settings',
  audioMixUpdate: 'mafia:audio-mix-update',
  timerStart: 'mafia:timer-start',
  timerStop: 'mafia:timer-stop',
  /**
   * Host-only: broadcast the next-Start preset selection so non-host
   * peers and OBS / `?mode=view` clients see the same idle duration the
   * host has picked. Live state; not persisted in the timer ref —
   * server stores it in-memory on the Room and replays on join. Gated
   * by `isMafiaHostPeer` server-side.
   */
  timerPresetSelect: 'mafia:timer-preset-select',
  playerKick: 'mafia:player-kick',
  playerRevive: 'mafia:player-revive',
  playerLifeState: 'mafia:player-life-state',
  forceCameraOff: 'mafia:force-camera-off',
  forceMuteAll: 'mafia:force-mute-all',
  /** Server → client: per-peer mic-force side-effect of Mafia kill/revive. */
  forcePeerMic: 'mafia:force-peer-mic',
  /**
   * Client → server: request the full Mafia state snapshot (host, queue, mode,
   * settings, page background, life state, force-mute-all, per-peer effective
   * audio-muted, timer, reshuffle, players-update, nicknames, audio mix).
   *
   * Belt-and-suspenders for OBS / `?mode=view` clients whose WS may reconnect
   * without re-running `join-room` (transient flap, browser-source quirk).
   * Server replies with the same snapshot block it sends from `handleJoinRoom`
   * but addresses it to the requesting socket only. Idempotent on the client
   * (every message is an apply-from-signaling, never re-emit).
   */
  requestSnapshot: 'mafia:request-snapshot',
} as const
