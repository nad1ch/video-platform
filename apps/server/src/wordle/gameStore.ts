import { randomUUID } from 'node:crypto'
import type { Game, GameStatePayload, GuessRow, LeaderboardEntry, PlayerState, Store } from './types'
import type { PersistWordleRoundInput } from './persistRound'
import { computeFeedback, generateWord, isValidGuessShape, normalizeWord } from './wordleLogic'

const MAX_ATTEMPTS_PER_ROUND = 6

function newGame(): Game {
  const raw = generateWord()
  return {
    id: randomUUID(),
    word: normalizeWord(raw),
    startedAt: Date.now(),
  }
}

function createStore(): Store {
  return {
    currentGame: newGame(),
    players: {},
  }
}

let store: Store = createStore()

function playerToPublic(p: PlayerState): GameStatePayload['players'][number] {
  return {
    userId: p.userId,
    displayName: p.displayName,
    attempts: p.attempts,
    guessed: p.guessed,
    rows: p.rows,
  }
}

export function getCurrentWordLength(): number {
  return [...store.currentGame.word].length
}

export function getCurrentGameId(): string {
  return store.currentGame.id
}

export function getGameStatePayload(): GameStatePayload {
  const { currentGame, players } = store
  return {
    gameId: currentGame.id,
    wordLength: [...currentGame.word].length,
    startedAt: currentGame.startedAt,
    players: Object.values(players).map(playerToPublic),
  }
}

export function getLeaderboardPayload(): { entries: LeaderboardEntry[] } {
  const list = Object.values(store.players)
  list.sort((a, b) => {
    if (a.guessed !== b.guessed) {
      return a.guessed ? -1 : 1
    }
    if (a.attempts !== b.attempts) {
      return a.attempts - b.attempts
    }
    const atA = a.guessedAt ?? Number.POSITIVE_INFINITY
    const atB = b.guessedAt ?? Number.POSITIVE_INFINITY
    return atA - atB
  })
  const entries: LeaderboardEntry[] = list.map((p, i) => ({
    position: i + 1,
    userId: p.userId,
    displayName: p.displayName,
    attempts: p.attempts,
    guessed: p.guessed,
    guessedAt: p.guessedAt,
  }))
  return { entries }
}

export type GuessResult =
  | {
      ok: true
      gameId: string
      userId: string
      displayName: string
      guess: string
      feedback: GuessRow['feedback']
      attempts: number
      guessed: boolean
    }
  | { ok: false; reason: 'invalid_shape' | 'already_solved' | 'max_attempts' | 'wrong_game' }

export function submitGuess(
  userId: string,
  displayName: string,
  rawGuess: string,
  expectedGameId?: string,
): GuessResult {
  const game = store.currentGame
  if (expectedGameId !== undefined && expectedGameId !== game.id) {
    return { ok: false, reason: 'wrong_game' }
  }

  const guess = normalizeWord(rawGuess)
  const secretLen = [...game.word].length
  if ([...guess].length !== secretLen) {
    return { ok: false, reason: 'invalid_shape' }
  }
  if (!isValidGuessShape(guess, secretLen)) {
    return { ok: false, reason: 'invalid_shape' }
  }

  let p = store.players[userId]
  if (!p) {
    p = {
      userId,
      displayName,
      attempts: 0,
      guessed: false,
      rows: [],
    }
    store.players[userId] = p
  } else if (displayName && displayName !== p.displayName) {
    p.displayName = displayName
  }

  if (p.guessed) {
    return { ok: false, reason: 'already_solved' }
  }
  if (p.attempts >= MAX_ATTEMPTS_PER_ROUND) {
    return { ok: false, reason: 'max_attempts' }
  }

  const feedback = computeFeedback(game.word, guess)
  const row: GuessRow = { guess, feedback }
  p.rows.push(row)
  p.attempts += 1

  const win = [...feedback].every((x) => x === 'correct')
  if (win) {
    p.guessed = true
    p.guessedAt = Date.now()
  }

  return {
    ok: true,
    gameId: game.id,
    userId: p.userId,
    displayName: p.displayName,
    guess,
    feedback,
    attempts: p.attempts,
    guessed: p.guessed,
  }
}

export function adminStartNewGame(): { gameId: string; wordLength: number; startedAt: number } {
  store = {
    currentGame: newGame(),
    players: {},
  }
  const g = store.currentGame
  return {
    gameId: g.id,
    wordLength: [...g.word].length,
    startedAt: g.startedAt,
  }
}

/** Snapshot for DB persistence after a winning guess (in-memory store still holds all participants). */
export function buildWordleRoundPersistencePayload(winnerUserId: string): PersistWordleRoundInput | null {
  const w = String(winnerUserId ?? '').trim()
  if (!w) {
    return null
  }
  const players = Object.values(store.players)
  if (players.length === 0) {
    return null
  }
  return {
    winnerUserId: w,
    players: players.map((p) => ({
      userId: p.userId,
      attempts: p.attempts,
      isWinner: p.userId === w && p.guessed === true,
    })),
  }
}

