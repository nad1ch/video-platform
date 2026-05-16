import eliminatedPlayer01 from '@/assets/mafia/ui/eliminated-player-01.svg';
import eliminatedPlayer02 from '@/assets/mafia/ui/eliminated-player-02.svg';
import eliminatedPlayer03 from '@/assets/mafia/ui/eliminated-player-03.svg';
import eliminatedPlayer04 from '@/assets/mafia/ui/eliminated-player-04.svg';
import eliminatedPlayer05 from '@/assets/mafia/ui/eliminated-player-05.svg';
import eliminatedPlayer06 from '@/assets/mafia/ui/eliminated-player-06.svg';
import eliminatedPlayer07 from '@/assets/mafia/ui/eliminated-player-07.svg';
import eliminatedPlayer08 from '@/assets/mafia/ui/eliminated-player-08.svg';
import eliminatedPlayer09 from '@/assets/mafia/ui/eliminated-player-09.svg';
import eliminatedPlayer10 from '@/assets/mafia/ui/eliminated-player-10.svg';
const ELIMINATED_PLAYER_ICONS = [
    eliminatedPlayer01,
    eliminatedPlayer02,
    eliminatedPlayer03,
    eliminatedPlayer04,
    eliminatedPlayer05,
    eliminatedPlayer06,
    eliminatedPlayer07,
    eliminatedPlayer08,
    eliminatedPlayer09,
    eliminatedPlayer10,
];
function hashTextToUint(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function cleanPeerIds(peerIds) {
    const seen = new Set();
    const out = [];
    for (const peerId of peerIds) {
        const id = typeof peerId === 'string' ? peerId.trim() : '';
        if (id.length < 1 || seen.has(id))
            continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}
export function mafiaEliminatedPlayerIconForPeerId(peerId, seed = '') {
    const id = typeof peerId === 'string' && peerId.length > 0 ? peerId : 'unknown';
    return ELIMINATED_PLAYER_ICONS[hashTextToUint(`${seed}|${id}`) % ELIMINATED_PLAYER_ICONS.length];
}
export function mafiaEliminatedPlayerIconMapForPeerIds(peerIds, seed = '') {
    const uniquePeerIds = cleanPeerIds(peerIds);
    const assignmentOrder = [...uniquePeerIds].sort((a, b) => {
        const ah = hashTextToUint(`${seed}|order|${a}`);
        const bh = hashTextToUint(`${seed}|order|${b}`);
        if (ah !== bh)
            return ah - bh;
        return a.localeCompare(b);
    });
    const usedIndexes = new Set();
    const out = new Map();
    for (const peerId of assignmentOrder) {
        let iconIndex = hashTextToUint(`${seed}|icon|${peerId}`) % ELIMINATED_PLAYER_ICONS.length;
        let attempts = 0;
        while (usedIndexes.has(iconIndex) && attempts < ELIMINATED_PLAYER_ICONS.length) {
            iconIndex = (iconIndex + 1) % ELIMINATED_PLAYER_ICONS.length;
            attempts += 1;
        }
        usedIndexes.add(iconIndex);
        out.set(peerId, ELIMINATED_PLAYER_ICONS[iconIndex]);
    }
    return out;
}
