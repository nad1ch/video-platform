const BOARD_SIZE = 8
const PLAYER_1 = 'player1'
const PLAYER_2 = 'player2'

function otherPlayer(player) {
  return player === PLAYER_1 ? PLAYER_2 : PLAYER_1
}

function inBounds(pos) {
  return (
    Number.isInteger(pos?.row) &&
    Number.isInteger(pos?.col) &&
    pos.row >= 0 &&
    pos.row < BOARD_SIZE &&
    pos.col >= 0 &&
    pos.col < BOARD_SIZE
  )
}

function isDarkSquare(pos) {
  return inBounds(pos) && (pos.row + pos.col) % 2 === 1
}

function samePos(a, b) {
  return a.row === b.row && a.col === b.col
}

function clonePiece(piece) {
  return piece ? { player: piece.player, king: piece.king === true } : null
}

function cloneBoard(board) {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => clonePiece(board?.[row]?.[col] ?? null)),
  )
}

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null))
}

function normalizeBoard(board) {
  const next = emptyBoard()
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board?.[row]?.[col]
      if (
        piece &&
        (piece.player === PLAYER_1 || piece.player === PLAYER_2) &&
        isDarkSquare({ row, col })
      ) {
        next[row][col] = clonePiece(piece)
      }
    }
  }
  return next
}

function directionsFor(piece) {
  const dirs = []
  if (piece.king || piece.player === PLAYER_1) {
    dirs.push([-1, -1], [-1, 1])
  }
  if (piece.king || piece.player === PLAYER_2) {
    dirs.push([1, -1], [1, 1])
  }
  return dirs
}

function promotionRow(player) {
  return player === PLAYER_1 ? 0 : BOARD_SIZE - 1
}

function movePromotes(piece, to) {
  return !piece.king && to.row === promotionRow(piece.player)
}

function getPieceMoves(board, from, capturesOnly) {
  if (!inBounds(from)) {
    return []
  }
  const piece = board[from.row]?.[from.col]
  if (!piece) {
    return []
  }
  const moves = []
  for (const [dr, dc] of directionsFor(piece)) {
    const mid = { row: from.row + dr, col: from.col + dc }
    const landing = { row: from.row + dr * 2, col: from.col + dc * 2 }
    const adjacent = board[mid.row]?.[mid.col]
    if (inBounds(landing) && adjacent?.player === otherPlayer(piece.player) && !board[landing.row]?.[landing.col]) {
      moves.push({
        from: { row: from.row, col: from.col },
        to: landing,
        captured: mid,
        promotion: movePromotes(piece, landing),
      })
    }
    if (capturesOnly) {
      continue
    }
    const simple = mid
    if (inBounds(simple) && isDarkSquare(simple) && !board[simple.row]?.[simple.col]) {
      moves.push({
        from: { row: from.row, col: from.col },
        to: simple,
        promotion: movePromotes(piece, simple),
      })
    }
  }
  return moves
}

function captureMovesForPlayer(board, player) {
  const moves = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col]
      if (piece?.player === player) {
        moves.push(...getPieceMoves(board, { row, col }, true))
      }
    }
  }
  return moves
}

function countPieces(board) {
  const pieces = { player1: 0, player2: 0 }
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        pieces[piece.player] += 1
      }
    }
  }
  return pieces
}

function getLegalMovesForNormalized(normalized, from) {
  const board = normalized.board
  const forcedFrom = normalized.forcedFrom
  if (forcedFrom) {
    if (from && !samePos(from, forcedFrom)) {
      return []
    }
    const piece = board[forcedFrom.row]?.[forcedFrom.col]
    if (piece?.player !== normalized.turn) {
      return []
    }
    return getPieceMoves(board, forcedFrom, true)
  }

  const captureMoves = captureMovesForPlayer(board, normalized.turn)
  if (captureMoves.length > 0) {
    return from ? captureMoves.filter((move) => samePos(move.from, from)) : captureMoves
  }
  if (from) {
    const piece = board[from.row]?.[from.col]
    if (piece?.player !== normalized.turn) {
      return []
    }
    return getPieceMoves(board, from, false).filter((move) => !move.captured)
  }

  const moves = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col]
      if (piece?.player === normalized.turn) {
        moves.push(...getPieceMoves(board, { row, col }, false).filter((move) => !move.captured))
      }
    }
  }
  return moves
}

