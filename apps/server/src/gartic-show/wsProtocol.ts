/**
 * WebSocket message types for Gartic Show (namespaced `gartic:*`).
 */
export const GarticWs = {
  state: 'gartic:state',
  session: 'gartic:session',
  twitchChat: 'gartic:twitch-chat',
  guessFeedback: 'gartic:guess-feedback',
  draw: 'gartic:draw',
  canvasClear: 'gartic:canvas-clear',
  error: 'gartic:error',
  ping: 'ping',
  /** Client → server */
  hostStartRound: 'gartic:host-start-round',
  hostClearRound: 'gartic:host-clear-round',
  hostDraw: 'gartic:host-draw',
} as const

export type GamePhase = 'idle' | 'drawing_locked' | 'drawing_active' | 'revealed'

export type GarticStatePayload = {
  streamerId: string
  phase: GamePhase
  /** Full secret word — only streamer control connections receive this while the round is active. */
  currentWord: string
  maskedWord: string
  winnerUserId?: string
  winnerDisplayName?: string
  startedAt: number
  unlockAt: number
  endsAt: number
  /** Round max length in seconds (0 when idle); for UI context next to countdown. */
  roundDurationSec: number
  /** Planned rounds count from host (0 when idle). */
  roundsPlanned: number
  roundId: string
}
