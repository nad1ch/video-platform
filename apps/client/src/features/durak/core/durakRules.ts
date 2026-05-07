import type { DurakCard, DurakCardRank, DurakCardSuit, DurakTablePair } from './cardTypes'

/** Unit interval [0, 1), same contract as `Math.random`. */
export type DurakRng = () => number

const SUITS: DurakCardSuit[] = ['clubs', 'diamonds', 'hearts', 'spades']

const RANKS: DurakCardRank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const RANK_STRENGTH: Record<DurakCardRank, number> = {
  '6': 0,
  '7': 1,
  '8': 2,
  '9': 3,
  '10': 4,
  J: 5,
  Q: 6,
  K: 7,
  A: 8,
}

export type DurakDealResult = {
  hands: DurakCard[][]
  stock: DurakCard[]
}

export type DurakTrumpInfo = {
  trumpCard: DurakCard
  trumpSuit: DurakCardSuit
}

/** Stable 36-card deck (6–A × 4 suits). IDs are deterministic for tests and snapshots. */
export function createDurakDeck(): DurakCard[] {
  const out: DurakCard[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      out.push({ id: `durak:${suit}:${rank}`, suit, rank })
    }
  }
  return out
}

/** Fisher–Yates shuffle; does not mutate `deck`. Optional `rng` for deterministic tests. */
export function shuffleDeck(deck: readonly DurakCard[], rng: DurakRng = Math.random): DurakCard[] {
  const a = deck.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
  return a
}

/** Standard 36-card Durak initial hand sizes by player count. */
export function initialHandSizeForPlayerCount(playerCount: number): number {
  if (playerCount === 2 || playerCount === 3) return 6
  if (playerCount === 4) return 5
  if (playerCount === 5) return 4
  if (playerCount === 6) return 3
  throw new RangeError('Durak: playerCount must be between 2 and 6')
}

/**
 * Deals `initialHandSizeForPlayerCount(n)` cards to each of `n` players from the top of `deck`
 * (index 0 first), round-robin. Remainder is the stock; trump is the bottom card (`determineTrump`).
 */
export function dealInitialHands(deck: readonly DurakCard[], playerCount: number): DurakDealResult {
  const perHand = initialHandSizeForPlayerCount(playerCount)
  const total = perHand * playerCount
  if (total > deck.length) {
    throw new RangeError('Durak: deck too small for deal')
  }
  const hands: DurakCard[][] = Array.from({ length: playerCount }, () => [])
  let k = 0
  for (let round = 0; round < perHand; round += 1) {
    for (let p = 0; p < playerCount; p += 1) {
      hands[p]!.push(deck[k]!)
      k += 1
    }
  }
  return { hands, stock: deck.slice(k) }
}

/** Trump suit is the bottom card of the stock (last index), Russian Durak convention. */
export function determineTrump(stock: readonly DurakCard[]): DurakTrumpInfo {
  if (stock.length === 0) {
    throw new RangeError('Durak: empty stock has no trump')
  }
  const trumpCard = stock[stock.length - 1]!
  return { trumpCard, trumpSuit: trumpCard.suit }
}

export function rankStrength(rank: DurakCardRank): number {
  return RANK_STRENGTH[rank]
}

/** Compare ranks: negative if `a` weaker than `b`, zero equal, positive if `a` stronger. */
export function compareRanks(a: DurakCardRank, b: DurakCardRank): number {
  return rankStrength(a) - rankStrength(b)
}

export function isTrump(card: DurakCard, trumpSuit: DurakCardSuit): boolean {
  return card.suit === trumpSuit
}

/**
 * Podkidnoy beat: defender beats attacker if same suit higher rank (non-trump),
 * any trump beats any non-trump attacker, or higher trump beats lower trump.
 */
export function canBeat(attackerCard: DurakCard, defenderCard: DurakCard, trumpSuit: DurakCardSuit): boolean {
  const attT = isTrump(attackerCard, trumpSuit)
  const defT = isTrump(defenderCard, trumpSuit)

  if (!attT && defT) return true
  if (attT && !defT) return false
  if (attT && defT) {
    return compareRanks(defenderCard.rank, attackerCard.rank) > 0
  }
  if (defenderCard.suit === attackerCard.suit) {
    return compareRanks(defenderCard.rank, attackerCard.rank) > 0
  }
  return false
}

export function ranksOnTable(table: readonly DurakTablePair[]): Set<DurakCardRank> {
  const s = new Set<DurakCardRank>()
  for (const row of table) {
    s.add(row.attacker.rank)
    if (row.defender) s.add(row.defender.rank)
  }
  return s
}

/** First card of an attack: any. Adding to attack: rank must already appear on the table. */
export function canAttack(card: DurakCard, table: readonly DurakTablePair[]): boolean {
  if (table.length === 0) return true
  return ranksOnTable(table).has(card.rank)
}

/** Defend an open slot: `defenderCard` must beat `tablePair.attacker` under `trumpSuit`. */
export function canDefend(tablePair: DurakTablePair, defenderCard: DurakCard, trumpSuit: DurakCardSuit): boolean {
  if (tablePair.defender != null) return false
  return canBeat(tablePair.attacker, defenderCard, trumpSuit)
}

/**
 * One refill round: each player below `targetSizePerHand` takes at most one card, in seat order
 * starting at `firstDrawerIndex`, repeated until all are full or the stock is empty.
 */
export function drawUpToHandSize(args: {
  hands: readonly DurakCard[][]
  stock: readonly DurakCard[]
  targetSizePerHand: number
  firstDrawerIndex: number
}): { hands: DurakCard[][]; stock: DurakCard[] } {
  const { targetSizePerHand, firstDrawerIndex } = args
  const hands = args.hands.map((h) => h.slice())
  const stock = args.stock.slice()
  const n = hands.length
  if (n === 0) return { hands, stock }

  for (;;) {
    if (stock.length === 0) break
    if (hands.every((h) => h.length >= targetSizePerHand)) break

    let progressed = false
    for (let step = 0; step < n; step += 1) {
      if (stock.length === 0) break
      const drawer = (firstDrawerIndex + step + n) % n
      if (hands[drawer]!.length < targetSizePerHand) {
        hands[drawer]!.push(stock.shift()!)
        progressed = true
      }
    }
    if (!progressed) break
  }
  return { hands, stock }
}