function withWinner(state) {
  const pieces = countPieces(state.board)
  if (pieces.player1 === 0) {
    return { ...state, winner: PLAYER_2 }
  }
  if (pieces.player2 === 0) {
    return { ...state, winner: PLAYER_1 }
  }
  if (getLegalMovesForNormalized({ ...state, winner: null }, undefined).length === 0) {
    return { ...state, winner: otherPlayer(state.turn) }
  }
  return { ...state, winner: null }
}

export function createInitialCheckersState() {
  const board = emptyBoard()
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!isDarkSquare({ row, col })) {
        continue
      }
      if (row <= 2) {
        board[row][col] = { player: PLAYER_2, king: false }
      } else if (row >= 5) {
        board[row][col] = { player: PLAYER_1, king: false }
      }
    }
  }
  return {
    board,
    turn: PLAYER_1,
    captured: { player1: 0, player2: 0 },
    forcedFrom: null,
    winner: null,
    revision: 0,
  }
}

export function normalizeCheckersState(state) {
  const board = normalizeBoard(state?.board)
  const turn = state?.turn === PLAYER_2 ? PLAYER_2 : PLAYER_1
  const forcedFrom = inBounds(state?.forcedFrom) ? { row: state.forcedFrom.row, col: state.forcedFrom.col } : null
  const captured = {
    player1: Math.max(0, Math.floor(Number(state?.captured?.player1) || 0)),
    player2: Math.max(0, Math.floor(Number(state?.captured?.player2) || 0)),
  }
  const revision = Math.max(0, Math.floor(Number(state?.revision) || 0))
  return withWinner({
    board,
    turn,
    captured,
    forcedFrom,
    winner: state?.winner === PLAYER_1 || state?.winner === PLAYER_2 ? state.winner : null,
    revision,
  })
}

export function getLegalMoves(state, from) {
  const normalized = normalizeCheckersState(state)
  if (normalized.winner) {
    return []
  }
  return getLegalMovesForNormalized(normalized, from)
}

export function getValidMove(state, from, to) {
  if (!inBounds(from) || !inBounds(to) || !isDarkSquare(to)) {
    return null
  }
  return getLegalMoves(state, from).find((move) => samePos(move.to, to)) ?? null
}

export function applyCheckersMove(state, move) {
  const current = normalizeCheckersState(state)
  const valid = getValidMove(current, move?.from, move?.to)
  if (!valid) {
    return { ok: false, reason: 'invalid-move', state: current }
  }

  const board = cloneBoard(current.board)
  const piece = board[valid.from.row][valid.from.col]
  board[valid.from.row][valid.from.col] = null
  if (valid.captured) {
    board[valid.captured.row][valid.captured.col] = null
  }
  const promotedPiece = { player: piece.player, king: piece.king || valid.promotion === true }
  board[valid.to.row][valid.to.col] = promotedPiece

  const captured = { ...current.captured }
  if (valid.captured) {
    captured[piece.player] += 1
  }

  let turn = otherPlayer(current.turn)
  let forcedFrom = null
  if (valid.captured && !valid.promotion) {
    const moreCaptures = getPieceMoves(board, valid.to, true)
    if (moreCaptures.length > 0) {
      turn = current.turn
      forcedFrom = { row: valid.to.row, col: valid.to.col }
    }
  }

  const next = withWinner({
    board,
    turn,
    captured,
    forcedFrom,
    winner: null,
    revision: current.revision + 1,
  })
  return { ok: true, move: valid, state: next }
}

export function isSameCheckersPosition(a, b) {
  return inBounds(a) && inBounds(b) && samePos(a, b)
}
