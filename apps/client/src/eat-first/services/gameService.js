import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  getDoc,
  runTransaction,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { ADMIN_KEY } from '../config/access.js'
import { callableApiEnabled } from './callableApi.js'
import {
  callSubmitVote,
  callHostClearVotes,
  callHostDeleteVote,
  callHostSetGamePhase,
} from './callableClient.js'
import { pickRandomActiveCardTemplateAvoiding } from '../data/activeCards.js'
import {
  buildRandomPlayerDocument,
  createEmptyUsedState,
  mergePlayerDataIntoUsedState,
  normalizeTraitText,
  rollFieldValue,
} from '../data/randomPools.js'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'
import { db } from '../firebase.js'

function firestoreReady() {
  return Boolean(db)
}
import { debugDelete } from '../utils/debugDelete.js'
import { logListenerDetach } from '../utils/appLogger.js'

function gameDocRef(gameId) {
  if (!db) return null
  return doc(db, 'games', gameId)
}

function playerDocRef(gameId, playerId) {
  if (!db) return null
  return doc(db, 'games', gameId, 'players', playerId)
}

/** Зліпити мапу піднятих рук з документа кімнати (включаючи legacy-поля "hands.p1" на корені). */
function collectRaisedHandsMapFromGameData(data) {
  if (!data || typeof data !== 'object') return {}
  const h = {}
  const rawHands = data.hands
  if (rawHands && typeof rawHands === 'object' && !Array.isArray(rawHands)) {
    for (const [k, v] of Object.entries(rawHands)) {
      if (v === true) h[normalizePlayerSlotId(k)] = true
    }
  }
  const prefix = 'hands.'
  for (const key of Object.keys(data)) {
    if (typeof key !== 'string' || !key.startsWith(prefix)) continue
    const slot = key.slice(prefix.length)
    if (!slot) continue
    if (data[key] === true) h[normalizePlayerSlotId(slot)] = true
  }
  return h
}

/** Мапа «готовий до гри»: games/{gameId}.playersReady.{playerId} === true */
function collectPlayersReadyMapFromGameData(data) {
  if (!data || typeof data !== 'object') return {}
  const out = {}
  const raw = data.playersReady
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === true) out[normalizePlayerSlotId(k)] = true
    }
  }
  return out
}

/**
 * Гравець позначає готовність (без admin key; лише поле playersReady).
 * @param {boolean} ready
 */
export async function setPlayerReady(gameId, playerId, ready) {
  const raw = String(playerId ?? '').trim()
  if (!raw) return
  if (!firestoreReady()) return
  const pid = normalizePlayerSlotId(playerId)
  const ref = gameDocRef(gameId)
  if (!ref) return
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      if (!ready) return
      tx.set(ref, { playersReady: { [pid]: true } })
      return
    }
    const next = { ...collectPlayersReadyMapFromGameData(snap.data()) }
    if (ready) next[pid] = true
    else delete next[pid]
    tx.update(ref, { playersReady: next })
  })
}

/**
 * Метадані кімнати: games/{gameId} (наприклад activePlayer для spotlight).
 */
export function subscribeToGameRoom(gameId, callback) {
  const ref = gameDocRef(gameId)
  if (!ref) {
    queueMicrotask(() => callback({}))
    return () => {}
  }
  return onSnapshot(
    ref,
    (snapshot) => {
      callback(snapshot.exists() ? snapshot.data() : {})
    },
    (err) => {
      logListenerDetach('subscribeToGameRoom', err, { gameId })
      callback({})
    },
  )
}

export async function saveGameRoom(gameId, partial) {
  const ref = gameDocRef(gameId)
  if (!ref) return
  await setDoc(
    ref,
    { ...partial, key: ADMIN_KEY },
    { merge: true },
  )
}

const GAME_PHASES = new Set(['intro', 'discussion', 'voting', 'final'])

/**
 * Таймер мовлення: games/{gameId}.currentSpeaker (окремо від activePlayer = spotlight).
 */
export async function startSpeakingTimer(gameId, speakerId, seconds) {
  const ref = gameDocRef(gameId)
  if (!ref) return
  const sec = Math.max(1, Math.floor(Number(seconds) || 30))
  const sp = String(speakerId || '').trim()
  await setDoc(
    ref,
    {
      currentSpeaker: sp,
      speakingTimer: sec,
      timerStartedAt: Timestamp.now(),
      timerPaused: false,
      timerRemainingFrozen: deleteField(),
      key: ADMIN_KEY,
    },
    { merge: true },
  )
}

