import { createSignalingRoomHelpers } from '@/composables/game-room/createSignalingRoomHelpers'

/**
 * Mafia vs plain video call — same `CallPage` + `useCallOrchestrator`, different worlds:
 * - **Room id:** `mafia:<base>` here vs `<base>` on `/app/call` → separate mediasoup/signaling room for the same human-readable code.
 * - **Mafia game state** (`useMafiaGameStore` / `useMafiaPlayersStore`): only drives UI on `/app/mafia`; `CallPage`’s `refreshMafiaPlayersState` calls `clearWhenLeavingMafiaRoute()` when not on the mafia route so the shell does not keep night roles / queue after leaving.
 * - **Do not** mix transport: always derive join id via `mafiaSignalingRoomId` for the mafia app.
 *
 * Implementation note: the two helpers below are now produced by the
 * generic `createSignalingRoomHelpers` factory (shared with the
 * `gameroom:` namespace). Public export names and behaviour are
 * preserved byte-for-byte.
 */
export const MAFIA_SIGNALING_ROOM_PREFIX = 'mafia:' as const

const mafiaSignalingRoom = createSignalingRoomHelpers(MAFIA_SIGNALING_ROOM_PREFIX)

/**
 * `join-room` id for the Mafia app: same base code as the Call app, but a separate signaling namespace.
 * Idempotent if `baseRoomId` already includes the prefix.
 */
export const mafiaSignalingRoomId = mafiaSignalingRoom.signalingRoomId

export const mafiaBaseRoomIdFromSignaling = mafiaSignalingRoom.baseRoomIdFromSignaling
