import type { DurakCard, DurakTablePair } from './cardTypes'
import {
  canAttack,
  canDefend,
  createDurakDeck,
  dealInitialHands,
  determineTrump,
  drawUpToHandSize,
  initialHandSizeForPlayerCount,
  shuffleDeck,
  type DurakRng,
} from './durakRules'
import type { DurakLocalResult, DurakLocalSnapshot } from './durakLocalGameTypes'

const PLAYER_COUNT = 2

export const DURAK_LOCAL_STREAMER_INDEX = 0 as const
export const DURAK_LOCAL_CHAT_INDEX = 1 as const

export function cloneDurakLocalSnapshot(s: DurakLocalSnapshot): DurakLocalSnapshot {
  return {
    ...s,
    hands: [s.hands[0]!.slice(), s.hands[1]!.slice()],
    stock: s.stock.slice(),
    trumpCard: { ...s.trumpCard },
    table: s.table.map((r) => ({
      ...r,
      attacker: { ...r.attacker },
      defender: r.defender ? { ...r.defender } : null,
    })),
  }
}

function ok(s: DurakLocalSnapshot): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  snap.lastErrorKey = null
  return { ok: true, snapshot: snap }
}

function fail(s: DurakLocalSnapshot, errorKey: string): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  snap.lastErrorKey = errorKey
  return { ok: false, snapshot: snap, errorKey }
}

export function createInitialDurakLocalSnapshot(rng?: DurakRng): DurakLocalSnapshot {
  const deck = shuffleDeck(createDurakDeck(), rng)
  const { hands, stock } = dealInitialHands(deck, PLAYER_COUNT)
  const { trumpSuit, trumpCard } = determineTrump(stock)
  return {
    hands: [hands[0]!.slice(), hands[1]!.slice()],
    stock: stock.slice(),
    trumpSuit,
    trumpCard: { ...trumpCard },
    table: [],
    attackerIndex: DURAK_LOCAL_STREAMER_INDEX,
    defenderIndex: DURAK_LOCAL_CHAT_INDEX,
    phase: 'attack',
    turnIndex: DURAK_LOCAL_STREAMER_INDEX,
    nextRowSeq: 0,
    lastErrorKey: null,
  }
}

function targetHandSize(): number {
  return initialHandSizeForPlayerCount(PLAYER_COUNT)
}

export function tryPlayAttack(s: DurakLocalSnapshot, playerIndex: 0 | 1, cardId: string): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  if (snap.phase !== 'attack') return fail(snap, 'durak.errors.notAttackPhase')
  if (snap.turnIndex !== snap.attackerIndex) return fail(snap, 'durak.errors.notAttackerTurn')
  if (playerIndex !== snap.attackerIndex) return fail(snap, 'durak.errors.notAttackerTurn')
  const hand = snap.hands[playerIndex]!
  const idx = hand.findIndex((c) => c.id === cardId)
  if (idx < 0) return fail(snap, 'durak.errors.cardNotInHand')
  const card = hand[idx]!
  if (!canAttack(card, snap.table)) return fail(snap, 'durak.errors.invalidAttack')
  hand.splice(idx, 1)
  const id = `row-${snap.nextRowSeq}`
  snap.nextRowSeq += 1
  snap.table.push({ id, attacker: { ...card }, defender: null })
  return ok(snap)
}

export function endAttackPhase(s: DurakLocalSnapshot): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  if (snap.phase !== 'attack') return fail(snap, 'durak.errors.notAttackPhase')
  if (snap.table.length === 0) return fail(snap, 'durak.errors.tableEmpty')
  if (snap.turnIndex !== snap.attackerIndex) return fail(snap, 'durak.errors.notAttackerTurn')
  snap.phase = 'defend'
  snap.turnIndex = snap.defenderIndex
  return ok(snap)
}

export function tryPlayDefend(s: DurakLocalSnapshot, playerIndex: 0 | 1, cardId: string): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  if (snap.phase !== 'defend') return fail(snap, 'durak.errors.notDefendPhase')
  if (snap.turnIndex !== snap.defenderIndex) return fail(snap, 'durak.errors.notDefenderTurn')
  if (playerIndex !== snap.defenderIndex) return fail(snap, 'durak.errors.notDefenderTurn')
  const rowIdx = snap.table.findIndex((r) => r.defender == null)
  if (rowIdx < 0) return fail(snap, 'durak.errors.nothingToDefend')
  const pair = snap.table[rowIdx]!
  const hand = snap.hands[playerIndex]!
  const idx = hand.findIndex((c) => c.id === cardId)
  if (idx < 0) return fail(snap, 'durak.errors.cardNotInHand')
  const card = hand[idx]!
  if (!canDefend(pair, card, snap.trumpSuit)) return fail(snap, 'durak.errors.invalidDefend')
  hand.splice(idx, 1)
  snap.table[rowIdx] = { ...pair, defender: { ...card } }
  return ok(snap)
}

