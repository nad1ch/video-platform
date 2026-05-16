import { createSignalingRoomHelpers } from '@/composables/game-room/createSignalingRoomHelpers';
/**
 * Generic game-room signaling namespace (Phase 3B).
 *
 * Parallel of `useMafiaMediaRoom.ts` but for the `gameroom:<base>` prefix —
 * Mafia and the Game Template fork therefore live in completely separate
 * mediasoup/signaling rooms even when their `?room=...` base values match.
 *
 * The server enforces the namespace split (`isGameRoomId` vs
 * `isMafiaRoomId`); the client wraps the call-join id via the helper below.
 *
 * Implementation note: the two helpers below are now produced by the
 * generic `createSignalingRoomHelpers` factory (shared with the
 * `mafia:` namespace). Public export names and behaviour are
 * preserved byte-for-byte.
 */
export const GAME_ROOM_SIGNALING_ROOM_PREFIX = 'gameroom:';
const gameRoomSignalingRoom = createSignalingRoomHelpers(GAME_ROOM_SIGNALING_ROOM_PREFIX);
/**
 * `join-room` id for the generic game-room. Idempotent if `baseRoomId`
 * already includes the prefix.
 */
export const gameRoomSignalingRoomId = gameRoomSignalingRoom.signalingRoomId;
export const gameRoomBaseRoomIdFromSignaling = gameRoomSignalingRoom.baseRoomIdFromSignaling;
