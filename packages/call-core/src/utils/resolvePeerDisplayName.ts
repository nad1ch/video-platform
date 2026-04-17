import { guestDisplayNameForPeerId, type Participant } from './participantsMapper'
import { normalizeDisplayName } from './normalizeDisplayName'

export type ResolvePeerDisplayNameForUiOptions = {
  selfPeerId: string
  /** Trimming applied by caller — used when the local row is missing from the map. */
  selfDisplayName: string
}

/**
 * Call UI display name: prefer `Participant.displayName` from `buildCallParticipantMap` / tiles.
 * If the peer is missing or has an empty label, uses the same rules as `resolveParticipantDisplayName`
 * (You / guest id) — **not** `session.labelFor` (store-only).
 */
export function resolvePeerDisplayNameForUi(
  peerId: string,
  participants: ReadonlyMap<string, Participant>,
  opts: ResolvePeerDisplayNameForUiOptions,
): string {
  const row = participants.get(peerId)
  if (row !== undefined && row.displayName.length > 0) {
    return row.displayName
  }
  if (peerId === opts.selfPeerId) {
    const t = typeof opts.selfDisplayName === 'string' ? normalizeDisplayName(opts.selfDisplayName) : ''
    return t || 'You'
  }
  return guestDisplayNameForPeerId(peerId)
}

/**
 * One pass over `participants` keys → final UI label per peer (same strings as repeated
 * `resolvePeerDisplayNameForUi` calls). Use in computed stores so templates do not invoke the
 * resolver on every re-render when only unrelated UI state (e.g. mic toggles) changes.
 */
export function buildDisplayNameUiMap(
  participants: ReadonlyMap<string, Participant>,
  opts: ResolvePeerDisplayNameForUiOptions,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const peerId of participants.keys()) {
    out.set(peerId, resolvePeerDisplayNameForUi(peerId, participants, opts))
  }
  return out
}
