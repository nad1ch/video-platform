import { randomUUID } from 'node:crypto'
import { prisma } from '../prisma'
import { classifyGuessHeat } from './garticGuess'
import {
  buildMaskedDisplay,
  countRevealedLetters,
  initialRevealedMask,
  maxEndgameHintLetters,
  revealRandomLetter,
  wordCodePoints,
} from './garticMask'
import { clearGarticGuessThrottleForStreamer, tryConsumeGarticGuessThrottle } from './garticThrottle'
import type { GamePhase, GarticStatePayload } from './wsProtocol'
import { setStreamerActiveGame } from '../streamerActiveGame'

const ROUND_DURATION_DEFAULT_SEC = 180
const ROUND_DURATION_MIN_SEC = 10
const ROUND_DURATION_MAX_SEC = 600
const ROUNDS_PLANNED_MIN = 1
const ROUNDS_PLANNED_MAX = 50

const FALLBACK_WORDS = ['star', 'house', 'music', 'bridge', 'painter', 'canvas', 'chat', 'twitch', 'game']

type Room = {
  streamerId: string
  phase: GamePhase
  currentWord: string
  revealed: boolean[]
  winnerUserId?: string
  winnerDisplayName?: string
  startedAt: number
  unlockAt: number
  endsAt: number
  /** Multi-round session: total rounds (0 = no active session). */
  sessionPlannedRounds: number
  /** Rounds already finished in this session. */
  sessionCompletedRounds: number
  sessionWordSource: 'random' | 'db' | 'manual'
  sessionRoundDurationSec: number
  /** Snapshot after a round ends (phase `between_rounds`). */
  breakHadWinner: boolean
  breakWinnerDisplayName: string
  breakSessionFinished: boolean
  nextRoundWordDraft: string
  roundId: string
  unlockTimer: ReturnType<typeof setTimeout> | null
  roundTimer: ReturnType<typeof setTimeout> | null
  letterTimer: ReturnType<typeof setTimeout> | null
}

const rooms = new Map<string, Room>()

type StateListener = (streamerId: string) => void
type FeedbackListener = (
  streamerId: string,
  payload: {
    userId: string
    displayName: string
    text: string
    kind: 'rate_limit' | 'guess_locked' | 'heat' | 'win' | 'wrong'
    heat?: 'cold' | 'warm' | 'hot'
  },
) => void

let stateListener: StateListener | null = null
let feedbackListener: FeedbackListener | null = null
let canvasClearListener: ((streamerId: string) => void) | null = null

export function setGarticStateListener(fn: StateListener | null): void {
  stateListener = fn
}

export function setGarticFeedbackListener(fn: FeedbackListener | null): void {
  feedbackListener = fn
}

export function setGarticCanvasClearListener(fn: typeof canvasClearListener): void {
  canvasClearListener = fn
}

function requestCanvasClear(streamerId: string): void {
  canvasClearListener?.(streamerId)
}

function notifyState(streamerId: string): void {
  stateListener?.(streamerId)
}

function emitFeedback(streamerId: string, p: Parameters<FeedbackListener>[1]): void {
  feedbackListener?.(streamerId, p)
}

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

function clearUnlockTimer(room: Room): void {
  if (room.unlockTimer) {
    clearTimeout(room.unlockTimer)
    room.unlockTimer = null
  }
}

function clearRoundTimer(room: Room): void {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer)
    room.roundTimer = null
  }
}

function stopLetterReveal(room: Room): void {
  if (room.letterTimer) {
    clearTimeout(room.letterTimer)
    room.letterTimer = null
  }
}

/**
 * One optional hint letter, fired once in the last ~6–12s before `endsAt` (not during the whole round).
 */
