/**
 * Generic game-room signaling message type constants (client side).
 *
 * Must stay in lock-step with `apps/server/src/signaling/gameRoomWsProtocol.ts`.
 * Mirrors only the GENERIC subset of the Mafia protocol — explicitly omits
 * Mafia-specific surfaces (mode-update, settings-update,
 * page-background-settings, role assignment inside reshuffle, and
 * `players-update.nightActions / clearRoles / oldMafiaMode`).
 *
 * Each side keeps its own copy because there is no shared protocol package
 * for call-signaling messages (same per-side pattern Mafia / Nadle / Checkers
 * already use). Do NOT delete or rename any literal — these are wire-format
 * identities that the server is also pinned to.
 */
export const GameRoomWs = {
    hostUpdated: 'gameroom:host-updated',
    claimHost: 'gameroom:claim-host',
    transferHost: 'gameroom:transfer-host',
    queueUpdate: 'gameroom:queue-update',
    /** Order-only generic reshuffle. No `role` field, unlike `mafia:reshuffle`. */
    reshuffle: 'gameroom:reshuffle',
    /** Generic players-update: `{ order, speakingQueue }`. No `nightActions`
     * / `clearRoles` / `oldMafiaMode`, unlike `mafia:players-update`. */
    playersUpdate: 'gameroom:players-update',
    playerNameUpdate: 'gameroom:player-name-update',
    playerNicknameUpdate: 'gameroom:player-nickname-update',
    audioMixUpdate: 'gameroom:audio-mix-update',
    timerStart: 'gameroom:timer-start',
    timerStop: 'gameroom:timer-stop',
    /**
     * Host-only: broadcast the next-Start preset selection so non-host
     * peers see the same idle duration the host has picked. Replayed on
     * join. Mirrors `mafia:timer-preset-select` and `eat:timer-preset-select`;
     * gated by `isGameRoomHostPeer` server-side.
     */
    timerPresetSelect: 'gameroom:timer-preset-select',
    playerKick: 'gameroom:player-kick',
    playerRevive: 'gameroom:player-revive',
    playerLifeState: 'gameroom:player-life-state',
    forceCameraOff: 'gameroom:force-camera-off',
    forceMuteAll: 'gameroom:force-mute-all',
    /** Server → client: per-peer mic-force side-effect of kick/revive.
     * Same semantics as `mafia:force-peer-mic`. */
    forcePeerMic: 'gameroom:force-peer-mic',
    /** Client → server: OBS / `?mode=view` reconnect recovery. */
    requestSnapshot: 'gameroom:request-snapshot',
};
