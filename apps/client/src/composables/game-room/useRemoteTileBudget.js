import { computed, onBeforeUnmount, onUnmounted, shallowRef, watch, } from 'vue';
/**
 * Block 24 — remote-tile-budget composable extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`. Both routes carried this code
 * byte-equivalently.
 *
 * Scope: tile-level playback budget + viewport hysteresis. Owns:
 *   - the per-tile viewport visible map (`callTileViewportVisibleByPeer`)
 *   - the server-side `setPeerVisible` debounce (resume immediate, pause
 *     after a 500 ms hysteresis window so quick scroll-bys don't flap)
 *   - the per-peer playback-suppression state
 *     (`remoteVideoPlaybackSuppressed`)
 *   - the `suppressionWatcherKey` + reconciliation watcher
 *   - the page-facing `videoPlaybackSuppressedForPeer`,
 *     `remoteVideoTargetPlaybackFpsForPeer`, and
 *     `onCallTileViewportForLayers` (used as the
 *     `:on-call-tile-viewport` prop on `<ParticipantTile>`)
 *
 * Out of scope (deliberately kept in the page):
 *   - the tile-set-change watcher mixes budget prunes with non-budget
 *     prunes (display-name overrides, remote-listen volume/mute maps).
 *     The composable exposes `cleanupForRemovedPeers(currentPeerIds)`
 *     which prunes ONLY its internal maps; the page's own watcher continues
 *     to handle its non-budget prunes alongside the call to that helper.
 *
 * The composable is store-free and protocol-free. `setPeerVisible` is the
 * `useCallOrchestrator` handle the page already destructures; everything
 * else is plain refs / computeds.
 *
 * No reactive Maps: the per-peer timer maps (`setPeerVisibleHideTimerByPeer`,
 * `remoteVideoSuppressDelayTimerByPeer`, `remoteVideoSuppressPendingKind`,
 * `lastSentPeerVisibleByPeer`) stay raw `Map`s exactly as the pages had
 * them — wrapping them in `ref`/`reactive` would change reconciliation
 * timing because every `set`/`delete` would schedule a Vue effect run.
 */