function scheduleEndgameHintLetter(streamerId: string, room: Room): void {
  stopLetterReveal(room)
  if (room.phase !== 'drawing_active') {
    return
  }
  if (maxEndgameHintLetters(room.currentWord) <= 0) {
    return
  }
  const msUntilEnd = room.endsAt - Date.now()
  if (msUntilEnd < 4000) {
    return
  }
  const beforeEnd = 6000 + Math.floor(Math.random() * 6001)
  let delay = msUntilEnd - beforeEnd
  if (delay < 2000) {
    delay = Math.max(800, msUntilEnd - 2500)
  }
  room.letterTimer = setTimeout(() => {
    room.letterTimer = null
    if (room.phase !== 'drawing_active') {
      return
    }
    if (countRevealedLetters(room.revealed, room.currentWord) >= maxEndgameHintLetters(room.currentWord)) {
      return
    }
    const changed = revealRandomLetter(room.revealed, room.currentWord)
    if (changed) {
      notifyState(streamerId)
    }
  }, delay)
}

function clearAllTimers(room: Room): void {
  clearUnlockTimer(room)
  clearRoundTimer(room)
  stopLetterReveal(room)
}

function lockMsForRound(durSec: number): number {
  return Math.min(5000, Math.max(1500, Math.floor(durSec * 1000 * 0.25)))
}

function fullSessionEnd(streamerId: string, room: Room): void {
  clearAllTimers(room)
  room.phase = 'idle'
  room.currentWord = ''
  room.revealed = []
  room.winnerUserId = undefined
  room.winnerDisplayName = undefined
  room.startedAt = 0
  room.unlockAt = 0
  room.endsAt = 0
  room.roundId = ''
  room.sessionPlannedRounds = 0
  room.sessionCompletedRounds = 0
  room.sessionWordSource = 'random'
  room.sessionRoundDurationSec = ROUND_DURATION_DEFAULT_SEC
  room.breakHadWinner = false
  room.breakWinnerDisplayName = ''
  room.breakSessionFinished = false
  room.nextRoundWordDraft = ''
  clearGarticGuessThrottleForStreamer(streamerId)
  setStreamerActiveGame(streamerId, null)
  requestCanvasClear(streamerId)
  notifyState(streamerId)
}

/**
 * After `revealed`, move to `between_rounds` so the host can confirm before the next round starts.
 */
async function enterBetweenRounds(streamerId: string, room: Room): Promise<void> {
  if (room.phase !== 'revealed') {
    return
  }
  room.breakHadWinner = Boolean(room.winnerUserId)
  room.breakWinnerDisplayName = room.winnerDisplayName ?? ''
  room.winnerUserId = undefined
  room.winnerDisplayName = undefined

  room.sessionCompletedRounds += 1
  clearRoundTimer(room)
  stopLetterReveal(room)
  clearUnlockTimer(room)
  room.startedAt = 0
  room.unlockAt = 0
  room.endsAt = 0
  room.roundId = ''

  if (room.sessionCompletedRounds >= room.sessionPlannedRounds) {
    room.breakSessionFinished = true
    room.nextRoundWordDraft = ''
    room.phase = 'between_rounds'
    notifyState(streamerId)
    return
  }

  room.breakSessionFinished = false
  let draft = ''
  if (room.sessionWordSource !== 'manual') {
    const picked = await pickWord(streamerId, room.sessionWordSource, undefined)
    if (!picked.ok) {
      console.error('[gartic-show] between-rounds pick failed', picked.code)
      fullSessionEnd(streamerId, room)
      return
    }
    draft = picked.word
  }
  room.nextRoundWordDraft = draft
  room.phase = 'between_rounds'
  notifyState(streamerId)
}

