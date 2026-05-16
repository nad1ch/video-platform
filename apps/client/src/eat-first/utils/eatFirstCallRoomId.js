import { normalizeDisplayName } from 'call-core';
/**
 * Eat First uses the same CallPage shell as Call/Mafia but a distinct signaling
 * namespace so mediasoup rooms never collide with plain `/app/call` codes.
 */
export const EAT_FIRST_SIGNALING_ROOM_PREFIX = 'eat:';
export function eatFirstSignalingRoomId(baseRoomId) {
    const b = normalizeDisplayName(baseRoomId) || 'demo';
    if (b.startsWith(EAT_FIRST_SIGNALING_ROOM_PREFIX)) {
        return b;
    }
    return `${EAT_FIRST_SIGNALING_ROOM_PREFIX}${b}`;
}
export function eatFirstBaseRoomIdFromSignaling(signalingRoomId) {
    const s = normalizeDisplayName(signalingRoomId) || 'demo';
    if (s.startsWith(EAT_FIRST_SIGNALING_ROOM_PREFIX)) {
        return s.slice(EAT_FIRST_SIGNALING_ROOM_PREFIX.length) || 'demo';
    }
    return s;
}
