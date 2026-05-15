/**
 * Per-room Eat First table state. Server-authoritative mirror of everything
 * the call-tile overlay and host panel render: player order, trait values per
 * slot, action card per slot, reveal/openedBy state, last used action card,
 * timer.
 *
 * All mutations go through this module so a single broadcast helper can emit
 * a complete snapshot (`eat:trait-state-sync`) on every change. Hydration from
 * Prisma is lazy: on first access for a room we read player rows + room JSON
 * once and seed the state; subsequent reads are pure memory.
 *
 * State is kept per signaling roomId (not per gameId) so it is naturally
 * scoped to the live SFU room and disposed in `finalizeRoomIfEmpty`.
 */

import type { Room } from '../rooms/Room'
import type { Peer } from '../peers/Peer'
import { prisma } from '../prisma'
import {
  deriveEatFirstDefaultPlayerOrder,
  isEatFirstPlayerSlotId,
  resolveEatFirstEffectivePlayerOrder,
} from './playerOrder'
import { normalizeEatFirstSlot } from './slot'
import {
  EAT_FIRST_TRAIT_KEYS,
  pickEatFirstTraitValue,
  type EatFirstTraitKey,
} from './randomPools'
import type { EatFirstActiveCardSnapshot } from './activeCards'
import { pickRandomEatFirstActiveCard } from './activeCards'
import { eatFirstMergeRoomAdmin } from './service'

export type EatFirstActionCardState = {
  templateId: string
  title: string
  description: string
  effectId: string
  used: boolean
}

export type EatFirstLastUsedCard = {
  slotId: string
  title: string
  description: string
  usedAt: number
}

/** Persisted subset of call signaling overlay (`EatFirstGame.room.callSignalingSnapshot`). */
export type EatFirstCallSignalingSnapshotPersist = {
  revealedTraitsBySlot: Record<string, EatFirstTraitKey[]>
  openedByBySlot: Record<string, Partial<Record<EatFirstTraitKey, 'player' | 'host'>>>
  lastUsedActionCard: EatFirstLastUsedCard | null
}

export type EatFirstTimerState = {
  startedAt: number
  duration: number
} | null

export type EatFirstTableState = {
  /** Stable slot order (slotIds, e.g. `['p1','p3','p2']`) — host editable. */
  playerOrder: string[]
  /** Hydrated full trait values per slot. Always 8 keys per active slot. */
  traitsBySlot: Map<string, Map<EatFirstTraitKey, string>>
  /** Action card per slot. Card.used flips true when "use" event fires. */
  actionCardBySlot: Map<string, EatFirstActionCardState>
  /** Reveal state per slot/key (visible to all viewers). */
  revealedBySlot: Map<string, Set<EatFirstTraitKey>>
  /** Tracks who opened each revealed trait (for highlight semantics). */
  openedByBySlot: Map<string, Map<EatFirstTraitKey, 'player' | 'host'>>
  /** Most recently "used" action card (host panel chip). */
  lastUsedActionCard: EatFirstLastUsedCard | null
  /** Active timer; cleared when timer stops. */
  timer: EatFirstTimerState
  /**
   * Live host-selected timer preset (ms). Independent of `timer` —
   * survives Start/Stop so the host's last picked idle duration persists
   * across cycles. Broadcast via `eat:timer-preset-select` and replayed
   * to each joining socket. `null` means "client uses its local default".
   */
  selectedTimerDurationMs: number | null
  /** True once the lazy DB hydration has completed at least once. */
  hydrated: boolean
}

const stateByRoomId = new Map<string, EatFirstTableState>()

function makeEmpty(): EatFirstTableState {
  return {
    playerOrder: [],
    traitsBySlot: new Map(),
    actionCardBySlot: new Map(),
    revealedBySlot: new Map(),
    openedByBySlot: new Map(),
    lastUsedActionCard: null,
    timer: null,
    selectedTimerDurationMs: null,
    hydrated: false,
  }
}

export function getEatFirstTableState(roomId: string): EatFirstTableState {
  let s = stateByRoomId.get(roomId)
  if (!s) {
    s = makeEmpty()
    stateByRoomId.set(roomId, s)
  }
  return s
}

const EAT_FIRST_TRAIT_KEY_SET = new Set<string>(EAT_FIRST_TRAIT_KEYS)