function beginRoundWithWord(streamerId: string, room: Room, word: string): void {
  requestCanvasClear(streamerId)
  clearGarticGuessThrottleForStreamer(streamerId)
  clearAllTimers(room)
  const now = Date.now()
  const durSec = room.sessionRoundDurationSec
  const lockMs = lockMsForRound(durSec)
  room.currentWord = word
  room.revealed = initialRevealedMask(room.currentWord)
  room.winnerUserId = undefined
  room.winnerDisplayName = undefined
  room.phase = 'drawing_locked'
  room.startedAt = now
  room.unlockAt = now + lockMs
  room.endsAt = now + durSec * 1000
  room.roundId = randomUUID()
  room.breakHadWinner = false
  room.breakWinnerDisplayName = ''
  room.breakSessionFinished = false
  room.nextRoundWordDraft = ''
  armUnlock(streamerId, room)
  armRoundMax(streamerId, room)
  setStreamerActiveGame(streamerId, 'gartic-show')
  notifyState(streamerId)
}

function getOrCreateRoom(streamerId: string): Room {
  let r = rooms.get(streamerId)
  if (!r) {
    r = {
      streamerId,
      phase: 'idle',
      currentWord: '',
      revealed: [],
      startedAt: 0,
      unlockAt: 0,
      endsAt: 0,
      sessionPlannedRounds: 0,
      sessionCompletedRounds: 0,
      sessionWordSource: 'random',
      sessionRoundDurationSec: ROUND_DURATION_DEFAULT_SEC,
      breakHadWinner: false,
      breakWinnerDisplayName: '',
      breakSessionFinished: false,
      nextRoundWordDraft: '',
      roundId: '',
      unlockTimer: null,
      roundTimer: null,
      letterTimer: null,
    }
    rooms.set(streamerId, r)
  }
  return r
}

async function pickWord(
  streamerId: string,
  wordSource: 'random' | 'db' | 'manual',
  manualWord: string | undefined,
): Promise<{ ok: true; word: string } | { ok: false; code: string; message: string }> {
  if (wordSource === 'manual') {
    const raw = String(manualWord ?? '').trim()
    if (raw.length < 1 || raw.length > 80) {
      return { ok: false, code: 'bad_word', message: 'Manual word length must be 1–80.' }
    }
    return { ok: true, word: raw }
  }

  if (isDatabaseConfigured()) {
    try {
      const rows = await prisma.garticPrompt.findMany({
        where: { streamerId, approved: true },
        select: { id: true, text: true },
      })
      if (rows.length > 0) {
        if (wordSource === 'db') {
          const pick = rows[Math.floor(Math.random() * rows.length)]!
          await prisma.garticPrompt.update({
            where: { id: pick.id },
            data: { usageCount: { increment: 1 } },
          })
          return { ok: true, word: pick.text }
        }
        // random: prefer DB if any
        const pick = rows[Math.floor(Math.random() * rows.length)]!
        await prisma.garticPrompt.update({
          where: { id: pick.id },
          data: { usageCount: { increment: 1 } },
        })
        return { ok: true, word: pick.text }
      }
      if (wordSource === 'db') {
        return { ok: false, code: 'no_prompts', message: 'No approved prompts in database.' }
      }
    } catch (e) {
      // Unhandled Prisma errors here previously crashed the whole API process (502 on /api/* including OAuth).
      console.error('[gartic-show] pickWord database error', e)
      if (wordSource === 'db') {
        return {
          ok: false,
          code: 'prompts_unavailable',
          message:
            'Could not load prompts. Apply DB migrations (GarticPrompt) and run prisma generate, then retry.',
        }
      }
      // random: fall through to built-in word list
    }
  }

  const w = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]!
  return { ok: true, word: w }
}

function applyUnlock(streamerId: string, room: Room): void {
  if (room.phase !== 'drawing_locked') {
    return
  }
  room.phase = 'drawing_active'
  scheduleEndgameHintLetter(streamerId, room)
  notifyState(streamerId)
}

function armUnlock(streamerId: string, room: Room): void {
  clearUnlockTimer(room)
  const delay = Math.max(0, room.unlockAt - Date.now())
  room.unlockTimer = setTimeout(() => {
    room.unlockTimer = null
    applyUnlock(streamerId, room)
  }, delay)
}

