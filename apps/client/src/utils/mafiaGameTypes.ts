export type MafiaRole = 'mafia' | 'don' | 'sheriff' | 'doctor' | 'civilian'

export type MafiaPhase = 'night'

export type MafiaMode = 'old' | 'new'

export type MafiaEliminationBackground = 'dark' | 'red' | 'violet' | 'gray'

export type MafiaPlayerLifeState = 'alive' | 'dead' | 'ghost'

export type MafiaPlayerOverlayState = {
  lifeState: MafiaPlayerLifeState
}

export type MafiaBackgroundItem = {
  id: string
  url: string
  type: 'preset' | 'custom'
}

export type MafiaGameSettings = {
  deadBackgrounds: MafiaBackgroundItem[]
  activeBackgroundId: string | null
}

export type MafiaSettingsUpdatePayload = MafiaGameSettings

export type BackgroundItem = {
  id: string
  url: string
  type: 'default' | 'preset' | 'custom'
}

export type UserVisualSettings = {
  selectedBackgroundId: string | null
}

export type MafiaRoomVisualSettings = {
  forcedBackgroundId: string | null
}

export type MafiaPageBackgroundSettings = UserVisualSettings & MafiaRoomVisualSettings & {
  backgrounds: BackgroundItem[]
}

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

/** Signaling: host marks a player eliminated (`lifeState = dead`); all clients apply. */
export type MafiaPlayerKickPayload = { peerId: string }

/** Signaling: host soft-revives a player (`lifeState = ghost`); camera stays off. */
export type MafiaPlayerRevivePayload = { peerId: string }

/** Signaling: late-join/reconnect catch-up for non-alive overlay state. Missing peers are alive. */
export type MafiaPlayerLifeStateSnapshotPayload = {
  states: Record<string, MafiaPlayerLifeState>
}

export type MafiaModeUpdatePayload = { mode: MafiaMode }
