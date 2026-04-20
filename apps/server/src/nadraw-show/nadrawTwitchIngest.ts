import { handleNadrawChatGuess } from './nadrawGameStore'
import { saveNadrawPromptFromChat } from './nadrawPromptMutations'
import { broadcastNadrawTwitchChat } from './nadrawSocket'

/**
 * Fan-out from Twitch IRC: mirrors chat to Nadraw WebSocket clients and runs guess / `!add` logic.
 * Nadle continues to use the same IRC connection with its own handler (ordering: Nadraw first).
 */
export function ingestNadrawTwitchLine(params: {
  streamerId: string
  userId: string
  displayName: string
  text: string
}): void {
  const { streamerId, userId, displayName, text } = params
  broadcastNadrawTwitchChat(streamerId, { userId, displayName, text })
  const t = text.trim()
  const addMatch = /^!add\s+(.+)$/i.exec(t)
  if (addMatch) {
    void saveNadrawPromptFromChat(streamerId, userId, addMatch[1] ?? '').then(() => {
      /* optional: could broadcast system line */
    })
    return
  }
  handleNadrawChatGuess(streamerId, userId, displayName, text)
}
