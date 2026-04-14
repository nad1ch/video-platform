/**
 * All Wordle WebSocket frames use these `type` strings so they never collide
 * with other products on shared infrastructure.
 */
export const WordleWs = {
  /** Server → client: full public game snapshot */
  state: 'wordle:state',
  /** Server → client: ordered leaderboard */
  leaderboard: 'wordle:leaderboard',
  /** Server → client: one successful guess (row + meta) */
  userGuess: 'wordle:user-guess',
  /** Server → client: new round started */
  newGame: 'wordle:new-game',
  /** Server → client: Twitch chat relay line */
  twitchChat: 'wordle:twitch-chat',
  /** Server → client: auth + admin flags */
  session: 'wordle:session',
  /** Server → client */
  error: 'wordle:error',
  /** Server → client */
  guessRejected: 'wordle:guess-rejected',
  /** Client → server */
  clientGuess: 'wordle:guess',
  /** Client → server */
  clientNextWord: 'wordle:next-word',
} as const
