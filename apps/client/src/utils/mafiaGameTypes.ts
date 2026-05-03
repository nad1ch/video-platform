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


export type MafiaNightActionKey = 'mafia' | 'doctor' | 'sheriff' | 'don'

export type MafiaNightActions = Partial<Record<MafiaNightActionKey, number>>


export type MafiaLastNightResult = {
  died?: number
  saved?: boolean
}


export type MafiaHostInteractionMode = 'night' | 'speaking' | 'swap'


export type MafiaPlayersUpdatePayload = {
  order: string[]
  nightActions: MafiaNightActions
  speakingQueue: number[]
  clearRoles?: boolean
  oldMafiaMode?: boolean
}


export type MafiaReshufflePlayer = {
  peerId: string
  seat: number
  role: MafiaRole
}

export type MafiaReshufflePayload = {
  players: MafiaReshufflePlayer[]
}


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
