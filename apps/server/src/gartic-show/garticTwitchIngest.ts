import { handleGarticChatGuess } from './garticGameStore'
import { saveGarticPromptFromChat } from './garticPromptMutations'
import { broadcastGarticTwitchChat } from './garticSocket'

/**
 * Fan-out from Twitch IRC: mirrors chat to Gartic WebSocket clients and runs guess / `!add` logic.
 * Wordle continues to use the same IRC connection with its own handler (ordering: Gartic first).
 */
export function ingestGarticTwitchLine(params: {
  streamerId: string
  userId: string
  displayName: string
  text: string
}): void {
  const { streamerId, userId, displayName, text } = params
  broadcastGarticTwitchChat(streamerId, { userId, displayName, text })
  const t = text.trim()
  const addMatch = /^!add\s+(.+)$/i.exec(t)
  if (addMatch) {
    void saveGarticPromptFromChat(streamerId, userId, addMatch[1] ?? '').then(() => {
      /* optional: could broadcast system line */
    })
    return
  }
  handleGarticChatGuess(streamerId, userId, displayName, text)
}
