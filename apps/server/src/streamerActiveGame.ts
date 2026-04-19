/**
 * Single active chat game per streamer for Twitch IRC routing (Wordle vs Gartic Show).
 * - `null` (missing): treat as Wordle for backward compatibility.
 * - `'wordle'`: Wordle handles guess-shaped messages.
 * - `'gartic-show'`: only Gartic ingest runs for that streamer.
 */
export type ActiveGameType = 'wordle' | 'gartic-show' | null

const activeByStreamer = new Map<string, Exclude<ActiveGameType, null>>()

export function getStreamerActiveGame(streamerId: string): ActiveGameType {
  return activeByStreamer.get(streamerId) ?? null
}

export function setStreamerActiveGame(streamerId: string, game: ActiveGameType): void {
  if (game === null) {
    activeByStreamer.delete(streamerId)
    return
  }
  activeByStreamer.set(streamerId, game)
}
