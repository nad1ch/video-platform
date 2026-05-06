/**
 * Speaking / nomination queue encoding for Mafia and Eat First call UIs.
 *
 * - Even-length arrays are pair-encoded: `[by1, target1, by2, target2, ...]`.
 * - Odd-length arrays are treated as legacy target-only lists (one seat per nomination, no nominator).
 */

export type SpeakingNominationSegment = {
  pairIndex: number
  bySeat: number | null
  targetSeat: number
}

export function decodeSpeakingNominationFlat(flat: number[]): SpeakingNominationSegment[] {
  if (!Array.isArray(flat) || flat.length < 1) {
    return []
  }
  if (flat.length % 2 === 1) {
    return flat.map((targetSeat, pairIndex) => ({
      pairIndex,
      bySeat: null,
      targetSeat,
    }))
  }
  const out: SpeakingNominationSegment[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const bySeat = flat[i]!
    const targetSeat = flat[i + 1]!
    out.push({ pairIndex: out.length, bySeat, targetSeat })
  }
  return out
}

export function seatsInvolvedInSpeakingNominationFlat(flat: number[]): Set<number> {
  const s = new Set<number>()
  if (!Array.isArray(flat) || flat.length < 1) {
    return s
  }
  if (flat.length % 2 === 1) {
    for (const t of flat) {
      if (typeof t === 'number' && Number.isInteger(t) && t >= 1) {
        s.add(t)
      }
    }
    return s
  }
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const a = flat[i]!
    const b = flat[i + 1]!
    if (typeof a === 'number' && Number.isInteger(a) && a >= 1) {
      s.add(a)
    }
    if (typeof b === 'number' && Number.isInteger(b) && b >= 1) {
      s.add(b)
    }
  }
  return s
}

/**
 * Seats that are **nominated targets** only: odd-length queues are legacy
 * target-only (every entry counts); even-length is `[by, target, ...]` — only
 * each `target` seat (used for tile highlight, not the nominator).
 */
export function nominationTargetSeatsFromSpeakingFlat(flat: number[]): Set<number> {
  const s = new Set<number>()
  if (!Array.isArray(flat) || flat.length < 1) {
    return s
  }
  if (flat.length % 2 === 1) {
    for (const t of flat) {
      if (typeof t === 'number' && Number.isInteger(t) && t >= 1) {
        s.add(t)
      }
    }
    return s
  }
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const target = flat[i + 1]!
    if (typeof target === 'number' && Number.isInteger(target) && target >= 1) {
      s.add(target)
    }
  }
  return s
}
