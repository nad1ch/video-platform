import { describe, expect, it } from 'vitest'
import {
  canAttack,
  canBeat,
  canDefend,
  compareRanks,
  createDurakDeck,
  dealInitialHands,
  determineTrump,
  drawUpToHandSize,
  initialHandSizeForPlayerCount,
  isTrump,
  rankStrength,
  ranksOnTable,
  shuffleDeck,
  type DurakCard,
} from '../../apps/client/src/features/durak/core/durakRules'

function card(suit: DurakCard['suit'], rank: DurakCard['rank'], id = `${suit}-${rank}`): DurakCard {
  return { id, suit, rank }
}

describe('createDurakDeck', () => {
  it('builds 36 unique cards with ranks 6–A and four suits', () => {
    const d = createDurakDeck()
    expect(d).toHaveLength(36)
    const ids = new Set(d.map((c) => c.id))
    expect(ids.size).toBe(36)
    expect(new Set(d.map((c) => c.rank)).size).toBe(9)
    expect(new Set(d.map((c) => c.suit)).size).toBe(4)
  })
})

describe('shuffleDeck', () => {
  it('returns a permutation and does not mutate the input', () => {
    const deck = createDurakDeck()
    const copy = deck.slice()
    const rng = () => 0.3
    const s = shuffleDeck(deck, rng)
    expect(s).toHaveLength(36)
    expect(deck).toEqual(copy)
    const sorted = (a: DurakCard[]) => [...a].sort((x, y) => x.id.localeCompare(y.id))
    expect(sorted(s)).toEqual(sorted(deck))
  })

  it('is deterministic when rng is deterministic', () => {
    const seq = [0.99, 0.5, 0.1, 0.2, 0.8, 0.0, 0.4, 0.6, 0.3, 0.7]
    let i = 0
    const rng = () => {
      const v = seq[i] ?? 0.111
      i += 1
      return v
    }
    const a = shuffleDeck(createDurakDeck(), rng)
    i = 0
    const b = shuffleDeck(createDurakDeck(), rng)
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })
})

describe('dealInitialHands & determineTrump', () => {
  it('deals 6+6 and leaves stock with trump on bottom for two players', () => {
    const deck = createDurakDeck()
    const { hands, stock } = dealInitialHands(deck, 2)
    expect(hands).toHaveLength(2)
    expect(hands[0]).toHaveLength(6)
    expect(hands[1]).toHaveLength(6)
    expect(stock).toHaveLength(24)
    const { trumpCard, trumpSuit } = determineTrump(stock)
    expect(trumpCard).toEqual(stock[stock.length - 1])
    expect(trumpSuit).toBe(trumpCard.suit)
  })

  it('uses smaller hands for five players', () => {
    const deck = createDurakDeck()
    const { hands, stock } = dealInitialHands(deck, 5)
    expect(initialHandSizeForPlayerCount(5)).toBe(4)
    expect(hands.every((h) => h.length === 4)).toBe(true)
    expect(stock).toHaveLength(36 - 20)
  })

  it('throws on invalid player count', () => {
    expect(() => initialHandSizeForPlayerCount(1)).toThrow(RangeError)
    expect(() => dealInitialHands(createDurakDeck(), 7)).toThrow(RangeError)
  })

  it('throws when the deck is too small for the deal', () => {
    const small = createDurakDeck().slice(0, 17)
    expect(() => dealInitialHands(small, 6)).toThrow(RangeError)
  })

  it('throws determineTrump on empty stock', () => {
    expect(() => determineTrump([])).toThrow(RangeError)
  })
})