function flattenTable(table: readonly DurakTablePair[]): DurakCard[] {
  const out: DurakCard[] = []
  for (const row of table) {
    out.push({ ...row.attacker })
    if (row.defender) out.push({ ...row.defender })
  }
  return out
}

/** Defender beat all attack cards; clear table, refill hands, defender opens next attack. */
export function tryBeatRound(s: DurakLocalSnapshot): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  if (snap.phase !== 'defend') return fail(snap, 'durak.errors.notDefendPhase')
  if (snap.table.length === 0) return fail(snap, 'durak.errors.tableEmpty')
  if (!snap.table.every((r) => r.defender != null)) return fail(snap, 'durak.errors.incompleteDefense')
  const prevDefender = snap.defenderIndex
  const prevAttacker = snap.attackerIndex
  snap.table = []
  snap.attackerIndex = prevDefender
  snap.defenderIndex = prevAttacker
  const target = targetHandSize()
  const draw = drawUpToHandSize({
    hands: snap.hands,
    stock: snap.stock,
    targetSizePerHand: target,
    firstDrawerIndex: prevDefender,
  })
  snap.hands = [draw.hands[0]!, draw.hands[1]!]
  snap.stock = draw.stock
  snap.phase = 'attack'
  snap.turnIndex = snap.attackerIndex
  if (snap.stock.length > 0) {
    const t = determineTrump(snap.stock)
    snap.trumpSuit = t.trumpSuit
    snap.trumpCard = { ...t.trumpCard }
  }
  return ok(snap)
}

/** Defender takes all table cards into their hand; clear table, refill, attacker leads again. */
export function tryTakeRound(s: DurakLocalSnapshot): DurakLocalResult {
  const snap = cloneDurakLocalSnapshot(s)
  if (snap.phase !== 'defend') return fail(snap, 'durak.errors.notDefendPhase')
  if (snap.table.length === 0) return fail(snap, 'durak.errors.tableEmpty')
  const defender = snap.defenderIndex
  const dHand = snap.hands[defender]!
  dHand.push(...flattenTable(snap.table))
  snap.table = []
  const target = targetHandSize()
  const draw = drawUpToHandSize({
    hands: snap.hands,
    stock: snap.stock,
    targetSizePerHand: target,
    firstDrawerIndex: snap.attackerIndex,
  })
  snap.hands = [draw.hands[0]!, draw.hands[1]!]
  snap.stock = draw.stock
  snap.phase = 'attack'
  snap.turnIndex = snap.attackerIndex
  if (snap.stock.length > 0) {
    const t = determineTrump(snap.stock)
    snap.trumpSuit = t.trumpSuit
    snap.trumpCard = { ...t.trumpCard }
  }
  return ok(snap)
}

export function pickLegalAttackCard(s: DurakLocalSnapshot, playerIndex: 0 | 1): string | null {
  for (const c of s.hands[playerIndex]!) {
    if (canAttack(c, s.table)) return c.id
  }
  return null
}

export function pickLegalDefendCard(s: DurakLocalSnapshot, playerIndex: 0 | 1): string | null {
  const row = s.table.find((r) => r.defender == null)
  if (!row) return null
  for (const c of s.hands[playerIndex]!) {
    if (canDefend(row, c, s.trumpSuit)) return c.id
  }
  return null
}

/** One deterministic auto-move for the chat seat (index 1). */
export function applyChatAutoMove(s: DurakLocalSnapshot): DurakLocalResult {
  if (s.turnIndex !== DURAK_LOCAL_CHAT_INDEX) {
    return fail(s, 'durak.errors.notChatTurn')
  }
  if (s.phase === 'attack') {
    const id = pickLegalAttackCard(s, DURAK_LOCAL_CHAT_INDEX)
    if (!id) return fail(s, 'durak.errors.chatNoLegalAttack')
    return tryPlayAttack(s, DURAK_LOCAL_CHAT_INDEX, id)
  }
  const id = pickLegalDefendCard(s, DURAK_LOCAL_CHAT_INDEX)
  if (!id) return fail(s, 'durak.errors.chatNoLegalDefend')
  return tryPlayDefend(s, DURAK_LOCAL_CHAT_INDEX, id)
}

export function resolveTrumpDisplayCard(stock: readonly DurakCard[], fallback: DurakCard): DurakCard {
  if (stock.length === 0) return { ...fallback }
  return { ...determineTrump(stock).trumpCard }
}
