import { randomUUID } from 'node:crypto'
import type { Game, GameStatePayload, GuessRow, LeaderboardEntry, PlayerState, Store } from './types'
import type { PersistNadleRoundInput } from './persistRound'
import {
  computeFeedback,
  generateWord,
  isAllowedGuess,
  isValidGuessShape,
  normalizeWord,
  normalizeWordLength,
  wordGraphemeCount,
  type NadleWordLength,
} from './nadleLogic'
import { setStreamerActiveGame } from '../streamerActiveGame'
import { loadNadleLiveGame, persistNadleLiveGame } from './liveGamePersistence'

const MAX_ATTEMPTS_PER_ROUND = 6

const stores = new Map<string, Store>()
const hydratedStores = new Set<string>()
const hydrationByStreamer = new Map<string, Promise<void>>()

function isSupportedWordLength(word: string): boolean {
  const len = wordGraphemeCount(word)
  return len === 5 || len === 6 || len === 7
}

/**
 * In-memory accessor. MUST NOT write to the DB here.
 *
 * `hydrateNadleLiveGame` owns the "persist a default when no row exists"
 * side-effect. Persisting from `storeFor` used to race against hydration:
 * if a WS message arrived before hydration resolved, this would overwrite
 * the persisted round with a fresh default. The defensive in-memory
 * default still guards against a crash if a caller forgets to hydrate —
 * subsequent mutation helpers (`submitGuess`, `startPlayerNewGame`) call
 * `persistNadleLiveGame` themselves after the mutation, which reconciles
 * state once hydration completes.
 */
function storeFor(streamerId: string): Store {
  let s = stores.get(streamerId)
  if (s && !isSupportedWordLength(s.currentGame.word)) {
    s = createStore()
    stores.set(streamerId, s)
  }
  if (!s) {
    s = createStore()
    stores.set(streamerId, s)
  }
  return s
}

export async function hydrateNadleLiveGame(streamerId: string): Promise<void> {
  if (hydratedStores.has(streamerId)) {
    return
  }
  const existing = hydrationByStreamer.get(streamerId)
  if (existing) {
    await existing
    return
  }
  const pending = (async () => {
    const persisted = await loadNadleLiveGame(streamerId)
    if (persisted && isSupportedWordLength(persisted.currentGame.word)) {
      stores.set(streamerId, persisted)
    } else if (!stores.has(streamerId)) {
      stores.set(streamerId, createStore())
      persistNadleLiveGame(streamerId, stores.get(streamerId)!)
    }
    hydratedStores.add(streamerId)
  })().finally(() => {
    hydrationByStreamer.delete(streamerId)
  })
  hydrationByStreamer.set(streamerId, pending)
  await pending
}

