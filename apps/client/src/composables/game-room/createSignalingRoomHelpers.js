import { normalizeDisplayName } from 'call-core';
export function createSignalingRoomHelpers(prefix) {
    function signalingRoomId(baseRoomId) {
        const b = normalizeDisplayName(baseRoomId) || 'demo';
        if (b.startsWith(prefix)) {
            return b;
        }
        return `${prefix}${b}`;
    }
    function baseRoomIdFromSignaling(signalingRoomId) {
        const s = normalizeDisplayName(signalingRoomId) || 'demo';
        if (s.startsWith(prefix)) {
            return s.slice(prefix.length) || 'demo';
        }
        return s;
    }
    return { signalingRoomId, baseRoomIdFromSignaling };
}
