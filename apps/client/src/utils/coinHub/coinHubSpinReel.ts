/**
 * Daily spin reel builder: structured cells (coins + bonus theatre), rarity, near-miss, dry-streak bias.
 * Authoritative payout remains the server `targetPayout` (coins only in API); bonuses are visual filler.
 */
import { getSpinRarity, type SpinRarity } from '@/utils/coinHub/coinHubRarity'

export type SpinStripCell = {
  id: string
  display: string
  rarity: SpinRarity
  kind: 'coins' | 'bonus'
  bonusType?: 'boost' | 'case' | 'multiplier'
  /** Tease cell: user’s eye catches a “big” symbol just before the real result. */
  nearMiss?: boolean
}

export type BuildSpinReelOpts = {
  /** Incremented client-side when last several spins were below “big” threshold (e.g. &lt; 50 coins). */
  spinsSinceBigWin?: number
  rng?: () => number
}

const WAVE_PASSES = 5
const FILLER_LEN = 24
const RIGHT_PAD_AFTER_WIN = 14

/** Server win is “big” enough to reset dry counter (epic / legendary coin line). */
export const SPIN_BIG_WIN_MIN_COINS = 50

const POOL_VALUES: readonly number[] = [5, 8, 10, 12, 15, 20, 25, 50, 100]

const COMMON_VALS = [5, 8] as const
const UNCOMMON_VALS = [10, 12, 15] as const
const RARE_VALS = [20, 25] as const
const EPIC_VALS = [50] as const
const LEGENDARY_VALS = [100] as const

const BONUS_TYPES = ['boost', 'case', 'multiplier'] as const
export type BonusKind = (typeof BONUS_TYPES)[number]

const BONUS_DISPLAY: Record<BonusKind, { display: string; rarity: SpinRarity }> = {
  boost: { display: '⚡', rarity: 'rare' },
  case: { display: '📦', rarity: 'epic' },
  multiplier: { display: '×2', rarity: 'legendary' },
}

let idSeq = 0
function nextId(): string {
  idSeq += 1
  return `ch-reel-${idSeq}`
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const a = arr[i]!
    const b = arr[j]!
    arr[i] = b
    arr[j] = a
  }
  return arr
}

function pickIn<T extends readonly number[]>(arr: T, rng: () => number): number {
  return arr[Math.floor(rng() * arr.length)]!
}

/**
 * Tier pick: base 60 / 25 / 10 / 5, nudged toward high tiers when `dry` grows (capped).
 */
export function pickRarityWithBias(dry: number, rng: () => number): SpinRarity {
  const d = Math.min(24, Math.max(0, dry))
  /** Up to ~9% mass moved from common toward rarer tiers. */
  const shift = Math.min(0.09, d * 0.0035)
  let pC = 0.52 - shift
  let pU = 0.1 + shift * 0.2
  let pR = 0.2 + shift * 0.4
  let pE = 0.12 + shift * 0.3
  const pL = 0.06 + shift * 0.2
  const sum = pC + pU + pR + pE + pL
  pC /= sum
  pU /= sum
  pR /= sum
  pE /= sum
  const r = rng()
  if (r < pC) {
    return 'common'
  }
  if (r < pC + pU) {
    return 'uncommon'
  }
  if (r < pC + pU + pR) {
    return 'rare'
  }
  if (r < pC + pU + pR + pE) {
    return 'epic'
  }
  return 'legendary'
}

function coinValueForRarity(tier: SpinRarity, rng: () => number): number {
  switch (tier) {
    case 'common':
      return pickIn(COMMON_VALS, rng)
    case 'uncommon':
      return pickIn(UNCOMMON_VALS, rng)
    case 'rare':
      return pickIn(RARE_VALS, rng)
    case 'epic':
      return pickIn(EPIC_VALS, rng)
    case 'legendary':
    default:
      return pickIn(LEGENDARY_VALS, rng)
  }
}

function coinCell(value: number, nearMiss = false): SpinStripCell {
  return {
    id: nextId(),
    display: String(value),
    rarity: getSpinRarity(value),
    kind: 'coins',
    nearMiss,
  }
}

function bonusCell(kind: BonusKind): SpinStripCell {
  const b = BONUS_DISPLAY[kind]
  return {
    id: nextId(),
    display: b.display,
    rarity: b.rarity,
    kind: 'bonus',
    bonusType: kind,
  }
}

/** Filler: mostly weighted coins; ~9% bonus tokens (theatre only). */
function pickFillerCell(dry: number, rng: () => number): SpinStripCell {
  if (rng() < 0.09) {
    return bonusCell(BONUS_TYPES[Math.floor(rng() * BONUS_TYPES.length)]!)
  }
  const tier = pickRarityWithBias(dry, rng)
  return coinCell(coinValueForRarity(tier, rng))
}

/**
 * ~25%: extra “passed the 100” beat for non-legendary server outcomes (psychological near-miss).
 */
function useExtendedNearMissTease(targetPayout: number, rng: () => number): boolean {
  if (getSpinRarity(targetPayout) === 'legendary') {
    return false
  }
  return rng() < 0.26
}

function buildTeaseCells(targetPayout: number, rng: () => number): SpinStripCell[] {
  if (useExtendedNearMissTease(targetPayout, rng)) {
    if (targetPayout >= 100) {
      return [coinCell(100, true), coinCell(50, true), coinCell(50), coinCell(targetPayout)]
    }
    const mid = targetPayout <= 12 ? 12 : targetPayout < 50 ? 25 : 50
    return [coinCell(100, true), coinCell(50, true), coinCell(mid), coinCell(targetPayout)]
  }
  if (targetPayout >= 100) {
    if (targetPayout === 100) {
      return [coinCell(100), coinCell(50), coinCell(targetPayout)]
    }
    return rng() < 0.5
      ? [coinCell(100), coinCell(50), coinCell(targetPayout)]
      : [coinCell(100), coinCell(99), coinCell(targetPayout)]
  }
  if (targetPayout === 50) {
    return [coinCell(100, true), coinCell(25), coinCell(targetPayout)]
  }
  if (targetPayout < 50) {
    return [coinCell(100, true), coinCell(50), coinCell(targetPayout)]
  }
  return [coinCell(100), coinCell(50), coinCell(targetPayout)]
}

/**
 * Builds the full strip. `landIndex` points at the server coin result (last tease cell before right padding).
 */
export function buildSpinStripFromPayout(targetPayout: number, opts?: BuildSpinReelOpts): {
  cells: SpinStripCell[]
  landIndex: number
} {
  const rng = opts?.rng ?? Math.random
  const dry = Math.max(0, opts?.spinsSinceBigWin ?? 0)
  idSeq = 0
  const out: SpinStripCell[] = []

  for (let w = 0; w < WAVE_PASSES; w += 1) {
    const wave = shuffleInPlace([...POOL_VALUES], rng)
    for (const n of wave) {
      out.push(coinCell(n))
    }
  }
  for (let i = 0; i < FILLER_LEN; i += 1) {
    out.push(pickFillerCell(dry, rng))
  }
  if (targetPayout < 100 && rng() < 0.32) {
    out.push(coinCell(100, true))
  }
  const tease = buildTeaseCells(targetPayout, rng)
  for (const c of tease) {
    out.push(c)
  }
  const landIndex = out.length - 1
  for (let p = 0; p < RIGHT_PAD_AFTER_WIN; p += 1) {
    out.push(pickFillerCell(dry, rng))
  }
  return { cells: out, landIndex }
}

/** @deprecated use `cell.display` */
export function stripCellToLabel(cell: SpinStripCell): string {
  return cell.display
}