export function buildEatFirstCallSignalingSnapshotPersist(
  state: EatFirstTableState,
): EatFirstCallSignalingSnapshotPersist {
  const revealedTraitsBySlot: Record<string, EatFirstTraitKey[]> = {}
  for (const [slot, set] of state.revealedBySlot) {
    revealedTraitsBySlot[slot] = [...set]
  }
  const openedByBySlot: Record<string, Partial<Record<EatFirstTraitKey, 'player' | 'host'>>> = {}
  for (const [slot, byTrait] of state.openedByBySlot) {
    const out: Partial<Record<EatFirstTraitKey, 'player' | 'host'>> = {}
    for (const [key, opener] of byTrait.entries()) {
      out[key] = opener
    }
    if (Object.keys(out).length > 0) openedByBySlot[slot] = out
  }
  return {
    revealedTraitsBySlot,
    openedByBySlot,
    lastUsedActionCard: state.lastUsedActionCard,
  }
}

/**
 * Writes overlay state to Prisma so joins and server restarts match live reveals /
 * last-used card. Caller should await before broadcasting table sync to avoid join
 * races against stale DB.
 */
export async function persistEatFirstCallSignalingSnapshot(
  roomId: string,
  ownerUserId?: string | null,
): Promise<void> {
  const gameId = eatFirstGameIdFromRoomId(roomId)
  if (!gameId) return
  const state = getEatFirstTableState(roomId)
  const snapshot = buildEatFirstCallSignalingSnapshotPersist(state)
  await eatFirstMergeRoomAdmin(gameId, { callSignalingSnapshot: snapshot }, ownerUserId ?? null)
}

function applyEatFirstCallSignalingSnapshotFromRoom(
  state: EatFirstTableState,
  room: Record<string, unknown>,
  allowedSlots: Set<string>,
): void {
  const raw = room.callSignalingSnapshot
  if (raw === undefined || raw === null) return
  if (typeof raw !== 'object' || Array.isArray(raw)) return
  const snap = raw as Record<string, unknown>

  state.revealedBySlot.clear()
  state.openedByBySlot.clear()
  state.lastUsedActionCard = null

  const revealedRaw = snap.revealedTraitsBySlot
  if (revealedRaw && typeof revealedRaw === 'object' && !Array.isArray(revealedRaw)) {
    for (const [slotId, arr] of Object.entries(revealedRaw as Record<string, unknown>)) {
      const slot = normalizeEatFirstSlot(slotId)
      if (!allowedSlots.has(slot) || !isEatFirstPlayerSlotId(slot)) continue
      if (!Array.isArray(arr)) continue
      const keys = new Set<EatFirstTraitKey>()
      for (const item of arr) {
        if (typeof item !== 'string' || !EAT_FIRST_TRAIT_KEY_SET.has(item)) continue
        keys.add(item as EatFirstTraitKey)
      }
      if (keys.size > 0) state.revealedBySlot.set(slot, keys)
    }
  }

  const openedRaw = snap.openedByBySlot
  if (openedRaw && typeof openedRaw === 'object' && !Array.isArray(openedRaw)) {
    for (const [slotId, row] of Object.entries(openedRaw as Record<string, unknown>)) {
      const slot = normalizeEatFirstSlot(slotId)
      if (!allowedSlots.has(slot) || !isEatFirstPlayerSlotId(slot)) continue
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const byTrait = new Map<EatFirstTraitKey, 'player' | 'host'>()
      for (const [traitKey, opener] of Object.entries(row as Record<string, unknown>)) {
        if (!EAT_FIRST_TRAIT_KEY_SET.has(traitKey)) continue
        if (opener !== 'player' && opener !== 'host') continue
        byTrait.set(traitKey as EatFirstTraitKey, opener)
      }
      if (byTrait.size > 0) state.openedByBySlot.set(slot, byTrait)
    }
  }

  const luc = snap.lastUsedActionCard
  if (luc && typeof luc === 'object' && !Array.isArray(luc)) {
    const r = luc as Record<string, unknown>
    const sid = typeof r.slotId === 'string' ? normalizeEatFirstSlot(r.slotId.trim()) : ''
    if (allowedSlots.has(sid) && isEatFirstPlayerSlotId(sid)) {
      const title = typeof r.title === 'string' ? r.title : ''
      const description = typeof r.description === 'string' ? r.description : ''
      const usedAt = Number(r.usedAt)
      if (Number.isFinite(usedAt)) {
        state.lastUsedActionCard = { slotId: sid, title, description, usedAt }
      }
    }
  }
}