function armRoundMax(streamerId: string, room: Room): void {
  clearRoundTimer(room)
  const delay = Math.max(0, room.endsAt - Date.now())
  room.roundTimer = setTimeout(() => {
    room.roundTimer = null
    if (room.phase === 'idle' || room.phase === 'revealed' || room.phase === 'between_rounds') {
      return
    }
    room.phase = 'revealed'
    stopLetterReveal(room)
    notifyState(streamerId)
    void enterBetweenRounds(streamerId, room)
  }, delay)
}

export function getGarticStatePayload(streamerId: string, includeSecret: boolean): GarticStatePayload {
  const room = getOrCreateRoom(streamerId)
  const viewerShowAnswer =
    (room.phase === 'revealed' || room.phase === 'between_rounds') && room.currentWord.length > 0
  const maskedWord = viewerShowAnswer && !includeSecret
    ? buildMaskedDisplay(room.currentWord, wordCodePoints(room.currentWord).map(() => true))
    : buildMaskedDisplay(room.currentWord, room.revealed)
  const roundDurationSec =
    room.phase === 'idle' || room.startedAt <= 0
      ? 0
      : Math.max(0, Math.round((room.endsAt - room.startedAt) / 1000))
  const sessionActive = room.sessionPlannedRounds > 0
  const roundNumber = !sessionActive
    ? 0
    : room.phase === 'between_rounds' && room.breakSessionFinished
      ? room.sessionPlannedRounds
      : room.sessionCompletedRounds + 1
  return {
    streamerId,
    phase: room.phase,
    currentWord: includeSecret && room.phase !== 'idle' ? room.currentWord : '',
    maskedWord,
    winnerUserId: room.winnerUserId,
    winnerDisplayName: room.winnerDisplayName,
    startedAt: room.startedAt,
    unlockAt: room.unlockAt,
    endsAt: room.endsAt,
    roundDurationSec,
    roundsPlanned: sessionActive ? room.sessionPlannedRounds : 0,
    roundNumber,
    sessionWordSource: sessionActive ? room.sessionWordSource : undefined,
    breakHadWinner: room.phase === 'between_rounds' ? room.breakHadWinner : undefined,
    breakWinnerDisplayName: room.phase === 'between_rounds' ? room.breakWinnerDisplayName : undefined,
    breakSessionFinished: room.phase === 'between_rounds' ? room.breakSessionFinished : undefined,
    nextWordDraft: room.phase === 'between_rounds' && includeSecret ? room.nextRoundWordDraft : undefined,
    roundId: room.roundId,
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) {
    return lo
  }
  return Math.min(hi, Math.max(lo, Math.floor(n)))
}

