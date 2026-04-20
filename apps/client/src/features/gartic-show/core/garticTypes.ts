export type GarticGamePhase =
  | 'idle'
  | 'drawing_locked'
  | 'drawing_active'
  | 'revealed'
  | 'between_rounds'

/** UI word source for round setup (maps to server: manual / db / random). */
export type GarticRoundSetupWordSource = 'manual' | 'channel' | 'global'

export type GarticStatePayload = {
  streamerId: string
  phase: GarticGamePhase
  currentWord: string
  maskedWord: string
  winnerUserId?: string
  winnerDisplayName?: string
  startedAt: number
  unlockAt: number
  endsAt: number
  /** Present on newer servers; seconds for full round window. */
  roundDurationSec?: number
  /** Total rounds in the current multi-round session (0 = no session). */
  roundsPlanned?: number
  /** Current round index 1..roundsPlanned while session active. */
  roundNumber?: number
  sessionWordSource?: 'random' | 'db' | 'manual'
  breakHadWinner?: boolean
  breakWinnerDisplayName?: string
  breakSessionFinished?: boolean
  /** Streamer control only; suggested word for the next round while `between_rounds`. */
  nextWordDraft?: string
  roundId: string
}

export type GarticChatLine = {
  id: string
  userId: string
  displayName: string
  text: string
  system?: boolean
}

export type GarticGuessFeedbackPayload = {
  userId: string
  displayName: string
  text: string
  kind: 'rate_limit' | 'guess_locked' | 'heat' | 'win' | 'wrong'
  heat?: 'cold' | 'warm' | 'hot'
}