export function disposeEatFirstTableState(roomId: string): void {
  stateByRoomId.delete(roomId)
}

/**
 * Clears consumable overlay state after a host "table round deal" / full reshuffle:
 * trait reveal maps, last-used action card hint, and `activeCard.used` on every slot
 * so the follow-up Prisma patch writes fresh ledgers and unused cards.
 */
export function resetEatFirstTableRoundDealConsumables(roomId: string): void {
  const state = getEatFirstTableState(roomId)
  state.lastUsedActionCard = null
  state.revealedBySlot.clear()
  state.openedByBySlot.clear()
  for (const [slotId, card] of [...state.actionCardBySlot]) {
    if (!card) {
      state.actionCardBySlot.delete(slotId)
      continue
    }
    state.actionCardBySlot.set(slotId, { ...card, used: false })
  }
}

/** Strip the `eat:` signaling prefix; the remainder is the persistent gameId. */
export function eatFirstGameIdFromRoomId(roomId: string): string {
  return roomId.startsWith('eat:') ? roomId.slice('eat:'.length) : ''
}

function readTraitFromPlayerRow(
  data: Record<string, unknown>,
  key: EatFirstTraitKey,
): string {
  // Map our 8-key model onto the legacy DB shape used by snapshot/control page.
  // DB stores `{value, ...}` shaped chunks for each character key (e.g.
  // `data.profession = { value: 'Лікар', ... }`). 'hobby' historically maps to
  // `quirk`, 'baggage' → `luggage`. 'gender'/'age' are scalar strings.
  if (key === 'gender') {
    const v = data.gender
    return typeof v === 'string' ? v.trim() : ''
  }
  if (key === 'age') {
    const v = data.age
    return typeof v === 'string' ? v.trim() : ''
  }
  const dbKeyByTrait: Record<Exclude<EatFirstTraitKey, 'gender' | 'age'>, string> = {
    profession: 'profession',
    health: 'health',
    hobby: 'quirk',
    phobia: 'phobia',
    fact: 'fact',
    baggage: 'luggage',
  }
  const dbKey = dbKeyByTrait[key as Exclude<EatFirstTraitKey, 'gender' | 'age'>]
  const chunk = data[dbKey]
  if (typeof chunk === 'string') return chunk.trim()
  if (chunk && typeof chunk === 'object' && !Array.isArray(chunk)) {
    const v = (chunk as { value?: unknown }).value
    return typeof v === 'string' ? v.trim() : ''
  }
  return ''
}

function readActionCardFromPlayerRow(
  data: Record<string, unknown>,
): EatFirstActionCardState | null {
  const ac = data.activeCard
  if (!ac || typeof ac !== 'object' || Array.isArray(ac)) return null
  const r = ac as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  const templateId = typeof r.templateId === 'string' ? r.templateId.trim() : ''
  if (title.length < 1 && templateId.length < 1) return null
  return {
    title,
    description: typeof r.description === 'string' ? r.description : '',
    templateId,
    effectId: typeof r.effectId === 'string' ? r.effectId : '',
    used: r.used === true,
  }
}

/**
 * Lazily hydrate state from DB. Safe to call repeatedly: only fills in slots
 * that have nothing in memory yet, never overwrites in-flight host edits.
 * Always ensures every active slot has a complete trait set (filling missing
 * keys from the random pool) and an action card (rolling one if absent).
 */
