import { collection, getDocs } from 'firebase/firestore'
import { CORE_FIELD_KEYS } from '../characterState.js'
import { normalizeTraitText, rollFieldValue } from '../data/randomPools.js'
import { ACTIVE_CARD_EFFECT_IDS } from '../data/activeCards.js'
import { db } from '../firebase.js'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'
import { applyGlobalAction, fetchCharacter, saveCharacter } from './gameService.js'

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function chunk(data, key) {
  const c = data[key]
  if (c && typeof c === 'object') return { value: String(c.value ?? ''), revealed: Boolean(c.revealed) }
  return { value: '', revealed: false }
}

const NARRATIVE_EFFECTS = new Set([
  ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  ACTIVE_CARD_EFFECT_IDS.IMMUNITY_ONCE,
  ACTIVE_CARD_EFFECT_IDS.SECOND_CHANCE_ELIMINATION,
  ACTIVE_CARD_EFFECT_IDS.EXTRA_SPEAK_ONCE,
  ACTIVE_CARD_EFFECT_IDS.VETO_VOTE_ROUND,
  ACTIVE_CARD_EFFECT_IDS.FORCE_REVOTE,
  ACTIVE_CARD_EFFECT_IDS.CANCEL_LAST_DECISION,
])

/**
 * @param {string} gameId
 * @param {string} playerId
 * @param {string} effectId
 * @param {string} scenarioId
 */
export async function applyActiveCardEffect(gameId, playerId, effectId, scenarioId) {
  const sid = scenarioId || 'classic_crash'

  if (NARRATIVE_EFFECTS.has(effectId)) {
    return {
      ok: true,
      message: 'Ефект наративний — зафіксуй у шоу. Картку позначено використаною.',
    }
  }

  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_PROFESSION_SELF) {
    return rerollOne(gameId, playerId, 'profession', sid, false)
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_HEALTH_SELF) {
    return rerollOne(gameId, playerId, 'health', sid, false)
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_PHOBIA_SELF) {
    return rerollOne(gameId, playerId, 'phobia', sid, false)
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_LUGGAGE_SELF) {
    return rerollOne(gameId, playerId, 'luggage', sid, false)
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_FACT_SELF) {
    return rerollOne(gameId, playerId, 'fact', sid, false)
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_QUIRK_SELF) {
    return rerollOne(gameId, playerId, 'quirk', sid, false)
  }

  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_RANDOM_TRAIT_SELF) {
    const key = pick(CORE_FIELD_KEYS)
    return rerollOne(gameId, playerId, key, sid, true)
  }

  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_PROFESSION_ALL) {
    await applyGlobalAction(gameId, 'profession', sid)
    return { ok: true, message: 'Усім нова професія' }
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_HEALTH_ALL) {
    await applyGlobalAction(gameId, 'health', sid)
    return { ok: true, message: 'Усім нове здоров’я' }
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_PHOBIA_ALL) {
    await applyGlobalAction(gameId, 'phobia', sid)
    return { ok: true, message: 'Усім нова фобія' }
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.REROLL_LUGGAGE_ALL) {
    await applyGlobalAction(gameId, 'luggage', sid)
    return { ok: true, message: 'Усім новий багаж' }
  }

  if (effectId === ACTIVE_CARD_EFFECT_IDS.REVEAL_ALL_SELF) {
    return setAllRevealed(gameId, playerId, true)
  }
  if (effectId === ACTIVE_CARD_EFFECT_IDS.HIDE_ALL_SELF) {
    return setAllRevealed(gameId, playerId, false)
  }

  if (effectId === ACTIVE_CARD_EFFECT_IDS.SWAP_TWO_TRAITS_SELF) {
    const data = await fetchCharacter(gameId, playerId)
    if (!data) return { ok: false, message: 'Немає даних гравця' }
    const a = pick(CORE_FIELD_KEYS)
    let b = pick(CORE_FIELD_KEYS)
    let guard = 0
    while (b === a && guard++ < 8) b = pick(CORE_FIELD_KEYS)
    const ca = chunk(data, a)
    const cb = chunk(data, b)
    await saveCharacter(gameId, playerId, {
      [a]: { value: cb.value, revealed: ca.revealed },
      [b]: { value: ca.value, revealed: cb.revealed },
    })
    return { ok: true, message: `Обміняно: ${a} ↔ ${b}` }
  }

  return { ok: false, message: 'Невідомий ефект' }
}

async function rerollOne(gameId, playerId, key, scenarioId, reveal) {
  if (!db) return { ok: false, message: 'Firestore не налаштовано' }
  const data = await fetchCharacter(gameId, playerId)
  if (!data) return { ok: false, message: 'Немає даних гравця' }
  const pid = normalizePlayerSlotId(playerId)
  const colRef = collection(db, 'games', gameId, 'players')
  const snapshot = await getDocs(colRef)
  const exclude = new Set()
  for (const d of snapshot.docs) {
    if (normalizePlayerSlotId(d.id) === pid) continue
    const pl = d.data()
    const v = normalizeTraitText(pl[key]?.value)
    if (v) exclude.add(v)
  }
  const nv = rollFieldValue(key, scenarioId, exclude)
  await saveCharacter(gameId, playerId, {
    [key]: { value: nv, revealed: reveal },
  })
  return { ok: true, message: `Оновлено: ${key}` }
}

async function setAllRevealed(gameId, playerId, revealed) {
  const data = await fetchCharacter(gameId, playerId)
  if (!data) return { ok: false, message: 'Немає даних гравця' }
  const patch = {}
  for (const k of CORE_FIELD_KEYS) {
    const ch = chunk(data, k)
    patch[k] = { value: ch.value, revealed }
  }
  await saveCharacter(gameId, playerId, patch)
  return { ok: true, message: revealed ? 'Усі картки відкрито' : 'Усі картки закрито' }
}
