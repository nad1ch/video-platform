import { normalizeDisplayName } from 'call-core'

/**
 * Mafia vs plain video call — same `CallPage` + `useCallOrchestrator`, different worlds:
 * - **Room id:** `mafia:<base>` here vs `<base>` on `/app/call` → separate mediasoup/signaling room for the same human-readable code.
 * - **Mafia game state** (`useMafiaGameStore` / `useMafiaPlayersStore`): only drives UI on `/app/mafia`; `CallPage`’s `refreshMafiaPlayersState` calls `clearWhenLeavingMafiaRoute()` when not on the mafia route so the shell does not keep night roles / queue after leaving.
 * - **Do not** mix transport: always derive join id via `mafiaSignalingRoomId` for the mafia app.
 */
export const MAFIA_SIGNALING_ROOM_PREFIX = 'mafia:' as const

/**
 * `join-room` id for the Mafia app: same base code as the Call app, but a separate signaling namespace.
 * Idempotent if `baseRoomId` already includes the prefix.
 */
export function mafiaSignalingRoomId(baseRoomId: string): string {
  const b = normalizeDisplayName(baseRoomId) || 'demo'
  if (b.startsWith(MAFIA_SIGNALING_ROOM_PREFIX)) {
    return b
  }
  return `${MAFIA_SIGNALING_ROOM_PREFIX}${b}`
}

/** Human / URL room segment (no `mafia:`) for copy, `?room=`, and header display. */
export function mafiaBaseRoomIdFromSignaling(signalingRoomId: string): string {
  const s = normalizeDisplayName(signalingRoomId) || 'demo'
  if (s.startsWith(MAFIA_SIGNALING_ROOM_PREFIX)) {
    return s.slice(MAFIA_SIGNALING_ROOM_PREFIX.length) || 'demo'
  }
  return s
}