export async function hydrateEatFirstTableStateFromDb(roomId: string): Promise<void> {
  const gameId = eatFirstGameIdFromRoomId(roomId)
  if (!gameId) return
  const game = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    include: { players: true },
  })
  if (!game) return
  const state = getEatFirstTableState(roomId)
  const shouldApplyCallOverlay = !state.hydrated
  const room =
    typeof game.room === 'object' && game.room !== null && !Array.isArray(game.room)
      ? (game.room as Record<string, unknown>)
      : {}
  const allowed = new Set<string>()
  const dbTraitsBySlot = new Map<string, Record<EatFirstTraitKey, string>>()
  const dbCardBySlot = new Map<string, EatFirstActionCardState | null>()
  for (const p of game.players) {
    const slot = normalizeEatFirstSlot(p.slotId)
    if (!isEatFirstPlayerSlotId(slot)) continue
    allowed.add(slot)
    const data =
      typeof p.data === 'object' && p.data !== null && !Array.isArray(p.data)
        ? (p.data as Record<string, unknown>)
        : {}
    const traits = {} as Record<EatFirstTraitKey, string>
    for (const key of EAT_FIRST_TRAIT_KEYS) {
      traits[key] = readTraitFromPlayerRow(data, key)
    }
    dbTraitsBySlot.set(slot, traits)
    dbCardBySlot.set(slot, readActionCardFromPlayerRow(data))
  }
  // Seed playerOrder from DB if memory has nothing yet OR memory order has
  // stale slot ids that no longer exist. Otherwise preserve in-memory order
  // (the host may have reordered without persisting).
  const dbOrder = resolveEatFirstEffectivePlayerOrder(room.playerOrder, allowed)
  if (state.playerOrder.length === 0 || !state.playerOrder.every((s) => allowed.has(s))) {
    state.playerOrder = [...dbOrder]
  } else {
    // Append any newly-claimed slots not yet in memory order, drop stale ones.
    const present = new Set(state.playerOrder.filter((s) => allowed.has(s)))
    const next: string[] = []
    for (const s of state.playerOrder) if (allowed.has(s) && !next.includes(s)) next.push(s)
    for (const s of dbOrder) if (!present.has(s) && !next.includes(s)) next.push(s)
    state.playerOrder = next
  }
  for (const slot of allowed) {
    const dbTraits = dbTraitsBySlot.get(slot) ?? ({} as Record<EatFirstTraitKey, string>)
    const memTraits = state.traitsBySlot.get(slot) ?? new Map<EatFirstTraitKey, string>()
    for (const key of EAT_FIRST_TRAIT_KEYS) {
      if (memTraits.has(key)) continue
      const dbVal = dbTraits[key]
      if (typeof dbVal === 'string' && dbVal.length > 0) {
        memTraits.set(key, dbVal)
      } else {
        memTraits.set(key, pickEatFirstTraitValue(key))
      }
    }
    state.traitsBySlot.set(slot, memTraits)
    if (!state.actionCardBySlot.has(slot)) {
      const fromDb = dbCardBySlot.get(slot) ?? null
      if (fromDb) {
        state.actionCardBySlot.set(slot, fromDb)
      } else {
        const card = pickRandomEatFirstActiveCard()
        state.actionCardBySlot.set(slot, { ...card, used: false })
      }
    }
  }
  // Drop in-memory entries for slots that no longer exist (slot deleted).
  for (const slot of [...state.traitsBySlot.keys()]) {
    if (!allowed.has(slot)) state.traitsBySlot.delete(slot)
  }
  for (const slot of [...state.actionCardBySlot.keys()]) {
    if (!allowed.has(slot)) state.actionCardBySlot.delete(slot)
  }
  for (const slot of [...state.revealedBySlot.keys()]) {
    if (!allowed.has(slot)) state.revealedBySlot.delete(slot)
  }
  for (const slot of [...state.openedByBySlot.keys()]) {
    if (!allowed.has(slot)) state.openedByBySlot.delete(slot)
  }
  syncEatFirstTimerFromPersistedRoom(state, room)
  if (shouldApplyCallOverlay) {
    applyEatFirstCallSignalingSnapshotFromRoom(state, room, allowed)
  }
  state.hydrated = true
}

/**
 * Seeds in-memory timer from persisted room JSON when the server restarted or the
 * room had no prior in-memory timer. Skips when live signaling already set
 * `state.timer` so signaling stays authoritative over stale hydration races.
 */
