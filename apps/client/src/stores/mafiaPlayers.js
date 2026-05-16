import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { normalizeDisplayName } from 'call-core';
import { syncMafiaJoinOrder } from '@/utils/mafiaPlayerOrderSync';
export const useMafiaPlayersStore = defineStore('mafiaPlayers', () => {
    const roomKey = ref('');
    const joinOrder = ref([]);
    const players = shallowRef([]);
    function buildRoomKey(raw) {
        return normalizeDisplayName(String(raw ?? '')) || 'demo';
    }
    function syncWithPeers(rawRoomId, enginePeerOrder) {
        const key = buildRoomKey(rawRoomId);
        const next = syncMafiaJoinOrder({
            roomKey: key,
            previousRoomKey: roomKey.value,
            previousOrder: joinOrder.value,
            enginePeerOrder,
        });
        const nextJoinKey = next.joinOrder.join('\u0000');
        const curJoinKey = joinOrder.value.join('\u0000');
        if (next.roomKey === roomKey.value && nextJoinKey === curJoinKey) {
            return;
        }
        roomKey.value = next.roomKey;
        joinOrder.value = next.joinOrder;
    }
    function setPlayerRowsDisplay(rows) {
        players.value = rows;
    }
    function clearPlayerRowsForUi() {
        if (players.value.length === 0) {
            return;
        }
        players.value = [];
    }
    function numberForPeer(peerId) {
        const i = joinOrder.value.indexOf(peerId);
        return i === -1 ? undefined : i + 1;
    }
    function reset() {
        roomKey.value = '';
        joinOrder.value = [];
        players.value = [];
    }
    return {
        roomKey,
        joinOrder,
        players,
        syncWithPeers,
        setPlayerRowsDisplay,
        clearPlayerRowsForUi,
        numberForPeer,
        reset,
    };
});
