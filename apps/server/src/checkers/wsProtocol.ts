export const CheckersWs = {
  /** Client -> server: subscribe this socket to a room. */
  join: 'checkers:join',
  /** Client -> server: intent to move one piece. */
  move: 'checkers:move',
  /** Client -> server: reset the authoritative room state. */
  restart: 'checkers:restart',
  /** Client -> server: choose room interaction mode. */
  setMode: 'checkers:set-mode',
  /** Client -> server: mark this player ready/unready for private friend rooms. */
  ready: 'checkers:ready',
  /** Client -> server: update display-only player identity metadata. */
  identity: 'checkers:identity',
  /** Client -> server: current player ran out of time. */
  timeout: 'checkers:timeout',
  /** Client -> server: request a rematch in the same room. */
  rematch: 'checkers:rematch',
  /** Server -> client: full room snapshot after join/reconnect. */
  state: 'checkers:state',
  /** Server -> client: accepted authoritative state update. */
  update: 'checkers:update',
  /** Server -> client: non-fatal error. */
  error: 'checkers:error',
} as const