function syncEatFirstTimerFromPersistedRoom(
  state: EatFirstTableState,
  room: Record<string, unknown>,
): void {
  if (state.timer != null) return
  if (room.timerPaused === true) return
  const speakingSec = Math.floor(Number(room.speakingTimer) || 0)
  const startedRaw = room.timerStartedAt
  const startedStr = typeof startedRaw === 'string' ? startedRaw.trim() : ''
  if (speakingSec < 1 || startedStr.length < 1) return
  const startedMs = Date.parse(startedStr)
  if (!Number.isFinite(startedMs)) return
  const durationMs = speakingSec * 1000
  const elapsedMs = Date.now() - startedMs
  if (elapsedMs >= durationMs) return
  state.timer = { startedAt: startedMs, duration: durationMs }
}

export function setEatFirstPlayerOrder(roomId: string, order: string[]): boolean {
  const state = getEatFirstTableState(roomId)
  // Validate: must be a permutation of currently-known slots
  const knownSlots = new Set<string>([
    ...state.traitsBySlot.keys(),
    ...state.playerOrder,
  ])
  if (order.length !== knownSlots.size) return false
  const seen = new Set<string>()
  for (const s of order) {
    if (!knownSlots.has(s) || seen.has(s)) return false
    seen.add(s)
  }
  state.playerOrder = [...order]
  return true
}

export function applyEatFirstTraitReveal(
  roomId: string,
  slotId: string,
  traitKey: EatFirstTraitKey,
  openedBy: 'player' | 'host',
  closed: boolean,
): boolean {
  const state = getEatFirstTableState(roomId)
  const revealed = state.revealedBySlot.get(slotId) ?? new Set<EatFirstTraitKey>()
  const opened = state.openedByBySlot.get(slotId) ?? new Map<EatFirstTraitKey, 'player' | 'host'>()
  if (closed) {
    if (!revealed.has(traitKey) && !opened.has(traitKey)) return false
    revealed.delete(traitKey)
    opened.delete(traitKey)
  } else {
    if (revealed.has(traitKey)) return false
    revealed.add(traitKey)
    opened.set(traitKey, openedBy)
  }
  if (revealed.size === 0) state.revealedBySlot.delete(slotId)
  else state.revealedBySlot.set(slotId, revealed)
  if (opened.size === 0) state.openedByBySlot.delete(slotId)
  else state.openedByBySlot.set(slotId, opened)
  return true
}

export function applyEatFirstTraitReroll(
  roomId: string,
  slotId: string,
  traitKey: EatFirstTraitKey,
): string | null {
  const state = getEatFirstTableState(roomId)
  const row = state.traitsBySlot.get(slotId)
  if (!row) return null
  for (const key of EAT_FIRST_TRAIT_KEYS) {
    const value = row.get(key)
    if (typeof value !== 'string' || value.trim().length < 1) {
      row.set(key, pickEatFirstTraitValue(key))
    }
  }
  const next = pickEatFirstTraitValue(traitKey, row.get(traitKey))
  row.set(traitKey, next)
  return next
}

export function applyEatFirstTraitTypeReroll(
  roomId: string,
  traitKey: EatFirstTraitKey,
): Record<string, string> {
  const state = getEatFirstTableState(roomId)
  const out: Record<string, string> = {}
  for (const [slot, row] of state.traitsBySlot) {
    for (const key of EAT_FIRST_TRAIT_KEYS) {
      const value = row.get(key)
      if (typeof value !== 'string' || value.trim().length < 1) {
        row.set(key, pickEatFirstTraitValue(key))
      }
    }
    const next = pickEatFirstTraitValue(traitKey, row.get(traitKey))
    row.set(traitKey, next)
    out[slot] = next
  }
  return out
}

export function setEatFirstActionCard(
  roomId: string,
  slotId: string,
  card: EatFirstActiveCardSnapshot,
): void {
  const state = getEatFirstTableState(roomId)
  state.actionCardBySlot.set(slotId, { ...card, used: false })
}

export function setEatFirstActionCardUsed(
  roomId: string,
  slotId: string,
): EatFirstActionCardState | null {
  const state = getEatFirstTableState(roomId)
  const card = state.actionCardBySlot.get(slotId)
  if (!card) return null
  if (card.used) return card
  const next = { ...card, used: true }
  state.actionCardBySlot.set(slotId, next)
  state.lastUsedActionCard = {
    slotId,
    title: next.title,
    description: next.description,
    usedAt: Date.now(),
  }
  return next
}

