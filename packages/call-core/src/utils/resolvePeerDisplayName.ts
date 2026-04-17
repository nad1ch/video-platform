import { guestDisplayNameForPeerId, type Participant } from './participantsMapper'

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
    const t = typeof opts.selfDisplayName === 'string' ? opts.selfDisplayName.trim() : ''
    return t || 'You'
  }
  return guestDisplayNameForPeerId(peerId)
}
