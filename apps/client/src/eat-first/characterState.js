import { reactive } from 'vue'
import { pickRandomActiveCardTemplateAvoiding } from './data/activeCards.js'
import { normalizeGenderForStorage } from './utils/genderDisplay.js'

export const GAME_TITLE = 'Кого ми з’їмо першим'

export const CORE_FIELD_KEYS = ['profession', 'health', 'phobia', 'luggage', 'fact', 'quirk']

export const FIELD_KEYS = [...CORE_FIELD_KEYS]

export function defaultActiveCard() {
  return {
    title: '',
    description: '',
    used: false,
    effectId: '',
    templateId: '',
  }
}

export const characterState = reactive({
  eliminated: false,
  /**
   * Ліміт відкриттів характеристик за раунд (гравець, не ведучий).
   * round: останній ігровий раунд, для якого застосовано count/maxForRound; 0 = ще не синхронізовано.
   */
  revealLedger: { round: 0, count: 0, maxForRound: 0 },
  /** Legacy: синхронізується з demographicsRevealed при збереженні */
  identityRevealed: false,
  /** Вік і стать на оверлеї; ім’я завжди видно окремо */
  demographicsRevealed: false,
  name: '',
  age: '',
  gender: '',
  profession: { value: '', revealed: false },
  health: { value: '', revealed: false },
  phobia: { value: '', revealed: false },
  luggage: { value: '', revealed: false },
  fact: { value: '', revealed: false },
  quirk: { value: '', revealed: false },
  activeCard: defaultActiveCard(),
  activeCardRequest: false,
})

export const fieldConfig = [
  { key: 'profession', label: 'Професія' },
  { key: 'health', label: 'Здоров’я' },
  { key: 'phobia', label: 'Фобія' },
  { key: 'luggage', label: 'Багаж' },
  { key: 'fact', label: 'Факт' },
  { key: 'quirk', label: 'Особливість' },
]

export function resetCharacterState(target = characterState) {
  target.eliminated = false
  target.revealLedger = { round: 0, count: 0, maxForRound: 0 }
  target.identityRevealed = false
  target.demographicsRevealed = false
  target.name = ''
  target.age = ''
  target.gender = ''
  for (const key of FIELD_KEYS) {
    target[key].value = ''
    target[key].revealed = false
  }
  target.activeCard = defaultActiveCard()
  target.activeCardRequest = false
}

function readActiveCard(data) {
  const ac = data.activeCard
  if (ac && typeof ac === 'object') {
    return {
      title: typeof ac.title === 'string' ? ac.title : '',
      description: typeof ac.description === 'string' ? ac.description : '',
      used: Boolean(ac.used),
      effectId: typeof ac.effectId === 'string' ? ac.effectId : '',
      templateId: typeof ac.templateId === 'string' ? ac.templateId : '',
    }
  }
  return defaultActiveCard()
}

export function applyRemoteCharacterData(target, data) {
  if (!data || typeof data !== 'object') {
    resetCharacterState(target)
    return
  }
  target.eliminated = Boolean(data.eliminated)
  const legacyId = Boolean(data.identityRevealed)
  const dem =
    data.demographicsRevealed === true ||
    (data.demographicsRevealed === undefined && legacyId)
  target.demographicsRevealed = dem
  target.identityRevealed = dem
  if (typeof data.name === 'string') target.name = data.name
  else target.name = ''
  if (typeof data.age === 'string') target.age = data.age
  else target.age = ''
  if (typeof data.gender === 'string') target.gender = normalizeGenderForStorage(data.gender)
  else target.gender = ''
  for (const key of FIELD_KEYS) {
    const chunk = data[key]
    if (chunk && typeof chunk === 'object') {
      target[key].value = typeof chunk.value === 'string' ? chunk.value : ''
      target[key].revealed = Boolean(chunk.revealed)
    } else {
      target[key].value = ''
      target[key].revealed = false
    }
  }
  target.activeCard = readActiveCard(data)
  target.activeCardRequest = Boolean(data.activeCardRequest)
  const rl = data.revealLedger
  if (rl && typeof rl === 'object') {
    const r = Math.floor(Number(rl.round) || 0)
    const c = Math.max(0, Math.floor(Number(rl.count) || 0))
    const m = Math.floor(Number(rl.maxForRound) || 0)
    target.revealLedger = { round: r, count: c, maxForRound: m }
  } else {
    target.revealLedger = { round: 0, count: 0, maxForRound: 0 }
  }
}

export function snapshotCharacter(target = characterState) {
  const dem = Boolean(target.demographicsRevealed)
  const rl = target.revealLedger
  const out = {
    eliminated: Boolean(target.eliminated),
    revealLedger: {
      round: Math.min(8, Math.max(0, Math.floor(Number(rl?.round) || 0))),
      count: Math.max(0, Math.floor(Number(rl?.count) || 0)),
      maxForRound: Math.min(8, Math.max(0, Math.floor(Number(rl?.maxForRound) || 0))),
    },
    demographicsRevealed: dem,
    identityRevealed: dem,
    name: target.name,
    age: target.age,
    gender: normalizeGenderForStorage(target.gender),
    activeCard: {
      title: target.activeCard.title,
      description: target.activeCard.description,
      used: Boolean(target.activeCard.used),
      effectId: target.activeCard.effectId,
      templateId: target.activeCard.templateId,
    },
    activeCardRequest: Boolean(target.activeCardRequest),
  }
  for (const key of FIELD_KEYS) {
    out[key] = {
      value: target[key].value,
      revealed: target[key].revealed,
    }
  }
  return out
}

/**
 * @param {object} [target]
 * @param {{ usedTemplateIds?: Set<string>, excludeTemplateIds?: Set<string> }} [options]
 * usedTemplateIds — накопичувальний набір: вибір уникає цих id, після призначення новий templateId додається.
 * excludeTemplateIds — лише виключення при виборі (наприклад карти інших гравців), без додавання.
 */
export function assignRandomActiveCard(target = characterState, options = {}) {
  const cumulative = options.usedTemplateIds
  const exclude =
    cumulative ?? options.excludeTemplateIds ?? new Set()
  const t = pickRandomActiveCardTemplateAvoiding(exclude)
  target.activeCard = {
    title: t.title,
    description: t.description,
    used: false,
    effectId: t.effectId,
    templateId: t.templateId,
  }
  target.activeCardRequest = false
  if (cumulative) cumulative.add(t.templateId)
}