/** Зупинити таймер і зняти currentSpeaker (activePlayer / spotlight не чіпаємо). */
export async function clearSpeakingTimer(gameId) {
  const ref = gameDocRef(gameId)
  if (!ref) return
  await setDoc(
    ref,
    {
      currentSpeaker: '',
      timerStartedAt: deleteField(),
      speakingTimer: 0,
      timerPaused: false,
      timerRemainingFrozen: deleteField(),
      key: ADMIN_KEY,
    },
    { merge: true },
  )
}

/** Пауза таймера з фіксацією залишку (секунди). */
export async function pauseSpeakingTimer(gameId, remainingSeconds) {
  const ref = gameDocRef(gameId)
  if (!ref) return
  const r = Math.max(0, Math.floor(Number(remainingSeconds) || 0))
  await setDoc(
    ref,
    {
      timerPaused: true,
      timerRemainingFrozen: r,
      timerStartedAt: deleteField(),
      key: ADMIN_KEY,
    },
    { merge: true },
  )
}

export async function resumeSpeakingTimer(gameId) {
  const ref = gameDocRef(gameId)
  if (!ref) return
  const snapshot = await getDoc(ref)
  const d = snapshot.exists() ? snapshot.data() : {}
  const rem = Math.max(1, Number(d.timerRemainingFrozen || d.speakingTimer) || 30)
  const sp = String(d.currentSpeaker || '').trim()
  await setDoc(
    ref,
    {
      timerPaused: false,
      speakingTimer: rem,
      timerStartedAt: Timestamp.now(),
      timerRemainingFrozen: deleteField(),
      ...(sp ? { currentSpeaker: sp } : {}),
      key: ADMIN_KEY,
    },
    { merge: true },
  )
}

export async function setGamePhase(gameId, phase) {
  const p = String(phase || 'intro')
  const next = GAME_PHASES.has(p) ? p : 'intro'
  if (callableApiEnabled()) {
    await callHostSetGamePhase(String(gameId ?? '').trim(), next)
    return
  }
  if (!firestoreReady()) return
  await saveGameRoom(gameId, { gamePhase: next })
}

/** Скинути кімнату: spotlight, спікер, таймер, фаза. */
export async function resetGameRoomControls(gameId) {
  const ref = gameDocRef(gameId)
  if (!ref) return
  await setDoc(
    ref,
    {
      activePlayer: '',
      currentSpeaker: '',
      speakingTimer: 0,
      timerStartedAt: deleteField(),
      timerPaused: false,
      timerRemainingFrozen: deleteField(),
      gamePhase: 'intro',
      round: 1,
      nominatedPlayer: deleteField(),
      nominatedBy: deleteField(),
      nominations: deleteField(),
      nominationOneTargetPerRound: deleteField(),
      hands: {},
      playersReady: {},
      voting: deleteField(),
      voteTargetsThisRound: deleteField(),
      key: ADMIN_KEY,
    },
    { merge: true },
  )
}

function votesColRef(gameId) {
  if (!db) return null
  return collection(db, 'games', gameId, 'votes')
}

/** Підписка на всі голоси кімнати (для оверлею та адмінки). */
export function subscribeToVotes(gameId, callback) {
  const colRef = votesColRef(gameId)
  if (!colRef) {
    queueMicrotask(() => callback([]))
    return () => {}
  }
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      list.sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }),
      )
      callback(list)
    },
    (err) => {
      logListenerDetach('subscribeToVotes', err, { gameId })
      callback([])
    },
  )
}

/** Видалити всі документи в votes/ (батчами). */
export async function clearAllVotes(gameId) {
  if (callableApiEnabled()) {
    await callHostClearVotes(String(gameId ?? '').trim())
    return
  }
  const vcol = votesColRef(gameId)
  if (!vcol) return
  const snap = await getDocs(vcol)
  let batch = writeBatch(db)
  let n = 0
  for (const d of snap.docs) {
    batch.delete(d.ref)
    n++
    if (n >= 400) {
      await batch.commit()
      batch = writeBatch(db)
      n = 0
    }
  }
  if (n > 0) await batch.commit()
}

