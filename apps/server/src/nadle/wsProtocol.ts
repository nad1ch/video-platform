/**
 * All nadle WebSocket frames use these `type` strings so they never collide
 * with other products on shared infrastructure.
 */
export const NadleWs = {
  /** Server → client: full public game snapshot */
  state: 'nadle:state',
  /** Server → client: ordered leaderboard */
  leaderboard: 'nadle:leaderboard',
  /** Server → client: one successful guess (row + meta) */
  userGuess: 'nadle:user-guess',
  /** Server → client: new round started */
  newGame: 'nadle:new-game',
  /** Server → client: Twitch chat relay line */
  twitchChat: 'nadle:twitch-chat',
  /** Server → client: Twitch IRC ingest link state (relay up/down for UX) */
  ircStatus: 'nadle:irc-status',
  /** Server → client: auth + admin flags */
  session: 'nadle:session',
  /** Server → client */
  error: 'nadle:error',
  /** Server → client */
  guessRejected: 'nadle:guess-rejected',
  /** Client → server */
  clientGuess: 'nadle:guess',
  /** Client → server */
  clientNextWord: 'nadle:next-word',
} as const