describe('compareRanks & isTrump & canBeat', () => {
  const trumpSuit = 'diamonds' as const

  it('orders ranks 6 < … < A', () => {
    expect(compareRanks('6', 'A')).toBeLessThan(0)
    expect(compareRanks('A', '6')).toBeGreaterThan(0)
    expect(compareRanks('10', 'J')).toBeLessThan(0)
    expect(rankStrength('A')).toBeGreaterThan(rankStrength('K'))
  })

  it('detects trump by suit', () => {
    expect(isTrump(card('diamonds', '6'), trumpSuit)).toBe(true)
    expect(isTrump(card('hearts', 'A'), trumpSuit)).toBe(false)
  })

  it('same non-trump suit: defender must be higher', () => {
    expect(canBeat(card('hearts', '8'), card('hearts', '10'), trumpSuit)).toBe(true)
    expect(canBeat(card('hearts', '10'), card('hearts', '8'), trumpSuit)).toBe(false)
    expect(canBeat(card('hearts', 'J'), card('hearts', 'J'), trumpSuit)).toBe(false)
  })

  it('any trump beats non-trump attacker', () => {
    expect(canBeat(card('hearts', 'A'), card('diamonds', '6'), trumpSuit)).toBe(true)
  })

  it('non-trump cannot beat trump attacker', () => {
    expect(canBeat(card('diamonds', '9'), card('hearts', 'A'), trumpSuit)).toBe(false)
  })

  it('both trump: compare rank only', () => {
    expect(canBeat(card('diamonds', '9'), card('diamonds', 'J'), trumpSuit)).toBe(true)
    expect(canBeat(card('diamonds', 'J'), card('diamonds', '9'), trumpSuit)).toBe(false)
  })

  it('different non-trump suits: cannot beat', () => {
    expect(canBeat(card('hearts', '7'), card('clubs', 'A'), trumpSuit)).toBe(false)
  })
})

describe('canAttack', () => {
  it('allows any card on empty table', () => {
    expect(canAttack(card('spades', '6'), [])).toBe(true)
  })

  it('requires matching rank when table has cards', () => {
    const table = [
      { id: 'r1', attacker: card('hearts', '8'), defender: card('hearts', '10') },
      { id: 'r2', attacker: card('clubs', '8'), defender: null },
    ]
    expect(canAttack(card('diamonds', '8'), table)).toBe(true)
    expect(canAttack(card('diamonds', '7'), table)).toBe(false)
  })
})

describe('canDefend', () => {
  it('false when slot already defended', () => {
    const row = { id: 'r', attacker: card('hearts', '8'), defender: card('hearts', '9') }
    expect(canDefend(row, card('hearts', '10'), 'spades')).toBe(false)
  })

  it('delegates to canBeat when slot open', () => {
    const row = { id: 'r', attacker: card('hearts', '8'), defender: null }
    expect(canDefend(row, card('hearts', '10'), 'spades')).toBe(true)
    expect(canDefend(row, card('hearts', '6'), 'spades')).toBe(false)
  })
})

describe('ranksOnTable', () => {
  it('collects attacker and defender ranks', () => {
    const table = [
      { id: 'a', attacker: card('hearts', 'J'), defender: null },
      { id: 'b', attacker: card('clubs', 'Q'), defender: card('clubs', 'K') },
    ]
    expect([...ranksOnTable(table)].sort()).toEqual(['J', 'K', 'Q'])
  })
})

describe('drawUpToHandSize', () => {
  it('fills hands in order until target or stock empty', () => {
    const c = (i: number): DurakCard => ({ id: `c${i}`, suit: 'clubs', rank: '6' })
    const stock = [c(0), c(1), c(2), c(3)]
    const hands: DurakCard[][] = [[], []]
    const { hands: h2, stock: s2 } = drawUpToHandSize({
      hands,
      stock,
      targetSizePerHand: 2,
      firstDrawerIndex: 0,
    })
    expect(h2[0]).toHaveLength(2)
    expect(h2[1]).toHaveLength(2)
    expect(s2).toHaveLength(0)
  })

  it('starts refill from firstDrawerIndex', () => {
    const c = (i: number): DurakCard => ({ id: `c${i}`, suit: 'spades', rank: '7' })
    const stock = [c(0), c(1), c(2), c(3)]
    const hands: DurakCard[][] = [[], []]
    const { hands: h2, stock: s2 } = drawUpToHandSize({
      hands,
      stock,
      targetSizePerHand: 2,
      firstDrawerIndex: 1,
    })
    expect(h2[1]![0]!.id).toBe('c0')
    expect(h2[0]![0]!.id).toBe('c1')
    expect(h2[1]![1]!.id).toBe('c2')
    expect(h2[0]![1]!.id).toBe('c3')
    expect(s2).toHaveLength(0)
  })

  it('handles empty hands array', () => {
    const r = drawUpToHandSize({ hands: [], stock: [card('hearts', '6')], targetSizePerHand: 1, firstDrawerIndex: 0 })
    expect(r.hands).toEqual([])
    expect(r.stock).toHaveLength(1)
  })
})