export async function deleteVoteDoc(gameId, voterId) {
  const raw = String(voterId ?? '').trim()
  if (!raw) return
  const v = normalizePlayerSlotId(raw)
  if (callableApiEnabled()) {
    await callHostDeleteVote(String(gameId ?? '').trim(), v)
    return
  }
  if (!db) return
  await deleteDoc(doc(db, 'games', gameId, 'votes', v))
}

/** Нормалізовані номінації: [{ target: 'p3', by: 'p1' }, …] */
export function normalizeNominations(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const x of raw) {
    const target = String(x?.target ?? '').trim()
    const by = String(x?.by ?? '').trim()
    if (target && by) out.push({ target, by })
  }
  return out
}

/** Для UI: з масиву або з legacy nominatedPlayer / nominatedBy */
export function nominationsFromRoom(gr) {
  const raw = normalizeNominations(gr?.nominations)
  if (raw.length) return raw
  const t = String(gr?.nominatedPlayer ?? '').trim()
  const b = String(gr?.nominatedBy ?? '').trim()
  if (t && b) return [{ target: t, by: b }]
  return []
}

/**
 * Унікальні номіновані слоти в порядку першої появи в масиві номінацій (хронологія виставлення).
 */
export function nomineeTargetsInNominationOrder(nominations) {
  const list = Array.isArray(nominations) ? normalizeNominations(nominations) : []
  const seen = new Set()
  const out = []
  for (const x of list) {
    const t = normalizePlayerSlotId(x.target)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** Записати номінації; прибирає legacy-поля. */
export async function setGameNominations(gameId, list) {
  const next = normalizeNominations(list)
  await saveGameRoom(gameId, {
    nominations: next,
    nominatedPlayer: deleteField(),
    nominatedBy: deleteField(),
  })
}

/** Номінація + хто ініціював (slot p1… або '') — legacy, краще nominations[]. */
export async function setNominatedPlayer(gameId, playerId, nominatedBySlot) {
  const p = String(playerId ?? '').trim()
  const by = String(nominatedBySlot ?? '').trim()
  if (!p) {
    await saveGameRoom(gameId, {
      nominatedPlayer: '',
      nominatedBy: deleteField(),
      nominations: deleteField(),
    })
    return
  }
  await saveGameRoom(gameId, {
    nominatedPlayer: p,
    nominatedBy: by || deleteField(),
    nominations: deleteField(),
  })
}

const MIN_ROUND = 1
const MAX_ROUND = 8

export async function setRoomRound(gameId, nextRound, clearVotesToo = true) {
  const r = Math.min(MAX_ROUND, Math.max(MIN_ROUND, Math.floor(Number(nextRound) || 1)))
  await saveGameRoom(gameId, { round: r, voteTargetsThisRound: [] })
  if (clearVotesToo) await clearAllVotes(gameId)
}

export async function nextRoomRound(gameId) {
  const gref = gameDocRef(gameId)
  if (!gref) return
  const snap = await getDoc(gref)
  const cur = Math.floor(Number(snap.exists() ? snap.data().round : 1) || 1)
  const next = Math.min(MAX_ROUND, cur + 1)
  await saveGameRoom(gameId, { round: next, voteTargetsThisRound: [] })
  await clearAllVotes(gameId)
}

export async function resetRoomRoundCounter(gameId) {
  await saveGameRoom(gameId, { round: 1, voteTargetsThisRound: [] })
  await clearAllVotes(gameId)
}

export async function clearAllHands(gameId) {
  await saveGameRoom(gameId, { hands: {} })
}

/**
 * Усі гравці в кімнаті з eliminated: true → false (повернути в гру).
 * @returns {Promise<number>} скільки документів оновлено
 */
export async function reviveAllEliminatedPlayers(gameId) {
  if (!db) return 0
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  let n = 0
  for (const d of snapshot.docs) {
    const data = d.data()
    if (data?.eliminated !== true) continue
    n += 1
    await setDoc(
      d.ref,
      {
        eliminated: false,
        key: ADMIN_KEY,
      },
      { merge: true },
    )
  }
  return n
}

/**
 * Голосування на кімнаті: { active, targetPlayer, ballotQueue?, ballotIndex?, ballotRunId?,
 *   slotDurationSec?, voteSlotStartedAt? }.
 * @param {{ slotDurationSec?: number, clearBallot?: boolean }} [options]
 */
export async function setRoomVoting(gameId, active, targetPlayer, options = {}) {
  const tp = String(targetPlayer ?? '').trim()
  const gref = gameDocRef(gameId)
  if (!gref) return
  const snap = await getDoc(gref)
  const data = snap.exists() ? snap.data() : {}
  const curV = data.voting && typeof data.voting === 'object' ? { ...data.voting } : {}

  if (!active && !tp) {
    const cleared = {
      ...curV,
      active: false,
      targetPlayer: '',
      voteSlotStartedAt: deleteField(),
    }
    if (options.clearBallot) {
      cleared.ballotQueue = deleteField()
      cleared.ballotIndex = deleteField()
      cleared.ballotRunId = deleteField()
      cleared.ballotRound = deleteField()
      cleared.ballotSource = deleteField()
    }
    await saveGameRoom(gameId, { voting: cleared })
    return
  }

  const next = { ...curV, active: Boolean(active), targetPlayer: tp }
  if (active && tp) {
    const sec = Math.max(
      1,
      Math.floor(
        Number(options.slotDurationSec) || Number(curV.slotDurationSec) || 5,
      ),
    )
    next.slotDurationSec = sec
    next.voteSlotStartedAt = Timestamp.now()
  } else {
    next.voteSlotStartedAt = deleteField()
  }

  await saveGameRoom(gameId, {
    voting: next,
  })
}

/**
 * Піднята рука гравця: games/{gameId}.hands.{playerId}
 *
 * Транзакція + update({ hands: next }): поле `hands` цілком замінюється на `next`,
 * тож видалені слоти реально зникають у БД. set(merge) на вкладену мапу глибоко зливає
 * ключі й лишав старі true — ведучий не бачив «опущену» руку.
 * Rules: змінюється лише `hands`.
 *
 * @param {boolean} raised
 */
export async function setGameHandRaised(gameId, playerId, raised) {
  const raw = String(playerId ?? '').trim()
  if (!raw) return
  const pid = normalizePlayerSlotId(playerId)
  const ref = gameDocRef(gameId)
  if (!ref) return
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      if (!raised) return
      tx.set(ref, { hands: { [pid]: true } })
      return
    }
    const next = { ...collectRaisedHandsMapFromGameData(snap.data()) }
    if (raised) next[pid] = true
    else delete next[pid]
    tx.update(ref, { hands: next })
  })
}

