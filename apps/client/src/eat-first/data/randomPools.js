import { FIELD_KEYS, assignRandomActiveCard } from '../characterState'
import { scenarios } from './scenarios.js'
import {
  professions,
  healthConditions,
  phobias,
  baggage,
  facts,
  quirks,
} from './pools/characterPools.js'

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function normalizeTraitText(v) {
  return String(v ?? '').trim()
}

/** @param {unknown[]} pool @param {Set<string>|Iterable<string>} excludeNormalized */
export function pickFromPoolAvoiding(pool, excludeNormalized) {
  const arr = Array.isArray(pool) ? pool : []
  const ex = excludeNormalized instanceof Set ? excludeNormalized : new Set(excludeNormalized)
  const candidates = arr.filter((x) => !ex.has(normalizeTraitText(x)))
  if (candidates.length) return pick(candidates)
  return pick(arr)
}

export function createEmptyUsedState() {
  const usedByField = {}
  for (const key of FIELD_KEYS) {
    usedByField[key] = new Set()
  }
  return { usedByField, usedTemplateIds: new Set() }
}

/** Дані гравця (Firestore або зі списку в UI) — додає зайняті значення в usedState. */
export function mergePlayerDataIntoUsedState(data, usedState) {
  if (!data || typeof data !== 'object' || !usedState) return
  for (const key of FIELD_KEYS) {
    const ch = data[key]
    const v = ch && typeof ch === 'object' ? normalizeTraitText(ch.value) : ''
    if (v) usedState.usedByField[key].add(v)
  }
  const tid = normalizeTraitText(data.activeCard?.templateId)
  if (tid) usedState.usedTemplateIds.add(tid)
}

export const PLAYER_AGE_MIN = 18
export const PLAYER_AGE_MAX = 100

/** Випадковий вік гравця (ціле 18–100 років), рядок для поля `age`. */
export function randomPlayerAgeString() {
  const n = Math.floor(Math.random() * (PLAYER_AGE_MAX - PLAYER_AGE_MIN + 1)) + PLAYER_AGE_MIN
  return String(n)
}

export const genders = ['Чоловік', 'Жінка', 'Non-binary', 'Не вказано']

const namesMale = [
  'Олексій',
  'Дмитро',
  'Андрій',
  'Бодя',
  'Сергій',
  'Макс',
  'Тарас',
  'Ігор',
  'Роман',
  'Петро',
  'Василь',
  'Микола',
  'Єгор',
  'Артем',
  'Олег',
]

const namesFemale = [
  'Марія',
  'Катерина',
  'Олена',
  'Настя',
  'Ірина',
  'Юля',
  'Світлана',
  'Христина',
  'Віка',
  'Леся',
  'Анна',
  'Софія',
  'Дарина',
  'Тетяна',
  'Оксана',
]

const namesNeutral = [
  'Алекс',
  'Саша',
  'Женя',
  'Нікі',
  'Райан',
  'Джордан',
  'Кейсі',
]

/** Для сумісності / старих сценаріїв */
export const displayNames = [...namesMale, ...namesFemale]

export function pickNameForGender(gender) {
  const g = String(gender || '')
  if (g === 'Чол.' || g === 'Чоловік' || /^чол/i.test(g)) return pick(namesMale)
  if (g === 'Жін.' || g === 'Жінка' || /^жін/i.test(g)) return pick(namesFemale)
  return pick([...namesNeutral, ...namesMale, ...namesFemale])
}

const DEFAULT_POOLS = {
  profession: professions,
  health: healthConditions,
  phobia: phobias,
  luggage: baggage,
  fact: facts,
  quirk: quirks,
}

export function poolForScenarioField(scenarioId, fieldKey) {
  const sc = scenarioId && scenarios[scenarioId]
  if (sc && Array.isArray(sc[fieldKey]) && sc[fieldKey].length) {
    return sc[fieldKey]
  }
  return DEFAULT_POOLS[fieldKey] ?? ['—']
}

/**
 * @param {import('vue').Reactive | object} target
 * @param {{
 *   scenarioId?: string,
 *   keys?: string[],
 *   skipActiveCard?: boolean,
 *   usedState?: { usedByField: Record<string, Set<string>>, usedTemplateIds: Set<string> },
 * }} [options]
 */
