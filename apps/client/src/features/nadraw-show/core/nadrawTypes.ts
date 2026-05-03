export type NadrawGamePhase =
  | 'idle'
  | 'drawing_locked'
  | 'drawing_active'
  | 'revealed'
  | 'between_rounds'


export type NadrawRoundSetupWordSource = 'manual' | 'channel' | 'global'

export type NadrawStatePayload = {
  streamerId: string
  phase: NadrawGamePhase
  currentWord: string
  maskedWord: string
  winnerUserId?: string
  winnerDisplayName?: string
  startedAt: number
  unlockAt: number
  endsAt: number
  
  roundDurationSec?: number
  
  roundsPlanned?: number
  
  roundNumber?: number
  sessionWordSource?: 'random' | 'db' | 'manual'
  breakHadWinner?: boolean
  breakWinnerDisplayName?: string
  breakSessionFinished?: boolean
  
  nextWordDraft?: string
  roundId: string
}

export type NadrawChatLine = {
  id: string
  userId: string
  displayName: string
  text: string
  system?: boolean
}

export type NadrawGuessFeedbackPayload = {
  userId: string
  displayName: string
  text: string
  kind: 'rate_limit' | 'guess_locked' | 'heat' | 'win' | 'wrong'
  heat?: 'cold' | 'warm' | 'hot'
}
