
export type TwitchRelayChatWsStatus = 'idle' | 'open' | 'closed' | 'error'


export type TwitchRelayChatLine = {
  _cid: number
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
  cooldownMs?: number
  guessFeedback?: ('correct' | 'present' | 'absent')[]
  
  system?: boolean
}


export type NadleChatPanelLine = TwitchRelayChatLine


export type NadleChatPanelWsStatus = TwitchRelayChatWsStatus
