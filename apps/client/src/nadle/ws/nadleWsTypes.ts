import type { Feedback } from '../nadleLogic'

/** Browser WebSocket UI state for the nadle stream room. */
export type NadleWsConnectionState = 'idle' | 'open' | 'closed' | 'error'

/** Twitch IRC relay status from server (`nadle:irc-status`). */
export type NadleIrcRelayState =
  | 'idle'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'connecting'
  | 'error'

/** Must match `apps/server/src/nadle/wsProtocol.ts` (NadleWs). */
export const NadleWs = {
  state: 'nadle:state',
  leaderboard: 'nadle:leaderboard',
  userGuess: 'nadle:user-guess',
  newGame: 'nadle:new-game',
  twitchChat: 'nadle:twitch-chat',
  ircStatus: 'nadle:irc-status',
  session: 'nadle:session',
  error: 'nadle:error',
  guessRejected: 'nadle:guess-rejected',
  clientGuess: 'nadle:guess',
  clientNextWord: 'nadle:next-word',
} as const

export type NadleGuessRow = { guess: string; feedback: Feedback[] }

export type NadleGamePlayer = {
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  rows: NadleGuessRow[]
}

export type NadleGameStatePayload = {
  gameId: string
  wordLength: number
  startedAt: number
  players: NadleGamePlayer[]
}

export type NadleLeaderboardEntry = {
  position: number
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  guessedAt?: number
}

export type NadleStreamSessionUser = {
  id: string
  display_name: string
  profile_image_url: string
}

export type NadleChatLine = {
  _cid: number
  userId: string
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
  cooldownMs?: number
  guessFeedback?: Feedback[]
}