export function setEatFirstTimer(
  roomId: string,
  timer: { startedAt: number; duration: number } | null,
): void {
  const state = getEatFirstTableState(roomId)
  state.timer = timer
}

/**
 * Live host-selected timer preset (ms). Stored on the in-memory
 * `EatFirstTableState`, not persisted to the DB. Survives Start/Stop
 * cycles so the host's last picked idle duration persists across the
 * session. `null` clears the field (clients fall back to their local
 * default).
 */
export function setEatFirstSelectedTimerDurationMs(
  roomId: string,
  durationMs: number | null,
): void {
  const state = getEatFirstTableState(roomId)
  state.selectedTimerDurationMs =
    typeof durationMs === 'number' && Number.isFinite(durationMs)
      ? Math.floor(durationMs)
      : null
}

export function getEatFirstSelectedTimerDurationMs(roomId: string): number | null {
  return getEatFirstTableState(roomId).selectedTimerDurationMs
}

export type EatFirstTableSyncPayload = {
  playerOrder: string[]
  slotByPeer: Record<string, string | null>
  peerBySlot: Record<string, string | null>
  traitsBySlot: Record<string, Record<EatFirstTraitKey, string>>
  actionCardBySlot: Record<string, EatFirstActionCardState>
  revealedTraitsBySlot: Record<string, EatFirstTraitKey[]>
  openedByBySlot: Record<string, Partial<Record<EatFirstTraitKey, 'player' | 'host'>>>
  lastUsedActionCard: EatFirstLastUsedCard | null
  timer: { startedAt: number; duration: number; isRunning: boolean } | null
  hostPeerId: string | null
}

export function buildEatFirstTableSyncPayload(
  room: Room,
  hostPeerId: string | null,
): EatFirstTableSyncPayload {
  const state = getEatFirstTableState(room.id)
  const slotByPeer: Record<string, string | null> = {}
  const peerBySlot: Record<string, string | null> = {}
  const knownSlots = new Set<string>()
  for (const slot of state.playerOrder) if (isEatFirstPlayerSlotId(slot)) knownSlots.add(slot)
  for (const slot of state.traitsBySlot.keys()) if (isEatFirstPlayerSlotId(slot)) knownSlots.add(slot)
  for (const slot of state.actionCardBySlot.keys()) if (isEatFirstPlayerSlotId(slot)) knownSlots.add(slot)
  for (const slot of state.revealedBySlot.keys()) if (isEatFirstPlayerSlotId(slot)) knownSlots.add(slot)
  for (const slot of state.openedByBySlot.keys()) if (isEatFirstPlayerSlotId(slot)) knownSlots.add(slot)
  for (const peer of room.getPeers()) {
    slotByPeer[peer.id] = null
    const slot = peer.eatFirstSlotId
    if (typeof slot === 'string' && isEatFirstPlayerSlotId(slot)) {
      knownSlots.add(slot)
      slotByPeer[peer.id] = slot
      peerBySlot[slot] = peer.id
    }
  }
  for (const slot of knownSlots) {
    if (!(slot in peerBySlot)) {
      peerBySlot[slot] = null
    }
  }
  const traitsBySlot: Record<string, Record<EatFirstTraitKey, string>> = {}
  for (const slot of knownSlots) {
    const row = state.traitsBySlot.get(slot) ?? new Map<EatFirstTraitKey, string>()
    const out = {} as Record<EatFirstTraitKey, string>
    for (const key of EAT_FIRST_TRAIT_KEYS) {
      const current = row.get(key)
      if (typeof current === 'string' && current.trim().length > 0) {
        out[key] = current.trim()
      } else {
        out[key] = pickEatFirstTraitValue(key)
      }
      row.set(key, out[key])
    }
    state.traitsBySlot.set(slot, row)
    traitsBySlot[slot] = out
  }
  const actionCardBySlot: Record<string, EatFirstActionCardState> = {}
  for (const slot of knownSlots) {
    const existing = state.actionCardBySlot.get(slot)
    if (existing) {
      actionCardBySlot[slot] = { ...existing }
      continue
    }
    const card = pickRandomEatFirstActiveCard()
    const next = { ...card, used: false }
    state.actionCardBySlot.set(slot, next)
    actionCardBySlot[slot] = next
  }
  const revealedTraitsBySlot: Record<string, EatFirstTraitKey[]> = {}
  for (const [slot, set] of state.revealedBySlot) {
    revealedTraitsBySlot[slot] = [...set]
  }
  const openedByBySlot: Record<string, Partial<Record<EatFirstTraitKey, 'player' | 'host'>>> = {}
  for (const [slot, byTrait] of state.openedByBySlot) {
    const out: Partial<Record<EatFirstTraitKey, 'player' | 'host'>> = {}
    for (const [key, opener] of byTrait.entries()) {
      out[key] = opener
    }
    if (Object.keys(out).length > 0) openedByBySlot[slot] = out
  }
  const timer = state.timer
    ? { startedAt: state.timer.startedAt, duration: state.timer.duration, isRunning: true }
    : null
  return {
    playerOrder: [...state.playerOrder],
    slotByPeer,
    peerBySlot,
    traitsBySlot,
    actionCardBySlot,
    revealedTraitsBySlot,
    openedByBySlot,
    lastUsedActionCard: state.lastUsedActionCard,
    timer,
    hostPeerId,
  }
}

