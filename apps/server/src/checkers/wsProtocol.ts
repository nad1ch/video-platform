export const CheckersWs = {
  /** Client -> server: subscribe this socket to a room. */
  join: 'checkers:join',
  
  move: 'checkers:move',
  
  restart: 'checkers:restart',
  
  setMode: 'checkers:set-mode',
  
  ready: 'checkers:ready',
  
  identity: 'checkers:identity',
  
  timeout: 'checkers:timeout',
  
  rematch: 'checkers:rematch',
  
  state: 'checkers:state',
  
  update: 'checkers:update',
  
  error: 'checkers:error',
} as const
