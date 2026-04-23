/**
 * CS-style strip roll: horizontal list ends with the target under the center marker.
 * Pure layout math — no DOM.
 *
 * @param endTranslate - translateX (px) on the row so center of `landIndex` aligns with viewport center
 */
import {
  buildSpinStripFromPayout,
  type BuildSpinReelOpts,
  type SpinStripCell,
} from '@/utils/coinHub/coinHubSpinReel'

export {
  getSpinRarity,
  getSpinRarityForLabel,
  type SpinRarity,
} from '@/utils/coinHub/coinHubRarity'

export type { BuildSpinReelOpts, SpinStripCell }
export { buildSpinStripFromPayout }

export function endTranslateX(viewportWidthPx: number, itemWidthPx: number, landIndex: number): number {
  if (!Number.isFinite(viewportWidthPx) || !Number.isFinite(itemWidthPx) || viewportWidthPx <= 0) {
    return 0
  }
  if (itemWidthPx <= 0) return 0
  if (!Number.isFinite(landIndex) || landIndex < 0) return 0
  return (viewportWidthPx - itemWidthPx) / 2 - landIndex * itemWidthPx
}

export function easeOutCubic(t: number) {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) ** 3
}

/** Main slot reward pool (visual + filler). Server `targetPayout` must appear as last tease cell. */
export const SLOT_VISUAL_POOL: readonly number[] = [5, 8, 12, 20, 25, 50, 100]

/**
 * Weights for legacy helpers / tests (not the only filler source; spin reel uses tier bias too).
 * Low values more frequent.
 */
const WEIGHTED_POOL: readonly { value: number; weight: number }[] = [
  { value: 5, weight: 30 },
  { value: 8, weight: 25 },
  { value: 12, weight: 20 },
  { value: 20, weight: 10 },
  { value: 25, weight: 8 },
  { value: 50, weight: 5 },
  { value: 100, weight: 2 },
]

/** Picks a visual value for non-winning strip cells (weighted). Exposed for tests / future tuning. */
export function pickWeightedVisualReward(rng: () => number = Math.random): number {
  const total = WEIGHTED_POOL.reduce((s, r) => s + r.weight, 0)
  let r = rng() * total
  for (const { value, weight } of WEIGHTED_POOL) {
    if (r < weight) {
      return value
    }
    r -= weight
  }
  return WEIGHTED_POOL[0]!.value
}

/**
 * Long horizontal “tape”; **landIndex** cell is always the server coin result (string `display` matches `targetPayout`).
 * Server remains authoritative; this is only presentation (weighted fillers, shuffled waves, near-miss theatre).
 */
export function buildSpinStripCells(
  targetPayout: number,
  opts?: BuildSpinReelOpts,
): { cells: SpinStripCell[]; landIndex: number } {
  return buildSpinStripFromPayout(targetPayout, opts)
}

/** Alias for clarity in UI docs — same as `buildSpinStripCells`. */
export const buildVisualReel = buildSpinStripCells

/**
 * "Slot" motion: fast run → long decel (inertia) → final approach → last-time snap.
 * Pairs with long `durationMs` on the strip + overshoot bounce.
 */
export function mapSlotMachineProgress(u: number): number {
  const t = Math.min(1, Math.max(0, u))
  if (t <= 0) {
    return 0
  }
  if (t >= 1) {
    return 1
  }
  if (t < 0.12) {
    return 0.28 * (t / 0.12) ** 1.05
  }
  if (t < 0.58) {
    return 0.28 + 0.52 * ((t - 0.12) / 0.46) ** 0.88
  }
  if (t < 0.9) {
    return 0.8 + 0.17 * (1 - (1 - (t - 0.58) / 0.32) ** 1.75)
  }
  return 0.97 + 0.03 * ((t - 0.9) / 0.1) ** 0.75
}

/**
 * Back-compat export: `mapSpinScrollProgress` is now the phased slot curve (was split bezier + tail).
 * Games that relied on the old curve should re-tune; daily spin now uses this exclusively.
 */
export function mapSpinScrollProgress(u: number): number {
  return mapSlotMachineProgress(u)
}

const CASE_POOL: readonly string[] = ['+5', '+10', '+15', '+20', '+25', '+30', '+50', '+100']

/**
 * Pads with pool values; places `targetLine` at a fixed index so the roll can land on it.
 */
export function buildCaseStripCells(targetLine: string): { cells: string[]; landIndex: number } {
  const out: string[] = []
  for (let i = 0; i < 32; i += 1) {
    out.push(CASE_POOL[i % CASE_POOL.length] ?? '+10')
  }
  out.push(targetLine)
  for (let i = 0; i < 5; i += 1) {
    out.push(CASE_POOL[i % CASE_POOL.length] ?? '+10')
  }
  const landIndex = 32
  return { cells: out, landIndex: landIndex }
}