export async function getHydratedEatFirstTableState(roomId: string): Promise<EatFirstTableState> {
  const state = getEatFirstTableState(roomId)
  if (!state.hydrated) {
    await hydrateEatFirstTableStateFromDb(roomId)
  }
  return getEatFirstTableState(roomId)
}

/** Collect all currently-known slots in this room (live peers + state). */
export function eatFirstActiveSlotsForRoom(room: Room, roomId: string): string[] {
  const state = getEatFirstTableState(roomId)
  const out = new Set<string>()
  for (const peer of room.getPeers()) {
    const slot = peer.eatFirstSlotId
    if (typeof slot === 'string' && isEatFirstPlayerSlotId(slot)) out.add(slot)
  }
  for (const slot of state.playerOrder) if (isEatFirstPlayerSlotId(slot)) out.add(slot)
  for (const slot of state.traitsBySlot.keys()) if (isEatFirstPlayerSlotId(slot)) out.add(slot)
  return [...out]
}

/**
 * Assigns each live SFU peer without `eatFirstSlotId` to the next free seat from
 * in-memory `playerOrder` (seated players only). Clears the moderator host seat so
 * call tiles stay trait-free for the host. Enables overlays without per-peer slot-claim when tokens exist.
 */
export function assignEatFirstSlotsToUnclaimedPeers(room: Room, ownerUserId: string | null): boolean {
  if (!eatFirstGameIdFromRoomId(room.id)) return false
  const state = getEatFirstTableState(room.id)
  const peersInRoom = room.getPeers()
  const hostPeerIdEarly = resolveEatFirstHostPeerId(room, ownerUserId)
  const seatedPeerTarget =
    hostPeerIdEarly != null ? peersInRoom.filter((p) => p.id !== hostPeerIdEarly).length : peersInRoom.length
  let slotSequence = state.playerOrder
    .map((s) => normalizeEatFirstSlot(s))
    .filter((s) => isEatFirstPlayerSlotId(s))
  if (slotSequence.length < seatedPeerTarget) {
    const allowed = new Set<string>()
    for (const s of slotSequence) allowed.add(s)
    for (const slot of state.traitsBySlot.keys()) {
      const sid = normalizeEatFirstSlot(slot)
      if (isEatFirstPlayerSlotId(sid)) allowed.add(sid)
    }
    if (allowed.size > slotSequence.length) {
      slotSequence = deriveEatFirstDefaultPlayerOrder(allowed)
    }
  }
  if (slotSequence.length < 1) return false

  const hostPeerId = hostPeerIdEarly
  const orderedPeers =
    hostPeerId != null ? peersInRoom.filter((p) => p.id !== hostPeerId) : peersInRoom.slice()

  let changed = false
  for (const p of peersInRoom) {
    if (hostPeerId != null && p.id === hostPeerId) {
      if (p.eatFirstSlotId != null) {
        p.eatFirstSlotId = null
        changed = true
      }
    }
  }

  const taken = new Set<string>()
  for (const p of peersInRoom) {
    const s = p.eatFirstSlotId
    if (typeof s === 'string' && isEatFirstPlayerSlotId(normalizeEatFirstSlot(s))) {
      taken.add(normalizeEatFirstSlot(s))
    }
  }
  for (const peer of orderedPeers) {
    const existing = peer.eatFirstSlotId
    if (typeof existing === 'string' && isEatFirstPlayerSlotId(normalizeEatFirstSlot(existing))) {
      continue
    }
    for (const slot of slotSequence) {
      const pid = normalizeEatFirstSlot(slot)
      if (taken.has(pid)) continue
      let occupiedByOther = false
      for (const other of peersInRoom) {
        if (other.id === peer.id) continue
        const os = other.eatFirstSlotId
        if (typeof os === 'string' && normalizeEatFirstSlot(os) === pid) {
          occupiedByOther = true
          break
        }
      }
      if (occupiedByOther) continue
      peer.eatFirstSlotId = pid
      taken.add(pid)
      changed = true
      break
    }
  }
  return changed
}

