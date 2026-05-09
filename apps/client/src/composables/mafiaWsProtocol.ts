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
  playerKick: 'mafia:player-kick',
  playerRevive: 'mafia:player-revive',
  playerLifeState: 'mafia:player-life-state',
  forceCameraOff: 'mafia:force-camera-off',
  forceMuteAll: 'mafia:force-mute-all',
} as const
