/** WebSocket pill state for the Twitch IRC relay UI. */
export type TwitchRelayChatWsStatus = 'idle' | 'open' | 'closed' | 'error'

/** One line in the relay chat feed (Wordle guesses + generic Twitch chat). */
export type TwitchRelayChatLine = {
  _cid: number
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
  cooldownMs?: number
  guessFeedback?: ('correct' | 'present' | 'absent')[]
  /** System / feedback line (no avatar row). */
  system?: boolean
}

/** @deprecated Use TwitchRelayChatLine */
export type WordleChatPanelLine = TwitchRelayChatLine

/** @deprecated Use TwitchRelayChatWsStatus */
export type WordleChatPanelWsStatus = TwitchRelayChatWsStatus
