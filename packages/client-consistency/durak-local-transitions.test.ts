import { describe, expect, it } from 'vitest'
import {
  applyChatAutoMove,
  cloneDurakLocalSnapshot,
  createInitialDurakLocalSnapshot,
  DURAK_LOCAL_CHAT_INDEX,
  DURAK_LOCAL_STREAMER_INDEX,
  endAttackPhase,
  pickLegalAttackCard,
  pickLegalDefendCard,
  resolveTrumpDisplayCard,
  tryBeatRound,
  tryPlayAttack,
  tryPlayDefend,
  tryTakeRound,
} from '../../apps/client/src/features/durak/core/durakLocalTransitions'

function fixedRng(seq: number[]): () => number {
  let i = 0
  return () => {
    const v = seq[i] ?? 0.111
    i += 1
    return v
  }
}

describe('createInitialDurakLocalSnapshot', () => {
  it('deals six cards each and leaves stock with trump on bottom', () => {
    const s = createInitialDurakLocalSnapshot(fixedRng([0.4, 0.5, 0.1, 0.2, 0.3, 0.6, 0.7, 0.8, 0.9]))
    expect(s.hands[DURAK_LOCAL_STREAMER_INDEX]).toHaveLength(6)
    expect(s.hands[DURAK_LOCAL_CHAT_INDEX]).toHaveLength(6)
    expect(s.stock).toHaveLength(24)
    expect(s.phase).toBe('attack')
    expect(s.turnIndex).toBe(DURAK_LOCAL_STREAMER_INDEX)
    expect(s.table).toHaveLength(0)
    const bottom = s.stock[s.stock.length - 1]!
    expect(s.trumpSuit).toBe(bottom.suit)
  })
})

describe('attack → defend → beat flow', () => {
  it('plays legal attack, ends attack, chat defends all rows, then beat clears', () => {
    const rng = fixedRng([0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 0.99, 0.12, 0.23, 0.34])
    let s = createInitialDurakLocalSnapshot(rng)
    const firstAttackId = pickLegalAttackCard(s, DURAK_LOCAL_STREAMER_INDEX)
    expect(firstAttackId).not.toBeNull()
    let r = tryPlayAttack(s, DURAK_LOCAL_STREAMER_INDEX, firstAttackId!)
    expect(r.ok).toBe(true)
    s = r.snapshot
    r = endAttackPhase(s)
    expect(r.ok).toBe(true)
    s = r.snapshot
    expect(s.phase).toBe('defend')
    expect(s.turnIndex).toBe(DURAK_LOCAL_CHAT_INDEX)
    while (s.table.some((row) => row.defender == null)) {
      const cid = pickLegalDefendCard(s, DURAK_LOCAL_CHAT_INDEX)
      expect(cid).not.toBeNull()
      r = tryPlayDefend(s, DURAK_LOCAL_CHAT_INDEX, cid!)
      expect(r.ok).toBe(true)
      s = r.snapshot
    }
    r = tryBeatRound(s)
    expect(r.ok).toBe(true)
    s = r.snapshot
    expect(s.table).toHaveLength(0)
    expect(s.phase).toBe('attack')
    expect(s.attackerIndex).toBe(DURAK_LOCAL_CHAT_INDEX)
  })
})

describe('tryPlayAttack validation', () => {
  it('rejects wrong phase', () => {
    let s = createInitialDurakLocalSnapshot()
    const id = s.hands[DURAK_LOCAL_STREAMER_INDEX]![0]!.id
    let r = tryPlayAttack(s, DURAK_LOCAL_STREAMER_INDEX, id)
    s = r.snapshot
    r = endAttackPhase(s)
    s = r.snapshot
    r = tryPlayAttack(s, DURAK_LOCAL_STREAMER_INDEX, id)
    expect(r.ok).toBe(false)
  })
})

describe('resolveTrumpDisplayCard', () => {
  it('uses stock bottom when non-empty', () => {
    const s = createInitialDurakLocalSnapshot()
    const c = resolveTrumpDisplayCard(s.stock, s.trumpCard)
    expect(c.suit).toBe(s.stock[s.stock.length - 1]!.suit)
  })
})

describe('cloneDurakLocalSnapshot', () => {
  it('deep clones hands and table', () => {
    const a = createInitialDurakLocalSnapshot()
    const b = cloneDurakLocalSnapshot(a)
    b.hands[0]!.push({ id: 'x', suit: 'clubs', rank: '6' })
    expect(a.hands[0]).toHaveLength(6)
  })
})

describe('applyChatAutoMove', () => {
  it('errors when not chat turn', () => {
    const s = createInitialDurakLocalSnapshot()
    const r = applyChatAutoMove(s)
    expect(r.ok).toBe(false)
  })
})

describe('tryTakeRound', () => {
  it('moves table cards to defender hand', () => {
    const rng = fixedRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35])
    let s = createInitialDurakLocalSnapshot(rng)
    const id = pickLegalAttackCard(s, DURAK_LOCAL_STREAMER_INDEX)!
    let r = tryPlayAttack(s, DURAK_LOCAL_STREAMER_INDEX, id)
    s = r.snapshot
    r = endAttackPhase(s)
    s = r.snapshot
    const before = s.hands[DURAK_LOCAL_CHAT_INDEX]!.length
    r = tryTakeRound(s)
    expect(r.ok).toBe(true)
    s = r.snapshot
    expect(s.hands[DURAK_LOCAL_CHAT_INDEX]!.length).toBeGreaterThan(before)
    expect(s.table).toHaveLength(0)
  })
})
