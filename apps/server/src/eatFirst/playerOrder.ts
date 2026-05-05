import { normalizeEatFirstSlot } from './slot'

/** Max Eat First player seats (p1..p11). Host is not a player; host display seat is N+1 (max 12). */
export const EAT_FIRST_MAX_PLAYER_SLOTS = 11

/**
 * Returns 1..11 for valid player slot ids (`p1`..`p11`). Rejects `p0`, `p12`, non-`pN` shapes.
 */
export function eatFirstNumericPlayerSlotFromId(normalizedSlotId: string): number | null {
  const m = String(normalizedSlotId).toLowerCase().match(/^p(\d+)$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n < 1 || n > EAT_FIRST_MAX_PLAYER_SLOTS) return null
  return n
}

export function isEatFirstPlayerSlotId(normalizedSlotId: string): boolean {
  return eatFirstNumericPlayerSlotFromId(normalizedSlotId) != null
}

export function getEatFirstPlayerDisplaySeat(
  playerOrder: readonly string[],
  playerId: string,
): number | null {
  const pid = normalizeEatFirstSlot(playerId)
  const i = playerOrder.indexOf(pid)
  return i === -1 ? null : i + 1
}

/** Host display seat is always player count + 1 (e.g. N=0 => 1, N=11 => 12). */
export function getEatFirstHostDisplaySeat(playerOrder: readonly string[]): number {
  return playerOrder.length + 1
}

/**
 * Parses `playerOrder` from room JSON. Returns null if not a strict list of unique `p1`..`p11` ids.
 */
export function eatFirstPlayerOrderFromUnknown(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') return null
    const id = normalizeEatFirstSlot(item.trim())
    if (!id || !isEatFirstPlayerSlotId(id)) return null
    if (seen.has(id)) return null
    seen.add(id)
    out.push(id)
  }
  return out
}

export function isEatFirstPlayerOrderPermutationOfAllowed(
  order: readonly string[],
  allowed: ReadonlySet<string>,
): boolean {
  if (order.length !== allowed.size || order.length > EAT_FIRST_MAX_PLAYER_SLOTS) return false
  const seen = new Set<string>()
  for (const id of order) {
    if (!allowed.has(id) || seen.has(id)) return false
    seen.add(id)
  }
  return seen.size === allowed.size
}

/** Deterministic fallback: numeric sort of allowed slot ids (matches legacy snapshot player sort). */
export function deriveEatFirstDefaultPlayerOrder(allowedSlotIds: ReadonlySet<string>): string[] {
  return [...allowedSlotIds].sort(
    (a, b) =>
      (eatFirstNumericPlayerSlotFromId(a) ?? 999) - (eatFirstNumericPlayerSlotFromId(b) ?? 999),
  )
}

/**
 * Resolves authoritative display order. If stored `playerOrder` is missing or not an exact
 * permutation of `allowedSlotIds`, falls back to `deriveEatFirstDefaultPlayerOrder`.
 */
export function resolveEatFirstEffectivePlayerOrder(
  storedRoomPlayerOrder: unknown,
  allowedSlotIds: ReadonlySet<string>,
): string[] {
  const parsed = eatFirstPlayerOrderFromUnknown(storedRoomPlayerOrder)
  if (parsed && isEatFirstPlayerOrderPermutationOfAllowed(parsed, allowedSlotIds)) {
    return [...parsed]
  }
  return deriveEatFirstDefaultPlayerOrder(allowedSlotIds)
}
