export type CheckersPlayer = 'player1' | 'player2'

export type CheckersPosition = {
  row: number
  col: number
}

export type CheckersPiece = {
  player: CheckersPlayer
  king: boolean
}

export type CheckersCell = CheckersPiece | null

export type CheckersBoard = CheckersCell[][]

export type CheckersMove = {
  from: CheckersPosition
  to: CheckersPosition
  captured?: CheckersPosition
  promotion?: boolean
}

export type CheckersState = {
  board: CheckersBoard
  turn: CheckersPlayer
  captured: Record<CheckersPlayer, number>
  forcedFrom: CheckersPosition | null
  winner: CheckersPlayer | null
  revision: number
}

export type ApplyCheckersMoveResult =
  | { ok: true; move: CheckersMove; state: CheckersState }
  | { ok: false; reason: 'invalid-move'; state: CheckersState }

export function createInitialCheckersState(): CheckersState
export function normalizeCheckersState(state: unknown): CheckersState
export function getLegalMoves(state: CheckersState, from?: CheckersPosition): CheckersMove[]
export function getValidMove(
  state: CheckersState,
  from: CheckersPosition,
  to: CheckersPosition,
): CheckersMove | null
export function applyCheckersMove(state: CheckersState, move: Partial<CheckersMove>): ApplyCheckersMoveResult
export function isSameCheckersPosition(a: CheckersPosition | null | undefined, b: CheckersPosition | null | undefined): boolean
