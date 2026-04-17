import { mergeJson } from './mergePatch'

/** Top-level room keys that should replace entirely (not deep-merge), mirroring Firestore map replace semantics. */
const REPLACE_TOP = new Set(['voting', 'hands', 'playersReady'])

/**
 * Merge a room document patch. `null` removes a key. `voting` / `hands` / `playersReady` replace wholesale.
 */
export function mergeEatFirstRoom(existing: unknown, patch: unknown): unknown {
  if (patch === null || patch === undefined) {
    return existing
  }
  if (typeof patch !== 'object' || Array.isArray(patch)) {
    return patch
  }
  const base =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === null) {
      delete base[k]
      continue
    }
    if (REPLACE_TOP.has(k)) {
      base[k] = v
      continue
    }
    if (
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v) &&
      typeof base[k] === 'object' &&
      base[k] !== null &&
      !Array.isArray(base[k])
    ) {
      base[k] = mergeEatFirstRoom(base[k], v)
    } else {
      base[k] = v
    }
  }
  return base
}

/**
 * Player document merge: deep merge like Firestore, but `activeCard` replaces entirely when present
 * (avoids stale templateId / effectId from partial patches).
 */
export function mergeEatFirstPlayerData(prev: unknown, patch: unknown): unknown {
  const p =
    typeof patch === 'object' && patch !== null && !Array.isArray(patch)
      ? { ...(patch as Record<string, unknown>) }
      : {}
  delete p.key
  const replaceActiveCard = Object.prototype.hasOwnProperty.call(p, 'activeCard')
  const ac = replaceActiveCard ? p.activeCard : undefined
  if (replaceActiveCard) {
    delete p.activeCard
  }
  const merged = mergeJson(prev, p)
  if (!replaceActiveCard) {
    return merged
  }
  const o =
    typeof merged === 'object' && merged !== null && !Array.isArray(merged)
      ? { ...(merged as Record<string, unknown>) }
      : {}
  if (ac === null) {
    delete o.activeCard
  } else {
    o.activeCard = ac
  }
  return o
}

/** Deep merge for rare nested player updates (e.g. revive flag). */
export function mergePlayerDeep(existing: unknown, patch: unknown): unknown {
  return mergeJson(existing, patch)
}
