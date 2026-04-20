/**
 * WebSocket message types for Nadraw (namespaced `nadraw:*`).
 */
export const NadrawWs = {
  state: 'nadraw:state',
  session: 'nadraw:session',
  twitchChat: 'nadraw:twitch-chat',
  guessFeedback: 'nadraw:guess-feedback',
  draw: 'nadraw:draw',
  canvasClear: 'nadraw:canvas-clear',
  error: 'nadraw:error',
  ping: 'ping',
  /** Client → server */
  hostStartRound: 'nadraw:host-start-round',
  hostAckNextRound: 'nadraw:host-ack-next-round',
  hostClearRound: 'nadraw:host-clear-round',
  /** Host: wipe drawing only; does not end the round or session. */
  hostClearCanvas: 'nadraw:host-clear-canvas',
  hostDraw: 'nadraw:host-draw',
} as const

export type GamePhase = 'idle' | 'drawing_locked' | 'drawing_active' | 'revealed' | 'between_rounds'

export type NadrawStatePayload = {
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
  /** Planned rounds in the current session (0 when no session / fully idle). */
  roundsPlanned: number
  /** Current round index 1..roundsPlanned during an active session (0 when no session). */
  roundNumber: number
  /** Word source for the whole session (only set while sessionPlanned > 0). */
  sessionWordSource?: 'random' | 'db' | 'manual'
  /** Last round had a winner (between_rounds / session-end break only). */
  breakHadWinner?: boolean
  breakWinnerDisplayName?: string
  /** All rounds in the session are done; host ack closes the session. */
  breakSessionFinished?: boolean
  /** Suggested next word; streamer-only. Editable before ack. */
  nextWordDraft?: string
  roundId: string
}