export async function hostStartGarticRound(
  streamerId: string,
  opts: {
    wordSource: 'random' | 'db' | 'manual'
    manualWord?: string
    roundDurationSec?: number
    roundsPlanned?: number
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const room = getOrCreateRoom(streamerId)
  if (room.phase !== 'idle') {
    return { ok: false, code: 'bad_phase', message: 'Finish or clear the current round first.' }
  }

  room.sessionPlannedRounds = clampInt(opts.roundsPlanned ?? 1, ROUNDS_PLANNED_MIN, ROUNDS_PLANNED_MAX)
  room.sessionCompletedRounds = 0
  room.sessionWordSource = opts.wordSource
  room.sessionRoundDurationSec = clampInt(
    opts.roundDurationSec ?? ROUND_DURATION_DEFAULT_SEC,
    ROUND_DURATION_MIN_SEC,
    ROUND_DURATION_MAX_SEC,
  )

  const picked = await pickWord(streamerId, room.sessionWordSource, opts.manualWord)
  if (!picked.ok) {
    return picked
  }

  beginRoundWithWord(streamerId, room, picked.word)
  return { ok: true }
}

export async function hostAckNextRound(
  streamerId: string,
  opts: { word?: string },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const room = getOrCreateRoom(streamerId)
  if (room.phase !== 'between_rounds') {
    return { ok: false, code: 'bad_phase', message: 'Not between rounds.' }
  }
  if (room.breakSessionFinished) {
    fullSessionEnd(streamerId, room)
    return { ok: true }
  }

  const override = String(opts.word ?? '').trim()
  let word = override.length > 0 ? override : room.nextRoundWordDraft.trim()

  if (room.sessionWordSource === 'manual' && word.length < 1) {
    return { ok: false, code: 'bad_word', message: 'Enter the word for this round.' }
  }

  if (word.length > 80) {
    return { ok: false, code: 'bad_word', message: 'Word length must be 1–80.' }
  }

  if (word.length < 1) {
    const picked = await pickWord(streamerId, room.sessionWordSource, undefined)
    if (!picked.ok) {
      return picked
    }
    word = picked.word
  }

  beginRoundWithWord(streamerId, room, word)
  return { ok: true }
}

export function hostClearGarticRound(streamerId: string): void {
  const room = getOrCreateRoom(streamerId)
  clearAllTimers(room)
  room.phase = 'idle'
  room.currentWord = ''
  room.revealed = []
  room.winnerUserId = undefined
  room.winnerDisplayName = undefined
  room.startedAt = 0
  room.unlockAt = 0
  room.endsAt = 0
  room.sessionPlannedRounds = 0
  room.sessionCompletedRounds = 0
  room.sessionWordSource = 'random'
  room.sessionRoundDurationSec = ROUND_DURATION_DEFAULT_SEC
  room.breakHadWinner = false
  room.breakWinnerDisplayName = ''
  room.breakSessionFinished = false
  room.nextRoundWordDraft = ''
  room.roundId = ''
  clearGarticGuessThrottleForStreamer(streamerId)
  setStreamerActiveGame(streamerId, null)
  notifyState(streamerId)
}

/**
 * Twitch / sidecar entry: chat guesses and `!add` are handled separately; this only processes guesses.
 */
export function handleGarticChatGuess(streamerId: string, userId: string, displayName: string, text: string): void {
  const room = getOrCreateRoom(streamerId)
  if (room.phase !== 'drawing_locked' && room.phase !== 'drawing_active') {
    return
  }

  const trimmed = text.trim()
  if (trimmed.startsWith('!')) {
    return
  }

  if (!tryConsumeGarticGuessThrottle(streamerId, userId)) {
    emitFeedback(streamerId, {
      userId,
      displayName,
      text: trimmed,
      kind: 'rate_limit',
    })
    return
  }

  const heat = classifyGuessHeat(trimmed, room.currentWord)

  if (room.phase === 'drawing_locked') {
    if (heat === 'exact') {
      emitFeedback(streamerId, {
        userId,
        displayName,
        text: trimmed,
        kind: 'guess_locked',
      })
      return
    }
    emitFeedback(streamerId, {
      userId,
      displayName,
      text: trimmed,
      kind: 'heat',
      heat,
    })
    return
  }

  if (room.phase === 'drawing_active') {
    if (heat === 'exact') {
      if (room.winnerUserId) {
        emitFeedback(streamerId, {
          userId,
          displayName,
          text: trimmed,
          kind: 'wrong',
        })
        return
      }
      room.winnerUserId = userId
      room.winnerDisplayName = displayName
      room.phase = 'revealed'
      stopLetterReveal(room)
      clearRoundTimer(room)
      emitFeedback(streamerId, {
        userId,
        displayName,
        text: trimmed,
        kind: 'win',
      })
      notifyState(streamerId)
      void enterBetweenRounds(streamerId, room)
      return
    }
    emitFeedback(streamerId, {
      userId,
      displayName,
      text: trimmed,
      kind: 'heat',
      heat,
    })
  }
}
