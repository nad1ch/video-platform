import { computed, shallowRef } from 'vue';
import { buildCallParticipantMap, buildDisplayNameUiMap, normalizeDisplayName, resolvePeerDisplayNameForUi, } from 'call-core';
import { loadCallTileLocalDisplayOverrides, saveCallTileLocalDisplayOverrides, } from '@/utils/callTileLocalDisplayNames';
export function useCallDisplayNames(options) {
    const { tiles, remoteDisplayNames, selfPeerId, selfDisplayName, policy } = options;
    const participantsByPeerId = computed(() => buildCallParticipantMap(tiles.value, { ...remoteDisplayNames.value }, selfPeerId.value));
    const displayNameUiByPeerId = computed(() => buildDisplayNameUiMap(participantsByPeerId.value, {
        selfPeerId: selfPeerId.value,
        selfDisplayName: selfDisplayName.value,
    }));
    const localTileDisplayOverrides = shallowRef(loadCallTileLocalDisplayOverrides());
    function canEditTileDisplayName(peerId) {
        const id = typeof peerId === 'string' ? peerId.trim() : '';
        if (!id) {
            return false;
        }
        const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
        const isLocalTile = tiles.value.some((x) => x.peerId === id && x.isLocal);
        if (policy.isRouteActive.value) {
            return policy.isHost.value || (selfId.length > 0 && id === selfId) || isLocalTile;
        }
        return (selfId.length > 0 && id === selfId) || isLocalTile;
    }
    function onCommitLocalTileDisplayName(payload) {
        const id = typeof payload.peerId === 'string' ? payload.peerId.trim() : '';
        if (!id) {
            return;
        }
        if (!canEditTileDisplayName(id)) {
            return;
        }
        const t = payload.name != null ? normalizeDisplayName(payload.name).slice(0, 64) : '';
        if (policy.isRouteActive.value) {
            policy.sendPlayerNameUpdate(id, t);
            // Optimistic UI update: server will broadcast the same value (or clear) back.
            // Without this, the label snaps back to the old value until the WS roundtrip completes.
            const next = { ...policy.nicknameOverrides.value };
            if (!t) {
                delete next[id];
            }
            else {
                next[id] = t;
            }
            policy.nicknameOverrides.value = next;
            // Server-authoritative nickname overrides; avoid a stale local override
            // shadowing the optimistic / server nickname.
            if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, id)) {
                const cleaned = { ...localTileDisplayOverrides.value };
                delete cleaned[id];
                localTileDisplayOverrides.value = cleaned;
                saveCallTileLocalDisplayOverrides(cleaned);
            }
            return;
        }
        const next = { ...localTileDisplayOverrides.value };
        if (!t) {
            delete next[id];
        }
        else {
            next[id] = t;
        }
        localTileDisplayOverrides.value = next;
        saveCallTileLocalDisplayOverrides(next);
    }
    function peerDisplayName(peerId) {
        const o = localTileDisplayOverrides.value[peerId];
        if (typeof o === 'string' && normalizeDisplayName(o)) {
            return normalizeDisplayName(o).slice(0, 64);
        }
        if (policy.isRouteActive.value) {
            const n = policy.nicknameOverrides.value[peerId];
            if (typeof n === 'string' && normalizeDisplayName(n)) {
                return normalizeDisplayName(n).slice(0, 64);
            }
        }
        const participants = participantsByPeerId.value;
        const opts = {
            selfPeerId: selfPeerId.value,
            selfDisplayName: selfDisplayName.value,
        };
        const hit = displayNameUiByPeerId.value.get(peerId);
        if (hit !== undefined) {
            return hit;
        }
        return resolvePeerDisplayNameForUi(peerId, participants, opts);
    }
    function peerAvatarFallbackName(peerId) {
        const participants = participantsByPeerId.value;
        const opts = {
            selfPeerId: selfPeerId.value,
            selfDisplayName: selfDisplayName.value,
        };
        const hit = displayNameUiByPeerId.value.get(peerId);
        if (hit !== undefined) {
            return hit;
        }
        return resolvePeerDisplayNameForUi(peerId, participants, opts);
    }
    return {
        participantsByPeerId,
        displayNameUiByPeerId,
        localTileDisplayOverrides,
        canEditTileDisplayName,
        onCommitLocalTileDisplayName,
        peerDisplayName,
        peerAvatarFallbackName,
    };
}
