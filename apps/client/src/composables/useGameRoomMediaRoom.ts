import { normalizeDisplayName } from 'call-core'

/**
 * Generic game-room signaling namespace (Phase 3B).
 *
 * Parallel of `useMafiaMediaRoom.ts` but for the `gameroom:<base>` prefix —
 * Mafia and the Game Template fork therefore live in completely separate
 * mediasoup/signaling rooms even when their `?room=...` base values match.
 *
 * The server enforces the namespace split (`isGameRoomId` vs
 * `isMafiaRoomId`); the client wraps the call-join id via the helper below.
 */
export const GAME_ROOM_SIGNALING_ROOM_PREFIX = 'gameroom:' as const

/**
 * `join-room` id for the generic game-room. Idempotent if `baseRoomId`
 * already includes the prefix.
 */
export function gameRoomSignalingRoomId(baseRoomId: string): string {
  const b = normalizeDisplayName(baseRoomId) || 'demo'
  if (b.startsWith(GAME_ROOM_SIGNALING_ROOM_PREFIX)) {
    return b
  }
  return `${GAME_ROOM_SIGNALING_ROOM_PREFIX}${b}`
}

export function gameRoomBaseRoomIdFromSignaling(signalingRoomId: string): string {
  const s = normalizeDisplayName(signalingRoomId) || 'demo'
  if (s.startsWith(GAME_ROOM_SIGNALING_ROOM_PREFIX)) {
    return s.slice(GAME_ROOM_SIGNALING_ROOM_PREFIX.length) || 'demo'
  }
  return s
}