export function rollRandomIntoCharacter(target, options = {}) {
  const sid =
    options.scenarioId && scenarios[options.scenarioId] ? options.scenarioId : 'classic_crash'
  const keys = Array.isArray(options.keys) && options.keys.length ? options.keys : FIELD_KEYS
  const us = options.usedState ?? createEmptyUsedState()

  target.gender = pick(genders)
  target.name = pickNameForGender(target.gender)
  target.age = randomPlayerAgeString()
  target.identityRevealed = false
  target.demographicsRevealed = false
  target.revealLedger = { round: 0, count: 0, maxForRound: 0 }
  for (const key of keys) {
    const slot = target[key]
    if (!slot || typeof slot !== 'object') continue
    const pool = poolForScenarioField(sid, key)
    const setForKey = us.usedByField[key] || new Set()
    const val = pickFromPoolAvoiding(pool, setForKey)
    setForKey.add(normalizeTraitText(val))
    us.usedByField[key] = setForKey
    slot.value = val
    slot.revealed = false
  }
  if (!options.skipActiveCard) {
    assignRandomActiveCard(target, { usedTemplateIds: us.usedTemplateIds })
  }
}

/**
 * @param {string} fieldKey
 * @param {string} [scenarioId]
 * @param {Set<string>|Iterable<string>} [excludeNormalized] значення інших гравців у кімнаті (нормалізовані рядки)
 */
export function rollFieldValue(fieldKey, scenarioId = 'classic_crash', excludeNormalized) {
  const pool = poolForScenarioField(scenarioId, fieldKey)
  return pickFromPoolAvoiding(pool, excludeNormalized ?? new Set())
}

export function rollKeysIntoCharacter(target, keys, scenarioId = 'classic_crash', usedState = null) {
  const sid = scenarioId && scenarios[scenarioId] ? scenarioId : 'classic_crash'
  const us = usedState ?? createEmptyUsedState()
  for (const key of keys) {
    const slot = target[key]
    if (!slot || typeof slot !== 'object') continue
    const pool = poolForScenarioField(sid, key)
    const setForKey = us.usedByField[key] || new Set()
    const val = pickFromPoolAvoiding(pool, setForKey)
    setForKey.add(normalizeTraitText(val))
    us.usedByField[key] = setForKey
    slot.value = val
    slot.revealed = false
  }
}

/**
 * Значення поля, уже зайняті іншими гравцями (plain objects як у allPlayers).
 * @param {string} exceptPlayerId — id слота, якого не враховуємо (редактор)
 */
export function traitExcludeSetFromPlayers(players, fieldKey, exceptPlayerId) {
  const ex = new Set()
  const skip = exceptPlayerId != null && exceptPlayerId !== '' ? String(exceptPlayerId) : null
  for (const p of players || []) {
    if (skip != null && String(p.id) === skip) continue
    const ch = p[fieldKey]
    const v = ch && typeof ch === 'object' ? normalizeTraitText(ch.value) : ''
    if (v) ex.add(v)
  }
  return ex
}

export function activeTemplateExcludeSetFromPlayers(players, exceptPlayerId) {
  const ex = new Set()
  const skip = exceptPlayerId != null && exceptPlayerId !== '' ? String(exceptPlayerId) : null
  for (const p of players || []) {
    if (skip != null && String(p.id) === skip) continue
    const ac = p.activeCard
    const tid = ac && typeof ac === 'object' ? normalizeTraitText(ac.templateId) : ''
    if (tid) ex.add(tid)
  }
  return ex
}

/**
 * @param {string} [scenarioId]
 * @param {{ usedByField: Record<string, Set<string>>, usedTemplateIds: Set<string> } | null} [usedState] якщо передано — мутується (унікальність у кімнаті)
 */
export function buildRandomPlayerDocument(scenarioId = 'classic_crash', usedState = null) {
  const sid = scenarioId && scenarios[scenarioId] ? scenarioId : 'classic_crash'
  const us = usedState ?? createEmptyUsedState()
  const gender = pick(genders)
  const out = {
    eliminated: false,
    identityRevealed: false,
    demographicsRevealed: false,
    name: pickNameForGender(gender),
    age: randomPlayerAgeString(),
    gender,
    activeCardRequest: false,
  }
  for (const key of FIELD_KEYS) {
    const pool = poolForScenarioField(sid, key)
    const setForKey = us.usedByField[key] || new Set()
    const val = pickFromPoolAvoiding(pool, setForKey)
    setForKey.add(normalizeTraitText(val))
    us.usedByField[key] = setForKey
    out[key] = {
      value: val,
      revealed: false,
    }
  }
  assignRandomActiveCard(out, { usedTemplateIds: us.usedTemplateIds })
  return out
}
