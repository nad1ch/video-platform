import { normalizeDisplayName } from 'call-core'

/**
 * Factory for the small pair of helpers each call-game route uses to
 * wrap its `join-room` id under a signaling-namespace prefix. The
 * Mafia and Game Template helper files (`useMafiaMediaRoom`,
 * `useGameRoomMediaRoom`) re-export the returned functions under
 * their stable, route-specific public names; this factory exists only
 * to avoid duplicating the two trivial implementations.
 *
 * Behaviour matches the historic helpers byte-for-byte:
 *   - `normalizeDisplayName` is applied to the raw input.
 *   - Empty / falsy input collapses to `'demo'`.
 *   - `signalingRoomId` is idempotent if `baseRoomId` already starts
 *     with the prefix.
 *   - `baseRoomIdFromSignaling` strips the prefix only when present,
 *     and re-collapses an empty tail to `'demo'`.
 */
export interface SignalingRoomHelpers {
  signalingRoomId(baseRoomId: string): string
  baseRoomIdFromSignaling(signalingRoomId: string): string
}

export function createSignalingRoomHelpers(prefix: string): SignalingRoomHelpers {
  function signalingRoomId(baseRoomId: string): string {
    const b = normalizeDisplayName(baseRoomId) || 'demo'
    if (b.startsWith(prefix)) {
      return b
    }
    return `${prefix}${b}`
  }

  function baseRoomIdFromSignaling(signalingRoomId: string): string {
    const s = normalizeDisplayName(signalingRoomId) || 'demo'
    if (s.startsWith(prefix)) {
      return s.slice(prefix.length) || 'demo'
    }
    return s
  }

  return { signalingRoomId, baseRoomIdFromSignaling }
}
