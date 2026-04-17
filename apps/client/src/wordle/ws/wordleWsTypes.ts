import type { Feedback } from '../wordleLogic'

/** Browser WebSocket UI state for the Wordle stream room. */
export type WordleWsConnectionState = 'idle' | 'open' | 'closed' | 'error'

/** Twitch IRC relay status from server (`wordle:irc-status`). */
export type WordleIrcRelayState =
  | 'idle'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'connecting'
  | 'error'

/** Must match `apps/server/src/wordle/wsProtocol.ts` (WordleWs). */
export const WordleWs = {
  state: 'wordle:state',
  leaderboard: 'wordle:leaderboard',
  userGuess: 'wordle:user-guess',
  newGame: 'wordle:new-game',
  twitchChat: 'wordle:twitch-chat',
  ircStatus: 'wordle:irc-status',
  session: 'wordle:session',
  error: 'wordle:error',
  guessRejected: 'wordle:guess-rejected',
  clientGuess: 'wordle:guess',
  clientNextWord: 'wordle:next-word',
} as const

export type WordleGuessRow = { guess: string; feedback: Feedback[] }

export type WordleGamePlayer = {
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  rows: WordleGuessRow[]
}

export type WordleGameStatePayload = {
  gameId: string
  wordLength: number
  startedAt: number
  players: WordleGamePlayer[]
}

export type WordleLeaderboardEntry = {
  position: number
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  guessedAt?: number
}

export type WordleStreamSessionUser = {
  id: string
  display_name: string
  profile_image_url: string
}

export type WordleChatLine = {
  _cid: number
  userId: string
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
  cooldownMs?: number
  guessFeedback?: Feedback[]
}
