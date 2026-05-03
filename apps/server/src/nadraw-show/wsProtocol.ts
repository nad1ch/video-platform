


export const NadrawWs = {
  state: 'nadraw:state',
  session: 'nadraw:session',
  twitchChat: 'nadraw:twitch-chat',
  guessFeedback: 'nadraw:guess-feedback',
  history: 'nadraw:history',
  draw: 'nadraw:draw',
  canvasClear: 'nadraw:canvas-clear',
  error: 'nadraw:error',
  ping: 'ping',
  
  hostStartRound: 'nadraw:host-start-round',
  hostAckNextRound: 'nadraw:host-ack-next-round',
  hostClearRound: 'nadraw:host-clear-round',
  
  hostClearCanvas: 'nadraw:host-clear-canvas',
  hostDraw: 'nadraw:host-draw',
} as const

export type GamePhase = 'idle' | 'drawing_locked' | 'drawing_active' | 'revealed' | 'between_rounds'

export type NadrawStatePayload = {
  streamerId: string
  phase: GamePhase
  
  currentWord: string
  maskedWord: string
  winnerUserId?: string
  winnerDisplayName?: string
  startedAt: number
  unlockAt: number
  endsAt: number
  
  roundDurationSec: number
  
  roundsPlanned: number
  
  roundNumber: number
  
  sessionWordSource?: 'random' | 'db' | 'manual'
  
  breakHadWinner?: boolean
  breakWinnerDisplayName?: string
  
  breakSessionFinished?: boolean
  
  nextWordDraft?: string
  roundId: string
}
