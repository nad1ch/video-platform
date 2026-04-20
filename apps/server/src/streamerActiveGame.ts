/**
 * Single active chat game per streamer for Twitch IRC routing (nadle vs Nadraw).
 * - `null` (missing): treat as nadle for backward compatibility.
 * - `'nadle'`: nadle handles guess-shaped messages.
 * - `'nadraw-show'`: only Nadraw ingest runs for that streamer.
 */
export type ActiveGameType = 'nadle' | 'nadraw-show' | null

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