const SET_PEER_VISIBLE_HIDE_DEBOUNCE_MS = 500;
export function useRemoteTileBudget(options) {
    const { tiles, selfPeerId, receiveDeviceProfile, setPeerVisible, activeSpeakerPeerId, serverActiveSpeakerPeerId, isFullPowerMode, isCallAppRoute, log, } = options;
    const callTileViewportVisibleByPeer = shallowRef(new Map());
    /**
     * Per-tile server-side video pause hysteresis.
     * Resume on visible is immediate; pause on hidden waits a short window so
     * a quick scroll-by does not flap `setPeerVisible` (which sends WS messages
     * and triggers keyframe requests on resume).
     */
    const setPeerVisibleHideTimerByPeer = new Map();
    const lastSentPeerVisibleByPeer = new Map();
    function cancelSetPeerVisibleHideTimer(peerId) {
        const t = setPeerVisibleHideTimerByPeer.get(peerId);
        if (t != null) {
            clearTimeout(t);
            setPeerVisibleHideTimerByPeer.delete(peerId);
        }
    }
    function applyPeerVisible(peerId, visible) {
        if (lastSentPeerVisibleByPeer.get(peerId) === visible) {
            return;
        }
        lastSentPeerVisibleByPeer.set(peerId, visible);
        setPeerVisible(peerId, visible);
    }
    function scheduleSetPeerVisible(peerId, visible) {
        if (visible) {
            cancelSetPeerVisibleHideTimer(peerId);
            applyPeerVisible(peerId, true);
            return;
        }
        if (setPeerVisibleHideTimerByPeer.has(peerId)) {
            return;
        }
        const t = setTimeout(() => {
            setPeerVisibleHideTimerByPeer.delete(peerId);
            applyPeerVisible(peerId, false);
        }, SET_PEER_VISIBLE_HIDE_DEBOUNCE_MS);
        setPeerVisibleHideTimerByPeer.set(peerId, t);
    }
    const remoteVideoSuppressDelayTimerByPeer = new Map();
    const remoteVideoSuppressPendingKind = new Map();
    const remoteVideoPlaybackSuppressed = shallowRef(new Map());
    function bumpRemotePlaybackSuppressed(peerId, suppressed, reason) {
        const prev = remoteVideoPlaybackSuppressed.value.get(peerId) === true;
        if (prev === suppressed) {
            return;
        }
        const next = new Map(remoteVideoPlaybackSuppressed.value);
        if (suppressed) {
            next.set(peerId, true);
        }
        else {
            next.delete(peerId);
        }
        remoteVideoPlaybackSuppressed.value = next;
        if (import.meta.env.DEV) {
            const prof = receiveDeviceProfile.value;
            log.debug('[call-qa:playback-suppress]', {
                peerId,
                suppressed,
                reason,
                profile: prof.profile,
                maxActiveRemoteVideos: prof.maxActiveRemoteVideos,
                allowRenderSuppression: prof.allowRenderSuppression,
            });
        }
    }
    function clearRemoteVideoSuppressTimer(peerId) {
        const t = remoteVideoSuppressDelayTimerByPeer.get(peerId);
        if (t != null) {
            clearTimeout(t);
            remoteVideoSuppressDelayTimerByPeer.delete(peerId);
        }
        remoteVideoSuppressPendingKind.delete(peerId);
    }
    function reconcileRemoteVideoPlaybackSuppression() {
        for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
            clearRemoteVideoSuppressTimer(pid);
        }
        for (const pid of [...remoteVideoPlaybackSuppressed.value.keys()]) {
            bumpRemotePlaybackSuppressed(pid, false, 'fixed-quality');
        }
    }
    /**
     * Stable scalar key for the suppression-reconcile watcher. Returning a
     * primitive string lets Vue compare with `Object.is` and skip the callback
     * when nothing visible-to-this-watcher actually changed; the previous object
     * source returned a fresh object on every reactivity flush which forced the
     * callback to fire even when the underlying values were equal.
     *
     * `viewport` is a `Map<string, boolean>`; we encode only the visible tile
     * ids into the key so that toggling an unrelated peer's `false` to `false`
     * does not refire the watcher.
     */
    const suppressionWatcherKey = computed(() => {
        const visiblePeers = [];
        for (const [pid, vis] of callTileViewportVisibleByPeer.value) {
            if (vis) {
                visiblePeers.push(pid);
            }
        }
        visiblePeers.sort();
        const tilesKey = tiles.value.map((t) => `${t.peerId}:${t.isLocal ? 'L' : 'R'}`).join('|');
        return [
            receiveDeviceProfile.value.allowRenderSuppression ? '1' : '0',
            isFullPowerMode.value ? '1' : '0',
            tilesKey,
            visiblePeers.join(','),
            activeSpeakerPeerId.value ?? '',
            serverActiveSpeakerPeerId.value ?? '',
        ].join('::');
    });
    watch(suppressionWatcherKey, () => {
        reconcileRemoteVideoPlaybackSuppression();
    }, { flush: 'post' });
    function videoPlaybackSuppressedForPeer(peerId) {
        return remoteVideoPlaybackSuppressed.value.get(peerId) === true;
    }
    /**
     * Phase 3.5: presentation FPS cap is a last resort.
     * Simulcast slots handle normal load; RVFC/pulse throttling only kicks in for bad, non-priority tiles.
     */
    function remoteVideoTargetPlaybackFpsForPeer(peerId) {
        void peerId;
        return undefined;
    }
    function onCallTileViewportForLayers(peerId, visible) {
        if (!isCallAppRoute.value) {
            return;
        }
        const id = typeof peerId === 'string' ? peerId.trim() : '';
        if (!id) {
            return;
        }
        const prev = callTileViewportVisibleByPeer.value.get(id);
        if (prev === visible) {
            return;
        }
        const nextMap = new Map(callTileViewportVisibleByPeer.value);
        nextMap.set(id, visible);
        callTileViewportVisibleByPeer.value = nextMap;
        // Server-side video consumer pause for tiles that scroll out / are hidden.
        // Audio consumers are never paused (call-core invariant); only the video
        // consumer for this peer is affected. Hysteresis lives in scheduler.
        if (id !== selfPeerId.value) {
            scheduleSetPeerVisible(id, visible);
        }
        if (import.meta.env.DEV) {
            log.info('[call-qa:viewport] remote tile IO', {
                peerId: id,
                visible,
                isLocalSelf: id === selfPeerId.value,
            });
        }
    }
    function cleanupForRemovedPeers(currentPeerIds) {
        const vm = new Map(callTileViewportVisibleByPeer.value);
        let vmChanged = false;
        for (const id of vm.keys()) {
            if (!currentPeerIds.has(id)) {
                vm.delete(id);
                vmChanged = true;
            }
        }
        if (vmChanged) {
            callTileViewportVisibleByPeer.value = vm;
        }
        // `remoteVideoSuppressDelayTimerByPeer` had no per-peer-set prune; only
        // the unmount path cleared it. Across long sessions with player reloads,
        // it accumulated dead-peerId timer entries (each holding a setTimeout
        // handle + a tag in `remoteVideoSuppressPendingKind`). Mirror the
        // existing `setPeerVisibleHideTimerByPeer` prune here so dead peerIds
        // are dropped within one tile-set tick.
        for (const id of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
            if (!currentPeerIds.has(id)) {
                clearRemoteVideoSuppressTimer(id);
            }
        }
        for (const id of [...setPeerVisibleHideTimerByPeer.keys()]) {
            if (!currentPeerIds.has(id)) {
                cancelSetPeerVisibleHideTimer(id);
                lastSentPeerVisibleByPeer.delete(id);
            }
        }
    }
    // Mirrors the original split between the two pages' lifecycle hooks:
    //   - `onBeforeUnmount`: clear suppress-delay timers and reset the
    //     suppressed map (the page used to do this in the same hook that
    //     reset full-power + `remotePlaybackWaitingPeerIds`).
    //   - `onUnmounted`: cancel hide-debounce timers and clear the
    //     last-sent map (the page used to do this alongside the
    //     `document.removeEventListener('pointerdown', ...)` call).
    onBeforeUnmount(() => {
        for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
            clearRemoteVideoSuppressTimer(pid);
        }
        remoteVideoPlaybackSuppressed.value = new Map();
    });
    onUnmounted(() => {
        for (const id of [...setPeerVisibleHideTimerByPeer.keys()]) {
            cancelSetPeerVisibleHideTimer(id);
        }
        lastSentPeerVisibleByPeer.clear();
    });
    return {
        callTileViewportVisibleByPeer,
        remoteVideoPlaybackSuppressed,
        videoPlaybackSuppressedForPeer,
        remoteVideoTargetPlaybackFpsForPeer,
        onCallTileViewportForLayers,
        cleanupForRemovedPeers,
    };
}
