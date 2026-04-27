export type MafiaRole = 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian'

export type MafiaPhase = 'night'

export type MafiaMode = 'old' | 'new'

/** Host night bookkeeping: which seat (1..N) each role’s night action points at. */
export type MafiaNightActionKey = 'mafia' | 'doctor' | 'sheriff' | 'don'

export type MafiaNightActions = Partial<Record<MafiaNightActionKey, number>>

/** Derived from `nightActions` (mafia vs doctor seat). */
export type MafiaLastNightResult = {
  died?: number
  saved?: boolean
}

/** Host: tile click for night actions, speaking queue, or seat swap. */
export type MafiaHostInteractionMode = 'night' | 'speaking' | 'swap'

/** Wire payload for `mafia:players-update` (host: seat swap / manual order, kept in sync for all). */
export type MafiaPlayersUpdatePayload = {
  order: string[]
  nightActions: MafiaNightActions
  speakingQueue: number[]
  clearRoles?: boolean
  oldMafiaMode?: boolean
}

/** Wire payload for `mafia:reshuffle` — one entry per player; `seat` is 1-based and must match index + 1. */
export type MafiaReshufflePlayer = {
  peerId: string
  seat: number
  role: MafiaRole
}

export type MafiaReshufflePayload = {
  players: MafiaReshufflePlayer[]
}

/** Shared Mafia round timer: wall-clock `startedAt` (epoch ms) + `duration` (ms); `isRunning` cleared by `mafia:timer-stop` / local stop. */
export type MafiaTimerState = {
  startedAt: number
  duration: number
  isRunning: boolean
}

export type MafiaTimerStartPayload = MafiaTimerState

/** Signaling: host clears the room timer (empty payload). */
export type MafiaTimerStopPayload = Record<string, never>

/** Signaling: host marks a player eliminated (`aliveByPeerId[peerId] = false`); all clients apply. */
export type MafiaPlayerKickPayload = { peerId: string }

/** Signaling: host revives a player (`aliveByPeerId[peerId] = true`); all clients apply. */
export type MafiaPlayerRevivePayload = { peerId: string }

export type MafiaModeUpdatePayload = { mode: MafiaMode }
