/**
 * Nadraw signaling message type constants (client side).
 *
 * Mirror of `apps/server/src/nadraw-show/wsProtocol.ts`. Previously inlined
 * as an ad-hoc `WS` object inside a 659-line orchestrator file; hoisted
 * here so new code paths can reference the same namespaced string table
 * that Nadle / Checkers / Mafia already use on the client.
 *
 * Must stay in lock-step with the server copy — same pattern as the Nadle /
 * Checkers client-side per-side constants (there is no shared protocol
 * package for signaling strings, see the Batch-E.2 survey).
 */
export const NadrawWs = {
  state: 'nadraw:state',
  session: 'nadraw:session',
  twitchChat: 'nadraw:twitch-chat',
  guessFeedback: 'nadraw:guess-feedback',
  history: 'nadraw:history',
  draw: 'nadraw:draw',
  canvasClear: 'nadraw:canvas-clear',
  error: 'nadraw:error',
  ping: 'ping',
  hostStartRound: 'nadraw:host-start-round',
  hostAckNextRound: 'nadraw:host-ack-next-round',
  hostClearRound: 'nadraw:host-clear-round',
  hostClearCanvas: 'nadraw:host-clear-canvas',
  hostDraw: 'nadraw:host-draw',
} as const
