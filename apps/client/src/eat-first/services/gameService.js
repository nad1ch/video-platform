import { pickRandomActiveCardTemplateAvoiding } from '../data/activeCards.js'
import {
  buildRandomPlayerDocument,
  createEmptyUsedState,
  mergePlayerDataIntoUsedState,
  normalizeTraitText,
  rollFieldValue,
} from '../data/randomPools.js'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'
import { subscribeEatFirstChannel, subscribeToCharacterChannel } from './eatFirstSync.js'
import {
  efClearVotes,
  efClaimSlot,
  efDeletePlayer,
  efDeleteVote,
  efEnsureGame,
  efPatchPlayer,
  efPatchRoom,
  efPostHand,
  efPostReady,
  efReviveEliminated,
  efSnapshot,
  efSubmitVote,
} from './eatFirstTransport.js'
import { debugDelete } from '../utils/debugDelete.js'
import { logListenerDetach } from '../utils/appLogger.js'

function nowIso() {
  return new Date().toISOString()
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

/**
 * @param {string} gameId
 * @param {(players: Array<{ id: string } & Record<string, unknown>>) => void} callback
 */
export async function setPlayerReady(gameId, playerId, ready) {
  const raw = String(playerId ?? '').trim()
  if (!raw) return
  const pid = normalizePlayerSlotId(playerId)
  try {
    await efPostReady(String(gameId ?? '').trim(), pid, Boolean(ready))
  } catch (e) {
    logListenerDetach('setPlayerReady', e, { gameId, playerId: pid })
  }
}

export function subscribeToGameRoom(gameId, callback) {
  const gid = String(gameId ?? '').trim()
  if (!gid) {
    queueMicrotask(() => callback({}))
    return () => {}
  }
  return subscribeEatFirstChannel(gid, 'room', (d) => {
    callback(d && typeof d === 'object' ? d : {})
  })
}

export async function saveGameRoom(gameId, partial) {
  const p =
    partial && typeof partial === 'object'
      ? { ...partial }
      : {}
  delete p.key
  await efPatchRoom(String(gameId ?? '').trim(), { ...p })
}

export async function startSpeakingTimer(gameId, speakerId, seconds) {
  const refGameId = String(gameId ?? '').trim()
  if (!refGameId) return
  const sec = Math.max(1, Math.floor(Number(seconds) || 30))
  const sp = String(speakerId || '').trim()
  await efPatchRoom(refGameId, {
    currentSpeaker: sp,
    speakingTimer: sec,
    timerStartedAt: nowIso(),
    timerPaused: false,
    timerRemainingFrozen: null,
  })
}

export async function clearSpeakingTimer(gameId) {
  const refGameId = String(gameId ?? '').trim()
  if (!refGameId) return
  await efPatchRoom(refGameId, {
    currentSpeaker: '',
    timerStartedAt: null,
    speakingTimer: 0,
    timerPaused: false,
    timerRemainingFrozen: null,
  })
}

export async function pauseSpeakingTimer(gameId, remainingSeconds) {
  const refGameId = String(gameId ?? '').trim()
  if (!refGameId) return
  const r = Math.max(0, Math.floor(Number(remainingSeconds) || 0))
  await efPatchRoom(refGameId, {
    timerPaused: true,
    timerRemainingFrozen: r,
    timerStartedAt: null,
  })
}

export async function resumeSpeakingTimer(gameId) {
  const refGameId = String(gameId ?? '').trim()
  if (!refGameId) return
  const snap = await efSnapshot(refGameId)
  const d = snap?.room && typeof snap.room === 'object' ? snap.room : {}
  const rem = Math.max(1, Number(d.timerRemainingFrozen || d.speakingTimer) || 30)
  const sp = String(d.currentSpeaker ?? '').trim()
  await efPatchRoom(refGameId, {
    timerPaused: false,
    speakingTimer: rem,
    timerStartedAt: nowIso(),
    timerRemainingFrozen: null,
    ...(sp ? { currentSpeaker: sp } : {}),
  })
}

const GAME_PHASES = new Set(['intro', 'discussion', 'voting', 'final'])

export async function setGamePhase(gameId, phase) {
  const p = String(phase || 'intro')
  const next = GAME_PHASES.has(p) ? p : 'intro'
  await saveGameRoom(gameId, { gamePhase: next })
}

export async function resetGameRoomControls(gameId) {
  const refGameId = String(gameId ?? '').trim()
  if (!refGameId) return
  await efPatchRoom(refGameId, {
    activePlayer: '',
    currentSpeaker: '',
    speakingTimer: 0,
    timerStartedAt: null,
    timerPaused: false,
    timerRemainingFrozen: null,
    gamePhase: 'intro',
    round: 1,
    nominatedPlayer: null,
    nominatedBy: null,
    nominations: null,
    nominationOneTargetPerRound: null,
    hands: {},
    playersReady: {},
    voting: null,
    voteTargetsThisRound: null,
  })
}

export function subscribeToVotes(gameId, callback) {
  const gid = String(gameId ?? '').trim()
  if (!gid) {
    queueMicrotask(() => callback([]))
    return () => {}
  }
  return subscribeEatFirstChannel(gid, 'votes', (list) => {
    const arr = Array.isArray(list) ? list : []
    callback(arr)
  })
}

export async function clearAllVotes(gameId) {
  await efClearVotes(String(gameId ?? '').trim())
}

export async function deleteVoteDoc(gameId, voterId) {
  const raw = String(voterId ?? '').trim()
  if (!raw) return
  const v = normalizePlayerSlotId(raw)
  await efDeleteVote(String(gameId ?? '').trim(), v)
}

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

export function nominationsFromRoom(gr) {
  const raw = normalizeNominations(gr?.nominations)
  if (raw.length) return raw
  const t = String(gr?.nominatedPlayer ?? '').trim()
  const b = String(gr?.nominatedBy ?? '').trim()
  if (t && b) return [{ target: t, by: b }]
  return []
}

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

export async function setGameNominations(gameId, list) {
  const next = normalizeNominations(list)
  await saveGameRoom(gameId, {
    nominations: next,
    nominatedPlayer: null,
    nominatedBy: null,
  })
}

export async function setNominatedPlayer(gameId, playerId, nominatedBySlot) {
  const p = String(playerId ?? '').trim()
  const by = String(nominatedBySlot ?? '').trim()
  if (!p) {
    await saveGameRoom(gameId, {
      nominatedPlayer: '',
      nominatedBy: null,
      nominations: null,
    })
    return
  }
  await saveGameRoom(gameId, {
    nominatedPlayer: p,
    nominatedBy: by || null,
    nominations: null,
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
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const snap = await efSnapshot(gid)
  const gr = snap?.room && typeof snap.room === 'object' ? snap.room : {}
  const cur = Math.floor(Number(gr.round) || 1) || 1
  const next = Math.min(MAX_ROUND, cur + 1)
  await saveGameRoom(gid, { round: next, voteTargetsThisRound: [] })
  await clearAllVotes(gid)
}

export async function resetRoomRoundCounter(gameId) {
  await saveGameRoom(gameId, { round: 1, voteTargetsThisRound: [] })
  await clearAllVotes(gameId)
}

export async function clearAllHands(gameId) {
  await saveGameRoom(gameId, { hands: {} })
}

export async function reviveAllEliminatedPlayers(gameId) {
  await efReviveEliminated(String(gameId ?? '').trim())
}

export async function setRoomVoting(gameId, active, targetPlayer, options = {}) {
  const tp = String(targetPlayer ?? '').trim()
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const snap = await efSnapshot(gid)
  const data = snap?.room && typeof snap.room === 'object' ? snap.room : {}
  const curV = data.voting && typeof data.voting === 'object' ? { ...data.voting } : {}

  if (!active && !tp) {
    const cleared = {
      ...curV,
      active: false,
      targetPlayer: '',
      voteSlotStartedAt: null,
    }
    if (options.clearBallot) {
      cleared.ballotQueue = null
      cleared.ballotIndex = null
      cleared.ballotRunId = null
      cleared.ballotRound = null
      cleared.ballotSource = null
    }
    await saveGameRoom(gid, { voting: cleared })
    return
  }

  const next = { ...curV, active: Boolean(active), targetPlayer: tp }
  if (active && tp) {
    const sec = Math.max(
      1,
      Math.floor(Number(options.slotDurationSec) || Number(curV.slotDurationSec) || 5),
    )
    next.slotDurationSec = sec
    next.voteSlotStartedAt = nowIso()
  } else {
    next.voteSlotStartedAt = null
  }

  await saveGameRoom(gid, { voting: next })
}

export async function setGameHandRaised(gameId, playerId, raised) {
  const raw = String(playerId ?? '').trim()
  if (!raw) return
  const pid = normalizePlayerSlotId(playerId)
  try {
    await efPostHand(String(gameId ?? '').trim(), pid, Boolean(raised))
  } catch (e) {
    logListenerDetach('setGameHandRaised', e, { gameId, playerId: pid })
  }
}

export async function claimPlayerSlot(gameId, playerId, options = {}) {
  const gid = String(gameId ?? '').trim()
  const pid = normalizePlayerSlotId(playerId)
  const deviceId = String(options.deviceId ?? '').trim()
  const displayName = String(options.name ?? '').trim().slice(0, 64)
  if (!gid || !pid) return { ok: false, reason: 'no-slot' }
  if (deviceId.length < 8) return { ok: false, reason: 'no-device' }
  try {
    const out = await efClaimSlot(gid, pid, deviceId, displayName)
    if (out && out.ok === true && typeof out.token === 'string') {
      return { ok: true, token: out.token }
    }
    if (out && out.ok === false && out.reason) {
      return { ok: false, reason: out.reason }
    }
    return { ok: false, reason: 'no-slot' }
  } catch {
    return { ok: false, reason: 'no-slot' }
  }
}

export async function saveVote(gameId, voterPlayerId, targetPlayer, choice, round) {
  const target = String(targetPlayer ?? '').trim()
  const c = choice === 'against' ? 'against' : 'for'
  const gid = String(gameId ?? '').trim()
  if (!gid || !target) return { ok: false, reason: 'invalid' }
  const voter = String(voterPlayerId ?? '').trim()
  const r = Math.floor(Number(round) || 0)
  if (!voter || !target || r < MIN_ROUND) return { ok: false, reason: 'invalid' }
  try {
    const out = await efSubmitVote(gid, voter, target, c, r)
    return out && typeof out === 'object' ? out : { ok: false, reason: 'invalid' }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

const STANDARD_PLAYER_SLOTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']

export async function ensureGameRoomExists(gameId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return false
  return efEnsureGame(gid)
}

export async function seedMissingStandardPlayers(gameId, scenarioId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const snap = await efSnapshot(gid)
  const have = new Set((snap.players || []).map((d) => normalizePlayerSlotId(d.id)))
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snap.players || []) {
    mergePlayerDataIntoUsedState(d, usedState)
  }
  for (const slot of STANDARD_PLAYER_SLOTS) {
    if (have.has(slot)) continue
    const payload = buildRandomPlayerDocument(sid, usedState)
    await efPatchPlayer(gid, slot, { ...payload })
  }
}

export async function createFirstNRandomPlayers(gameId, scenarioId, rawCount) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const n = Math.max(
    1,
    Math.min(STANDARD_PLAYER_SLOTS.length, Math.floor(Number(rawCount) || 1)),
  )
  const snap = await efSnapshot(gid)
  const have = new Set((snap.players || []).map((d) => normalizePlayerSlotId(d.id)))
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snap.players || []) {
    mergePlayerDataIntoUsedState(d, usedState)
  }
  const slots = STANDARD_PLAYER_SLOTS.slice(0, n)
  for (const slot of slots) {
    if (have.has(slot)) continue
    const payload = buildRandomPlayerDocument(sid, usedState)
    await efPatchPlayer(gid, slot, { ...payload })
  }
}

export async function ensurePlayerCharacterExists(gameId, playerId, scenarioId) {
  const pid = normalizePlayerSlotId(playerId)
  const existing = await fetchCharacter(gameId, pid)
  if (existing) return false
  const gid = String(gameId ?? '').trim()
  if (!gid) return false
  const snap = await efSnapshot(gid)
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snap.players || []) {
    mergePlayerDataIntoUsedState(d, usedState)
  }
  const payload = buildRandomPlayerDocument(sid, usedState)
  await saveCharacter(gid, pid, payload)
  return true
}

export async function removePlayerFromGameRoomState(gameId, playerId) {
  const gid = String(gameId ?? '').trim()
  const pid = normalizePlayerSlotId(playerId)
  debugDelete('removePlayerFromGameRoomState:start', { gameId: gid, pid })
  if (!gid) return
  const snap = await efSnapshot(gid)
  const d = snap?.room && typeof snap.room === 'object' ? snap.room : {}
  if (!d || Object.keys(d).length === 0) {
    debugDelete('removePlayerFromGameRoomState:SKIP — немає кімнати', { gameId: gid })
    return
  }
  const hands = { ...collectRaisedHandsMapFromGameData(d) }
  delete hands[pid]

  const list = nominationsFromRoom(d)
  const next = list.filter((x) => x.target !== pid && x.by !== pid)

  const patch = {
    hands,
  }

  const speaker = String(d.currentSpeaker ?? '').trim()
  if (speaker === pid) {
    patch.currentSpeaker = ''
    patch.speakingTimer = 0
    patch.timerStartedAt = null
    patch.timerPaused = false
    patch.timerRemainingFrozen = null
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
    patch.nominatedPlayer = null
    patch.nominatedBy = null
  } else {
    patch.nominations = null
    patch.nominatedPlayer = null
    patch.nominatedBy = null
  }

  await efPatchRoom(gid, patch)
  debugDelete('removePlayerFromGameRoomState:patch OK')
  await deleteVoteDoc(gid, pid)
  debugDelete('removePlayerFromGameRoomState:done (vote doc прибрано якщо був)')
}

export async function deletePlayerDocument(gameId, playerId) {
  const gid = String(gameId ?? '').trim()
  const pid = normalizePlayerSlotId(playerId)
  debugDelete('deletePlayerDocument:start', { gameId: gid, pid })
  if (!gid) throw new Error(`PLAYER_DOC_NOT_FOUND:${pid}`)
  const snap = await efSnapshot(gid)
  const match = (snap.players || []).find((p) => normalizePlayerSlotId(p.id) === pid)
  if (!match) {
    debugDelete('deletePlayerDocument:ПОМИЛКА — немає збігу за нормалізованим pid', { pid })
    throw new Error(`PLAYER_DOC_NOT_FOUND:${pid}`)
  }
  await efDeletePlayer(gid, normalizePlayerSlotId(match.id))
  debugDelete('deletePlayerDocument:delete OK')
}

export async function regenerateAllPlayersRandom(gameId, scenarioId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const snap = await efSnapshot(gid)
  const sid = String(scenarioId || 'classic_crash')
  const usedState = createEmptyUsedState()
  for (const d of snap.players || []) {
    mergePlayerDataIntoUsedState(d, usedState)
  }
  for (const d of snap.players || []) {
    const docPayload = buildRandomPlayerDocument(sid, usedState)
    await efPatchPlayer(gid, normalizePlayerSlotId(d.id), { ...docPayload })
  }
}

export async function regenerateAllPlayersActiveCards(gameId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const snap = await efSnapshot(gid)
  const usedTpl = new Set()
  for (const d of snap.players || []) {
    const t = pickRandomActiveCardTemplateAvoiding(usedTpl)
    usedTpl.add(t.templateId)
    await efPatchPlayer(gid, normalizePlayerSlotId(d.id), {
      activeCard: {
        title: t.title,
        description: t.description,
        used: false,
        effectId: t.effectId,
        templateId: t.templateId,
      },
      activeCardRequest: false,
    })
  }
}

export async function regeneratePlayerActiveCard(gameId, playerId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const pid = normalizePlayerSlotId(playerId)
  const snap = await efSnapshot(gid)
  const exclude = new Set()
  for (const d of snap.players || []) {
    if (normalizePlayerSlotId(d.id) === pid) continue
    const tid = normalizeTraitText(d.activeCard?.templateId)
    if (tid) exclude.add(tid)
  }
  const tpl = pickRandomActiveCardTemplateAvoiding(exclude)
  await efPatchPlayer(gid, pid, {
    activeCard: {
      title: tpl.title,
      description: tpl.description,
      used: false,
      effectId: tpl.effectId,
      templateId: tpl.templateId,
    },
    activeCardRequest: false,
  })
}

export async function applyGlobalAction(gameId, fieldKey, scenarioId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return
  const snap = await efSnapshot(gid)
  const sid = String(scenarioId || 'classic_crash')
  const used = new Set()
  for (const d of snap.players || []) {
    const val = rollFieldValue(fieldKey, sid, used)
    used.add(normalizeTraitText(val))
    await efPatchPlayer(gid, normalizePlayerSlotId(d.id), {
      [fieldKey]: { value: val, revealed: true },
    })
  }
}

export async function saveCharacter(gameId, playerId, data) {
  const pid = normalizePlayerSlotId(playerId)
  const payload = data && typeof data === 'object' ? { ...data } : {}
  await efPatchPlayer(String(gameId ?? '').trim(), pid, { ...payload })
}

export function subscribeToCharacter(gameId, playerId, callback) {
  const gid = String(gameId ?? '').trim()
  if (!gid) {
    queueMicrotask(() => callback(null))
    return () => {}
  }
  return subscribeToCharacterChannel(gid, playerId, (data) => {
    callback(data)
  })
}

export async function fetchCharacter(gameId, playerId) {
  const gid = String(gameId ?? '').trim()
  if (!gid) return null
  const snap = await efSnapshot(gid)
  const pid = normalizePlayerSlotId(playerId)
  const row = (snap.players || []).find((p) => normalizePlayerSlotId(p.id) === pid)
  if (!row) return null
  const rest = { ...row }
  delete rest.id
  return rest
}

export function subscribeToPlayers(gameId, callback) {
  const gid = String(gameId ?? '').trim()
  if (!gid) {
    queueMicrotask(() => callback([]))
    return () => {}
  }
  return subscribeEatFirstChannel(gid, 'players', (list) => {
    const arr = Array.isArray(list) ? list : []
    const mapped = arr.map((d) => ({
      id: normalizePlayerSlotId(d.id),
      ...Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'id')),
    }))
    mapped.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }),
    )
    callback(mapped)
  })
}
