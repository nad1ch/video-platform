import {
  applyCheckersMove,
  createInitialCheckersState,
  getLegalMoves,
  normalizeCheckersState,
  type CheckersPosition,
  type CheckersMove,
  type CheckersState,
} from 'checkers-core'

export type CheckersBotDifficulty = 'easy' | 'medium' | 'hard'

const rooms = new Map<string, CheckersState>()

function ensureRoom(roomId: string): CheckersState {
  const existing = rooms.get(roomId)
  if (existing) {
    return existing
  }
  const state = createInitialCheckersState()
  rooms.set(roomId, state)
  return state
}

export function getCheckersState(roomId: string): CheckersState {
  const state = ensureRoom(roomId)
  const normalized = normalizeCheckersState(state)
  if (normalized !== state) {
    rooms.set(roomId, normalized)
  }
  return normalized
}

export function setCheckersState(roomId: string, state: CheckersState): CheckersState {
  const normalized = normalizeCheckersState(state)
  rooms.set(roomId, normalized)
  return normalized
}

export function applyCheckersRoomMove(
  roomId: string,
  move: Pick<CheckersMove, 'from' | 'to'>,
  revision?: number,
): { ok: true; state: CheckersState } | { ok: false; reason: 'stale-revision' | 'invalid-move'; state: CheckersState } {
  const current = getCheckersState(roomId)
  if (typeof revision === 'number' && Number.isFinite(revision) && revision !== current.revision) {
    return { ok: false, reason: 'stale-revision', state: current }
  }
  const result = applyCheckersMove(current, move)
  if (!result.ok) {
    return { ok: false, reason: result.reason, state: result.state }
  }
  rooms.set(roomId, result.state)
  return { ok: true, state: result.state }
}

export function restartCheckersRoom(roomId: string): CheckersState {
  const current = getCheckersState(roomId)
  const next = createInitialCheckersState()
  next.revision = current.revision + 1
  rooms.set(roomId, next)
  return next
}

export function timeoutCheckersRoomTurn(roomId: string, revision?: number): CheckersState {
  const current = getCheckersState(roomId)
  if (typeof revision === 'number' && Number.isFinite(revision) && revision !== current.revision) {
    return current
  }
  if (current.winner) {
    return current
  }
  const next: CheckersState = {
    ...current,
    turn: current.turn === 'player1' ? 'player2' : 'player1',
    forcedFrom: null,
    revision: current.revision + 1,
  }
  rooms.set(roomId, next)
  return next
}

export function chooseCheckersBotMove(
  roomId: string,
  difficulty: CheckersBotDifficulty = 'medium',
): Pick<CheckersMove, 'from' | 'to'> | null {
  const state = getCheckersState(roomId)
  if (state.winner) {
    return null
  }
  const moves = getLegalMoves(state)
  if (moves.length === 0) {
    return null
  }
  if (difficulty === 'easy') {
    const move = moves[Math.floor(Math.random() * moves.length)]
    return move ? { from: move.from, to: move.to } : null
  }
  const scored = moves.map((move) => {
    const result = applyCheckersMove(state, move)
    if (!result.ok) {
      return { move, score: -1_000 }
    }
    let score = Math.random()
    if (move.captured) score += difficulty === 'hard' ? 120 : 80
    if (result.state.forcedFrom && result.state.turn === state.turn) score += difficulty === 'hard' ? 45 : 20
    if (move.promotion) score += difficulty === 'hard' ? 30 : 10
    if (difficulty === 'hard' && isMovedPieceImmediatelyCapturable(result.state, move.to)) score -= 35
    return { move, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const move = scored[0]?.move
  return move ? { from: move.from, to: move.to } : null
}

function samePosition(a: CheckersPosition, b: CheckersPosition): boolean {
  return a.row === b.row && a.col === b.col
}

function isMovedPieceImmediatelyCapturable(state: CheckersState, movedTo: CheckersPosition): boolean {
  return getLegalMoves(state).some((move) => move.captured && samePosition(move.captured, movedTo))
}
