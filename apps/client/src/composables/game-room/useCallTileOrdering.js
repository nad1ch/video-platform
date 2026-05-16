import { computed } from 'vue';
import { pinHostPeerToEndOfOrder } from '@/utils/gameHostOrdering';
import { resolveHostPeerIdForGrid } from '@/components/call/callTileOrderRules';
import { buildFallbackOrderedTiles, buildHostLastOrderedTiles, } from './callTileOrdering';
export function useCallTileOrdering(options) {
    const { tiles, tileOrder, pinnedPeerId, getSpotlightActive, peerDisplayName, localTileSpeaking, activeSpeakerPeerId, serverActiveSpeakerPeerId, hostLastPolicy, customOrdering, } = options;
    const orderedTiles = computed(() => {
        const list = tiles.value.slice();
        if (customOrdering) {
            const custom = customOrdering();
            if (custom !== null && custom !== undefined) {
                return [...custom];
            }
        }
        if (hostLastPolicy.isActive.value && list.length > 0) {
            const base = hostLastPolicy.getDisplayNumberingOrder([...tileOrder.value]);
            const explicitHostPeerId = hostLastPolicy.getExplicitHostPeerId();
            const hostPidForGrid = resolveHostPeerIdForGrid(explicitHostPeerId, base);
            const order = hostPidForGrid.length > 0
                ? pinHostPeerToEndOfOrder(base, hostPidForGrid)
                : base.slice();
            return buildHostLastOrderedTiles(list, order, hostPidForGrid);
        }
        return buildFallbackOrderedTiles(list, tileOrder.value, pinnedPeerId.value, getSpotlightActive());
    });
    const orderedGridRows = computed(() => orderedTiles.value.map((tile) => ({
        tile,
        displayName: peerDisplayName(tile.peerId),
    })));
    function isTileRowSpeaking(row) {
        if (row.tile.isLocal) {
            return localTileSpeaking.value;
        }
        const pid = row.tile.peerId;
        return pid === activeSpeakerPeerId.value || pid === serverActiveSpeakerPeerId.value;
    }
    return {
        orderedTiles,
        orderedGridRows,
        isTileRowSpeaking,
    };
}
