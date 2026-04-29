import { describe, expect, it } from 'vitest'
import {
  applyCheckersMove,
  createInitialCheckersState,
  getLegalMoves,
  getValidMove,
  type CheckersBoard,
  type CheckersState,
} from '../../apps/client/src/features/checkers/core/checkersEngine'

function emptyBoard(): CheckersBoard {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null))
}

function stateWith(board: CheckersBoard, turn: CheckersState['turn'] = 'player1'): CheckersState {
  return {
    board,
    turn,
    captured: { player1: 0, player2: 0 },
    forcedFrom: null,
    winner: null,
    revision: 0,
  }
}

describe('checkers engine', () => {
  it('creates the standard 8x8 starting position', () => {
    const state = createInitialCheckersState()
    const pieces = state.board.flat().filter(Boolean)

    expect(state.board).toHaveLength(8)
    expect(state.board.every((row) => row.length === 8)).toBe(true)
    expect(pieces.filter((piece) => piece?.player === 'player1')).toHaveLength(12)
    expect(pieces.filter((piece) => piece?.player === 'player2')).toHaveLength(12)
    expect(state.turn).toBe('player1')
  })

  it('allows a regular forward diagonal move', () => {
    const state = createInitialCheckersState()
    const result = applyCheckersMove(state, { from: { row: 5, col: 0 }, to: { row: 4, col: 1 } })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.board[5][0]).toBeNull()
    expect(result.state.board[4][1]?.player).toBe('player1')
    expect(result.state.turn).toBe('player2')
  })

  it('requires captures when any capture is available', () => {
    const board = emptyBoard()
    board[5][0] = { player: 'player1', king: false }
    board[4][1] = { player: 'player2', king: false }
    board[5][4] = { player: 'player1', king: false }
    const state = stateWith(board)

    expect(getValidMove(state, { row: 5, col: 4 }, { row: 4, col: 5 })).toBeNull()
    expect(getValidMove(state, { row: 5, col: 0 }, { row: 3, col: 2 })?.captured).toEqual({
      row: 4,
      col: 1,
    })
  })

  it('keeps the same turn during a mandatory multi-capture', () => {
    const board = emptyBoard()
    board[5][0] = { player: 'player1', king: false }
    board[4][1] = { player: 'player2', king: false }
    board[2][3] = { player: 'player2', king: false }
    const state = stateWith(board)

    const first = applyCheckersMove(state, { from: { row: 5, col: 0 }, to: { row: 3, col: 2 } })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.state.turn).toBe('player1')
    expect(first.state.forcedFrom).toEqual({ row: 3, col: 2 })
    expect(getLegalMoves(first.state)).toEqual([
      {
        from: { row: 3, col: 2 },
        to: { row: 1, col: 4 },
        captured: { row: 2, col: 3 },
        promotion: false,
      },
    ])

    const second = applyCheckersMove(first.state, { from: { row: 3, col: 2 }, to: { row: 1, col: 4 } })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.state.turn).toBe('player2')
    expect(second.state.forcedFrom).toBeNull()
    expect(second.state.captured.player1).toBe(2)
  })

  it('promotes pieces that reach the back row', () => {
    const board = emptyBoard()
    board[1][2] = { player: 'player1', king: false }
    board[6][5] = { player: 'player2', king: false }

    const player1 = applyCheckersMove(stateWith(board), { from: { row: 1, col: 2 }, to: { row: 0, col: 1 } })
    expect(player1.ok).toBe(true)
    if (!player1.ok) return
    expect(player1.state.board[0][1]?.king).toBe(true)

    const player2 = applyCheckersMove(
      { ...player1.state, turn: 'player2', winner: null },
      { from: { row: 6, col: 5 }, to: { row: 7, col: 4 } },
    )
    expect(player2.ok).toBe(true)
    if (!player2.ok) return
    expect(player2.state.board[7][4]?.king).toBe(true)
  })
})
