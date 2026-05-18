/**
 * XP → level curve. Pure helper; no DB, no side effects. Keeping the curve
 * here (rather than baked into `xpService`) lets callers project a future
 * level from a hypothetical XP total without writing to the DB.
 *
 * Curve: level N requires `BASE * N * (N + 1) / 2` XP cumulatively
 * (triangular-number progression). Level 0 starts at 0 XP. Examples with
 * `BASE = 100`:
 *   level 1 → 100 XP
 *   level 2 → 300 XP
 *   level 3 → 600 XP
 *   level 4 → 1000 XP
 *   level 10 → 5500 XP
 * Mathematically the cumulative XP for level N is `BASE * triangle(N)`.
 *
 * Why triangular: simple to reason about, monotonically increasing gap,
 * no exponential explosion at high levels (a viewer earning 10 XP/message
 * still progresses past level 20 in a few thousand messages).
 */

export const LEVEL_BASE_XP = 100

function triangle(n: number): number {
  return (n * (n + 1)) / 2
}

/** Cumulative XP threshold to be at level `n` (level 0 → 0 XP). */
export function xpForLevel(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return LEVEL_BASE_XP * triangle(Math.floor(n))
}

/**
 * Largest non-negative integer `n` such that `xpForLevel(n) <= xp`. Returns
 * 0 for `xp <= 0`. Uses a closed-form quadratic solve so the function is
 * O(1) — no loops.
 */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0
  // BASE * n * (n + 1) / 2 <= xp  ⇒  n^2 + n - 2*xp/BASE <= 0
  const c = (2 * xp) / LEVEL_BASE_XP
  const n = Math.floor((-1 + Math.sqrt(1 + 4 * c)) / 2)
  return Math.max(0, n)
}

/** Snapshot helpful for wallet/me UI: current level + progress to next. */
export function deriveLevelSnapshot(xp: number): {
  level: number
  currentLevelXp: number
  nextLevelXp: number
  progressToNextLevel: number
} {
  const safe = Math.max(0, Math.floor(xp))
  const level = levelFromXp(safe)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - currentLevelXp)
  const progressToNextLevel = Math.max(
    0,
    Math.min(1, (safe - currentLevelXp) / span),
  )
  return { level, currentLevelXp, nextLevelXp, progressToNextLevel }
}