function newGame(length?: NadleWordLength): Game {
  const raw = generateWord(normalizeWordLength(length))
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

function gameForPlayer(store: Store, player: PlayerState): Game {
  return player.game ?? store.currentGame
}

function ensurePlayer(
  store: Store,
  userId: string,
  displayName: string,
): PlayerState {
  let player = store.players[userId]
  if (!player) {
    player = {
      userId,
      displayName,
      game: store.currentGame,
      attempts: 0,
      guessed: false,
      rows: [],
    }
    store.players[userId] = player
  } else {
    if (displayName && displayName !== player.displayName) {
      player.displayName = displayName
    }
    if (!player.game || !isSupportedWordLength(player.game.word)) {
      player.game = store.currentGame
    }
  }
  return player
}

function playerToPublic(p: PlayerState): GameStatePayload['players'][number] {
  return {
    userId: p.userId,
    displayName: p.displayName,
    attempts: p.attempts,
    guessed: p.guessed,
    rows: p.rows,
  }
}

export function getCurrentWordLength(streamerId: string): number {
  return wordGraphemeCount(storeFor(streamerId).currentGame.word)
}

export function getCurrentGameId(streamerId: string): string {
  return storeFor(streamerId).currentGame.id
}

export function getGameStatePayload(
  streamerId: string,
  viewer?: { userId: string; displayName: string; canSeeSecret?: boolean },
): GameStatePayload {
  const store = storeFor(streamerId)
  const viewerGame = viewer ? gameForPlayer(store, ensurePlayer(store, viewer.userId, viewer.displayName)) : store.currentGame
  return {
    gameId: viewerGame.id,
    wordLength: wordGraphemeCount(viewerGame.word),
    startedAt: viewerGame.startedAt,
    ...(viewer?.canSeeSecret ? { secretWord: viewerGame.word } : {}),
    players: Object.values(store.players).map(playerToPublic),
  }
}

export function getLeaderboardPayload(streamerId: string): { entries: LeaderboardEntry[] } {
  const list = Object.values(storeFor(streamerId).players).filter((p) => p.rows.length > 0)
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
  streamerId: string,
  userId: string,
  displayName: string,
  rawGuess: string,
  expectedGameId?: string,
): GuessResult {
  const store = storeFor(streamerId)
  const player = ensurePlayer(store, userId, displayName)
  const game = gameForPlayer(store, player)
  if (expectedGameId !== undefined && expectedGameId !== game.id) {
    return { ok: false, reason: 'wrong_game' }
  }

  const guess = normalizeWord(rawGuess)
  const secretLen = wordGraphemeCount(game.word)
  const wordLength = normalizeWordLength(secretLen)
  if (wordGraphemeCount(guess) !== secretLen) {
    return { ok: false, reason: 'invalid_shape' }
  }
  if (!isValidGuessShape(guess, secretLen)) {
    return { ok: false, reason: 'invalid_shape' }
  }
  if (!isAllowedGuess(guess, wordLength)) {
    return { ok: false, reason: 'invalid_shape' }
  }

  if (player.guessed) {
    return { ok: false, reason: 'already_solved' }
  }
  if (player.attempts >= MAX_ATTEMPTS_PER_ROUND) {
    return { ok: false, reason: 'max_attempts' }
  }

  const feedback = computeFeedback(game.word, guess)
  const row: GuessRow = { guess, feedback }
  player.rows.push(row)
  player.attempts += 1

  const win = [...feedback].every((x) => x === 'correct')
  if (win) {
    player.guessed = true
    player.guessedAt = Date.now()
  }

  persistNadleLiveGame(streamerId, store)

  return {
    ok: true,
    gameId: game.id,
    userId: player.userId,
    displayName: player.displayName,
    guess,
    feedback,
    attempts: player.attempts,
    guessed: player.guessed,
  }
}

export function startPlayerNewGame(
  streamerId: string,
  userId: string,
  displayName: string,
  wordLength?: NadleWordLength,
): { gameId: string; wordLength: number; startedAt: number } {
  const store = storeFor(streamerId)
  const player = ensurePlayer(store, userId, displayName)
  const game = newGame(wordLength)
  player.game = game
  player.attempts = 0
  player.guessed = false
  delete player.guessedAt
  player.rows = []
  persistNadleLiveGame(streamerId, store)
  return {
    gameId: game.id,
    wordLength: wordGraphemeCount(game.word),
    startedAt: game.startedAt,
  }
}

export function adminStartNewGame(
  streamerId: string,
  wordLength?: NadleWordLength,
): { gameId: string; wordLength: number; startedAt: number } {
  const next: Store = {
    currentGame: newGame(wordLength),
    players: {},
  }
  stores.set(streamerId, next)
  setStreamerActiveGame(streamerId, 'nadle')
  persistNadleLiveGame(streamerId, next)
  const g = next.currentGame
  return {
    gameId: g.id,
    wordLength: wordGraphemeCount(g.word),
    startedAt: g.startedAt,
  }
}


export function buildNadleRoundPersistencePayload(
  streamerId: string,
  winnerUserId: string,
): PersistNadleRoundInput | null {
  const w = String(winnerUserId ?? '').trim()
  if (!w) {
    return null
  }
  const store = storeFor(streamerId)
  const winner = store.players[w]
  const winnerGameId = winner ? gameForPlayer(store, winner).id : null
  const players = Object.values(store.players).filter((p) => gameForPlayer(store, p).id === winnerGameId)
  if (players.length === 0) {
    return null
  }
  return {
    streamerId,
    winnerUserId: w,
    players: players.map((p) => ({
      userId: p.userId,
      attempts: p.attempts,
      isWinner: p.userId === w && p.guessed === true,
    })),
  }
}