/**
 * Зайняти слот із лобі: joinToken + joinDeviceId (Firestore transaction — перший клік забирає слот).
 * Повторний вхід з того самого deviceId видає новий токен.
 * @param {{ deviceId?: string, name?: string }} options
 * @returns {Promise<{ ok: true, token: string } | { ok: false, reason: 'taken' | 'no-slot' | 'no-device' }>}
 */
export async function claimPlayerSlot(gameId, playerId, options = {}) {
  const gid = String(gameId ?? '').trim()
  const pid = normalizePlayerSlotId(playerId)
  const deviceId = String(options.deviceId ?? '').trim()
  const displayName = String(options.name ?? '').trim().slice(0, 64)
  if (!gid || !pid) return { ok: false, reason: 'no-slot' }
  if (deviceId.length < 8) return { ok: false, reason: 'no-device' }
  if (!firestoreReady()) return { ok: false, reason: 'no-slot' }

  const token = (() => {
    try {
      const a = new Uint8Array(24)
      crypto.getRandomValues(a)
      return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 20)}`.replace(/[^a-z0-9]/gi, '')
        .slice(0, 48)
    }
  })()

  const pref = playerDocRef(gid, pid)
  if (!pref) return { ok: false, reason: 'no-slot' }

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pref)
      if (!snap.exists()) {
        const e = new Error('NO_SLOT')
        e.code = 'NO_SLOT'
        throw e
      }
      const d = snap.data()
      const exTok = typeof d.joinToken === 'string' ? d.joinToken.trim() : ''
      const exDev = typeof d.joinDeviceId === 'string' ? d.joinDeviceId.trim() : ''
      if (exTok.length > 0 && exDev !== deviceId) {
        const e = new Error('TAKEN')
        e.code = 'TAKEN'
        throw e
      }
      const patch = {
        joinToken: token,
        joinDeviceId: deviceId,
        joinClaimedAt: Timestamp.now(),
      }
      if (displayName) patch.name = displayName
      tx.update(pref, patch)
    })
    return { ok: true, token }
  } catch (e) {
    if (e && e.code === 'TAKEN') return { ok: false, reason: 'taken' }
    if (e && e.code === 'NO_SLOT') return { ok: false, reason: 'no-slot' }
    throw e
  }
}

/**
 * Голос: через Callable (submitVote), якщо задано VITE_FUNCTIONS_REGION, інакше — прямий запис (лише dev/легасі).
 * voterPlayerId / round у режимі Callable ігноруються: слот визначається з linkedAuthUid, раунд — з games/{gameId}.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export async function saveVote(gameId, voterPlayerId, targetPlayer, choice, round) {
  const target = String(targetPlayer ?? '').trim()
  const c = choice === 'against' ? 'against' : 'for'
  const gid = String(gameId ?? '').trim()

  if (callableApiEnabled()) {
    if (!gid || !target) return { ok: false, reason: 'invalid' }
    return callSubmitVote(gid, target, c)
  }

  if (!db) return { ok: false, reason: 'invalid' }

  const voter = String(voterPlayerId ?? '').trim()
  const r = Math.floor(Number(round) || 0)
  if (!voter || !target || r < MIN_ROUND) return { ok: false, reason: 'invalid' }
  const voteRef = doc(db, 'games', gameId, 'votes', voter)
  const existing = await getDoc(voteRef)
  if (existing.exists()) {
    const prev = existing.data()
    if (Number(prev.round) === r) return { ok: false, reason: 'already-voted' }
  }
  await setDoc(voteRef, {
    choice: c,
    targetPlayer: target,
    round: r,
    at: Timestamp.now(),
  })
  return { ok: true }
}

const STANDARD_PLAYER_SLOTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']

/**
 * Мінімальний документ кімнати (для транзакцій рук тощо), якщо гри ще немає.
 * @returns {Promise<boolean>} true — документ щойно створено; false — кімната вже була.
 */
export async function ensureGameRoomExists(gameId) {
  const ref = gameDocRef(gameId)
  if (!ref) return false
  const snap = await getDoc(ref)
  if (snap.exists()) return false
  await setDoc(
    ref,
    {
      key: ADMIN_KEY,
      round: 1,
      gamePhase: 'intro',
      hands: {},
      playersReady: {},
      activePlayer: '',
      currentSpeaker: '',
      speakingTimer: 0,
      timerPaused: false,
    },
    { merge: true },
  )
  return true
}

/**
 * Для кожного слоту p1…p10, якщо документа гравця немає — створює з випадковим профілем.
 * Не перезаписує вже існуючих гравців.
 */
export async function seedMissingStandardPlayers(gameId, scenarioId) {
  if (!db) return
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const have = new Set(snapshot.docs.map((d) => normalizePlayerSlotId(d.id)))
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snapshot.docs) {
    mergePlayerDataIntoUsedState(d.data(), usedState)
  }
  for (const slot of STANDARD_PLAYER_SLOTS) {
    if (have.has(slot)) continue
    const payload = buildRandomPlayerDocument(sid, usedState)
    await setDoc(playerDocRef(gameId, slot), { ...payload, key: ADMIN_KEY }, { merge: true })
  }
}

/**
 * Створює перших N слотів (p1…pN) з випадковими персонажами; існуючі слоти в діапазоні не перезаписує.
 */
export async function createFirstNRandomPlayers(gameId, scenarioId, rawCount) {
  if (!db) return
  const n = Math.max(
    1,
    Math.min(STANDARD_PLAYER_SLOTS.length, Math.floor(Number(rawCount) || 1)),
  )
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const have = new Set(snapshot.docs.map((d) => normalizePlayerSlotId(d.id)))
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snapshot.docs) {
    mergePlayerDataIntoUsedState(d.data(), usedState)
  }
  const slots = STANDARD_PLAYER_SLOTS.slice(0, n)
  for (const slot of slots) {
    if (have.has(slot)) continue
    const payload = buildRandomPlayerDocument(sid, usedState)
    await setDoc(playerDocRef(gameId, slot), { ...payload, key: ADMIN_KEY }, { merge: true })
  }
}

/**
 * Якщо документа гравця ще немає — створює випадкового персонажа.
 * @returns {Promise<boolean>} true якщо був створений новий документ
 */
export async function ensurePlayerCharacterExists(gameId, playerId, scenarioId) {
  const pid = normalizePlayerSlotId(playerId)
  const existing = await fetchCharacter(gameId, pid)
  if (existing) return false
  if (!db) return false
  const sid = String(scenarioId || 'classic_crash')
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const usedState = createEmptyUsedState()
  for (const d of snapshot.docs) {
    mergePlayerDataIntoUsedState(d.data(), usedState)
  }
  const payload = buildRandomPlayerDocument(sid, usedState)
  await saveCharacter(gameId, pid, payload)
  return true
}

/** Прибрати гравця зі стану кімнати (руки, номінації, спікер, голосування, spotlight). */
export async function removePlayerFromGameRoomState(gameId, playerId) {
  const pid = normalizePlayerSlotId(playerId)
  debugDelete('removePlayerFromGameRoomState:start', { gameId, pid })
  const gref = gameDocRef(gameId)
  if (!gref) return
  const snap = await getDoc(gref)
  if (!snap.exists()) {
    debugDelete('removePlayerFromGameRoomState:SKIP — документа games/{gameId} немає', {
      gameId,
      path: `games/${gameId}`,
    })
    return
  }
  const d = snap.data()
  const hands = { ...collectRaisedHandsMapFromGameData(d) }
  delete hands[pid]

  const list = nominationsFromRoom(d)
  const next = list.filter((x) => x.target !== pid && x.by !== pid)

  const patch = {
    hands,
    key: ADMIN_KEY,
  }

  const speaker = String(d.currentSpeaker ?? '').trim()
  if (speaker === pid) {
    patch.currentSpeaker = ''
    patch.speakingTimer = 0
    patch.timerStartedAt = deleteField()
    patch.timerPaused = false
    patch.timerRemainingFrozen = deleteField()
  }

  if (String(d.activePlayer ?? '').trim() === pid) {
    patch.activePlayer = ''
  }

  const vt = String(d.voting?.targetPlayer ?? '').trim()
  if (vt === pid) {
    patch.voting = { active: false, targetPlayer: '' }
  }

  if (next.length > 0) {
    patch.nominations = next
    patch.nominatedPlayer = deleteField()
    patch.nominatedBy = deleteField()
  } else {
    patch.nominations = deleteField()
    patch.nominatedPlayer = deleteField()
    patch.nominatedBy = deleteField()
  }

  await setDoc(gref, patch, { merge: true })
  debugDelete('removePlayerFromGameRoomState:setDoc OK')
  await deleteVoteDoc(gameId, pid)
  debugDelete('removePlayerFromGameRoomState:done (vote doc прибрано якщо був)')
}

/**
 * Видалити документ гравця (після removePlayerFromGameRoomState).
 * Шукаємо реальний id документа в колекції (регістр / p04 vs p4), бо deleteDoc на неіснуючий шлях
 * у клієнті часто «успішний» no-op — UI показував тост, а гравець лишався після snapshot.
 */
export async function deletePlayerDocument(gameId, playerId) {
  if (!db) throw new Error('PLAYER_DOC_NOT_FOUND:firebase-disabled')
  const pid = normalizePlayerSlotId(playerId)
  debugDelete('deletePlayerDocument:start', { gameId, pid })
  const directRef = playerDocRef(gameId, pid)
  if (!directRef) throw new Error(`PLAYER_DOC_NOT_FOUND:${pid}`)
  const directSnap = await getDoc(directRef)
  if (directSnap.exists()) {
    debugDelete('deletePlayerDocument:прямий шлях існує, deleteDoc', {
      path: `games/${gameId}/players/${pid}`,
    })
    await deleteDoc(directRef)
    debugDelete('deletePlayerDocument:deleteDoc OK (прямий)')
    return
  }
  debugDelete('deletePlayerDocument:прямого документа немає — getDocs по колекції')
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const docIds = snapshot.docs.map((d) => d.id)
  debugDelete('deletePlayerDocument:документи в колекції', {
    count: docIds.length,
    docIds,
  })
  const match = snapshot.docs.find((d) => normalizePlayerSlotId(d.id) === pid)
  if (!match) {
    debugDelete('deletePlayerDocument:ПОМИЛКА — немає збігу за нормалізованим pid', { pid })
    throw new Error(`PLAYER_DOC_NOT_FOUND:${pid}`)
  }
  debugDelete('deletePlayerDocument:знайдено за id', { firestoreDocId: match.id })
  await deleteDoc(match.ref)
  debugDelete('deletePlayerDocument:deleteDoc OK (за match.id)')
}

export async function regenerateAllPlayersRandom(gameId, scenarioId) {
  if (!db) return
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snapshot.docs) {
    const docPayload = buildRandomPlayerDocument(sid, usedState)
    await setDoc(d.ref, { ...docPayload, key: ADMIN_KEY }, { merge: true })
  }
}

/** Нова випадкова активна карта для кожного гравця в кімнаті. */
export async function regenerateAllPlayersActiveCards(gameId) {
  if (!db) return
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const usedTpl = new Set()
  for (const d of snapshot.docs) {
    const t = pickRandomActiveCardTemplateAvoiding(usedTpl)
    usedTpl.add(t.templateId)
    await setDoc(
      d.ref,
      {
        activeCard: {
          title: t.title,
          description: t.description,
          used: false,
          effectId: t.effectId,
          templateId: t.templateId,
        },
        activeCardRequest: false,
        key: ADMIN_KEY,
      },
      { merge: true },
    )
  }
}

/** Нова випадкова активна карта лише для одного гравця (слот у games/{gameId}/players/{playerId}). */
export async function regeneratePlayerActiveCard(gameId, playerId) {
  if (!db) return
  const pid = normalizePlayerSlotId(playerId)
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const exclude = new Set()
  for (const d of snapshot.docs) {
    if (normalizePlayerSlotId(d.id) === pid) continue
    const tid = normalizeTraitText(d.data()?.activeCard?.templateId)
    if (tid) exclude.add(tid)
  }
  const tpl = pickRandomActiveCardTemplateAvoiding(exclude)
  const pRef = playerDocRef(gameId, pid)
  if (!pRef) return
  await setDoc(
    pRef,
    {
      activeCard: {
        title: tpl.title,
        description: tpl.description,
        used: false,
        effectId: tpl.effectId,
        templateId: tpl.templateId,
      },
      activeCardRequest: false,
      key: ADMIN_KEY,
    },
    { merge: true },
  )
}

/**
 * Оновити всіх гравців у кімнаті: одне поле { value, revealed }.
 * Значення не повторюються між гравцями в межах цього проходу.
 * @param {string} gameId
 * @param {string} fieldKey
 * @param {string} scenarioId
 */
export async function applyGlobalAction(gameId, fieldKey, scenarioId) {
  if (!db) return
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const sid = String(scenarioId || 'classic_crash')
  const used = new Set()
  for (const d of snapshot.docs) {
    const val = rollFieldValue(fieldKey, sid, used)
    used.add(normalizeTraitText(val))
    await setDoc(
      d.ref,
      {
        [fieldKey]: { value: val, revealed: true },
        key: ADMIN_KEY,
      },
      { merge: true },
    )
  }
}

/**
 * Записує дані персонажа: games/{gameId}/players/{playerId}
 * @param {string} gameId
 * @param {string} playerId
 * @param {Record<string, unknown>} data — плоский об’єкт для Firestore
 */
export async function saveCharacter(gameId, playerId, data) {
  const ref = playerDocRef(gameId, playerId)
  if (!ref) return
  await setDoc(
    ref,
    { ...data, key: ADMIN_KEY },
    { merge: true },
  )
}

/**
 * Підписка на зміни документа гравця.
 * @returns {() => void} функція відписки
 */
export function subscribeToCharacter(gameId, playerId, callback) {
  const ref = playerDocRef(gameId, playerId)
  if (!ref) {
    queueMicrotask(() => callback(null))
    return () => {}
  }
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null)
        return
      }
      callback(snapshot.data())
    },
    (err) => {
      logListenerDetach('subscribeToCharacter', err, { gameId, playerId })
      callback(null)
    },
  )
}

/** Одноразове читання (для Control після перезавантаження). */
export async function fetchCharacter(gameId, playerId) {
  const ref = playerDocRef(gameId, playerId)
  if (!ref) return null
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return snapshot.data()
}

/**
 * Підписка на всіх гравців кімнати: games/{gameId}/players/*
 * @param {string} gameId
 * @param {(players: Array<{ id: string } & Record<string, unknown>>) => void} callback
 * @returns {() => void}
 */
export function subscribeToPlayers(gameId, callback) {
  if (!db) {
    queueMicrotask(() => callback([]))
    return () => {}
  }
  const colRef = collection(db, 'games', gameId, 'players')
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: normalizePlayerSlotId(d.id),
        ...d.data(),
      }))
      list.sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }),
      )
      callback(list)
    },
    (err) => {
      logListenerDetach('subscribeToPlayers', err, { gameId })
      callback([])
    },
  )
}