/**
 * Eat First "host" resolver.
 *
 * When `ownerUserId` is set (the normal production path — stamped on first
 * `eatFirstEnsureGame` from the authenticated operator's Prisma `User.id`),
 * the host is the peer whose server-stamped `prismaUserId` matches. If no
 * such peer is in the room, the resolver returns `null` and `isEatFirstHostPeer`
 * rejects every host-only action — there is no "first peer wins" fallback
 * (audit R3). Anonymous viewers and non-owner joiners therefore cannot gain
 * host authority just by being first.
 *
 * The previous code compared `peer.userId` (session JWT `id`, e.g. Twitch
 * profile id) against `ownerUserId` (Prisma `User.id`) — different identity
 * namespaces, so the match always failed for OAuth users in production and
 * the `peers[0]` fallback was the de-facto host every time. `peer.prismaUserId`
 * (populated at `handleJoinRoom` via `resolvePrismaUserIdFromSession`) lives
 * in the same namespace as `ownerUserId` and makes the comparison meaningful.
 *
 * Legacy fallback: when `ownerUserId == null` (DB row was created before the
 * per-game ownership stamp existed, or is being used in a non-production dev
 * flow that never ensures ownership), the resolver returns the longest-lived
 * peer so local development is not broken. Production `eatFirstEnsureGame`
 * stamps `ownerUserId` on first call, so legacy rooms migrate transparently
 * the next time an authorized operator touches them.
 */
export function resolveEatFirstHostPeerId(
  room: Room,
  ownerUserId: string | null,
): string | null {
  const peers = room.getPeers()
  if (peers.length === 0) return null
  if (ownerUserId != null && ownerUserId.length > 0) {
    const owner = peers.find((p: Peer) => p.prismaUserId === ownerUserId)
    return owner ? owner.id : null
  }
  // Legacy-only path: no per-game ownership has been stamped yet. Keep the
  // longest-lived-peer fallback so dev/local flows without a real DB owner
  // continue to work; production rooms get `ownerUserId` stamped on first
  // ensure and never reach this branch.
  return peers[0]!.id
}

const ownerUserIdByRoomId = new Map<string, string>()

export function setEatFirstOwnerUserId(roomId: string, userId: string | null): void {
  if (userId == null || userId.length === 0) {
    ownerUserIdByRoomId.delete(roomId)
    return
  }
  ownerUserIdByRoomId.set(roomId, userId)
}

export function getEatFirstOwnerUserId(roomId: string): string | null {
  return ownerUserIdByRoomId.get(roomId) ?? null
}

export function disposeEatFirstOwnerUserId(roomId: string): void {
  ownerUserIdByRoomId.delete(roomId)
}

/**
 * Lazy hydration entry point used by the join handler. Reads `room.ownerUserId`
 * out of the DB row so the host check stops depending on "first peer to join".
 */
export async function hydrateEatFirstOwnerUserIdFromDb(roomId: string): Promise<void> {
  const gameId = eatFirstGameIdFromRoomId(roomId)
  if (!gameId) return
  const row = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    select: { room: true },
  })
  if (!row) return
  const r =
    typeof row.room === 'object' && row.room !== null && !Array.isArray(row.room)
      ? (row.room as Record<string, unknown>)
      : {}
  const owner = typeof r.ownerUserId === 'string' ? r.ownerUserId.trim() : ''
  setEatFirstOwnerUserId(roomId, owner.length > 0 ? owner : null)
}
