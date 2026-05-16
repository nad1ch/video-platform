import { shallowRef, watch } from 'vue';
import { recordMediaDebugHardResync, recordMediaDebugHardResyncSkipped, recordMediaDebugSoftResync, } from '@/utils/mediaDebugRuntime';
/**
 * Media stall recovery (shared by video and audio): a tile reports that
 * inbound media has been stuck for the per-kind threshold (`<video>.currentTime`
 * for video, `track.muted` while server says peer is sending for audio).
 *
 * Two-tier escalation, SHARED across video + audio so a peer flapping in
 * one kind does not let the other kind escape the global debounce:
 *
 * 1. Soft tier (per-minute global): re-apply the server's producer list.
 *    Same path the visibility/focus policy uses; no transport teardown, no
 *    media gap. Covers most "missed event" recovery cases.
 *
 * 2. Hard tier (per-five-minutes global, gated on persistence): tear down
 *    ALL recv consumers and re-consume from a fresh sync. Brief media gap
 *    on every tile, so reserved for confirmed persistent stalls that the
 *    soft tier did not fix. Trigger requires:
 *      a) at least one soft resync was already issued, AND
 *      b) a NEW stall arrives ≥ HARD_GRACE_MS after the last soft resync, AND
 *      c) the global hard-debounce window has expired.
 *
 * Audio + video share the same timestamps deliberately: a single bad peer
 * with both audio and video failing should not produce two hard resyncs in
 * 30s, and the cure (re-consume from server) helps both kinds at once.
 *
 * Public-stream safety gate for the hard tier: hard producer resync tears
 * down ALL recv consumers and re-consumes from a fresh `client-refresh`
 * sync. For a normal player tab, the resulting 1.5–3 s blackout-on-every-tile
 * is acceptable: the user is inside the room and the cure restores stuck
 * consumers. For OBS / `?mode=view` (Mafia or Eat First), the same teardown
 * is BROADCAST TO STREAM VIEWERS as a synchronous "all cameras → fallback
 * icons → all cameras" flicker, which is far worse than the rare stuck
 * consumer the hard tier exists to fix.
 *
 * In view mode we keep the SOFT tier (the missed-event recovery that
 * doesn't teardown anything) and SKIP the hard tier. If a stuck consumer
 * ever does appear in OBS, the operator refreshes the OBS Browser Source
 * manually — exactly one click, no public-stream blast radius.
 *
 * Behaviour preserved 1:1 from CallPage. The composable does not own any
 * media; it only reads tile peer ids to prune stale waiting entries and
 * calls back into call-core for the resync.
 */
const MEDIA_STALL_RESYNC_DEBOUNCE_MS = 60_000;
const MEDIA_STALL_HARD_DEBOUNCE_MS = 5 * 60_000;
const MEDIA_STALL_HARD_GRACE_MS = 30_000;
export function useMediaStallRecovery(deps) {
    const { tiles, isOperatingAsObsViewSource, requestForcedProducerResync, requestHardProducerResync } = deps;
    const remotePlaybackWaitingPeerIds = shallowRef(new Set());
    let lastMediaStallResyncAt = 0;
    let lastMediaStallHardResyncAt = 0;
    function onRemotePlaybackStall(payload) {
        const id = typeof payload.peerId === 'string' ? payload.peerId.trim() : '';
        if (!id) {
            return;
        }
        const next = new Set(remotePlaybackWaitingPeerIds.value);
        if (payload.stalling) {
            next.add(id);
        }
        else {
            next.delete(id);
        }
        remotePlaybackWaitingPeerIds.value = next;
    }
    function triggerMediaStallRecovery(kind, peerId) {
        const id = peerId.trim();
        if (!id)
            return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        // Hard escalation: a soft resync was issued ≥ HARD_GRACE_MS ago and a
        // tile is STILL stalling. Soft did not help. Tear down + re-consume.
        const softFiredRecently = lastMediaStallResyncAt > 0;
        const softHadGrace = now - lastMediaStallResyncAt >= MEDIA_STALL_HARD_GRACE_MS;
        const hardCooledDown = now - lastMediaStallHardResyncAt >= MEDIA_STALL_HARD_DEBOUNCE_MS;
        if (softFiredRecently && softHadGrace && hardCooledDown) {
            if (isOperatingAsObsViewSource()) {
                // OBS / view: skip the hard escalation; record + warn so post-incident
                // analysis can see the policy fired the safety gate, and so support
                // can prompt the operator to refresh the OBS source if symptoms persist.
                // We deliberately do NOT bump the soft timestamp here — the next stall
                // can still use the soft tier at its natural 60-s cadence.
                recordMediaDebugHardResyncSkipped(kind);
                console.warn('[stall] hard producer resync skipped in OBS/view; refresh OBS Browser Source if needed', { peerId: id, kind });
                return;
            }
            lastMediaStallHardResyncAt = now;
            // Reset the soft timestamp so any further stall in the next 60 s also
            // triggers soft (we just consumed our hard window for the next 5 min).
            lastMediaStallResyncAt = now;
            if (import.meta.env.DEV) {
                console.warn(`[stall] ${kind} stall persists — escalating to hard producer resync`, {
                    peerId: id,
                });
            }
            try {
                requestHardProducerResync();
                recordMediaDebugHardResync(kind);
            }
            catch (err) {
                console.warn('[stall] requestHardProducerResync failed', err);
            }
            return;
        }
        if (now - lastMediaStallResyncAt < MEDIA_STALL_RESYNC_DEBOUNCE_MS) {
            if (import.meta.env.DEV) {
                console.log(`[stall] ${kind} stall ignored (debounced)`, { peerId: id });
            }
            return;
        }
        lastMediaStallResyncAt = now;
        if (import.meta.env.DEV) {
            console.warn(`[stall] ${kind} stall — requesting soft producer resync`, { peerId: id });
        }
        try {
            requestForcedProducerResync();
            recordMediaDebugSoftResync(kind);
        }
        catch (err) {
            console.warn('[stall] requestForcedProducerResync failed', err);
        }
    }
    function onTileVideoStall(payload) {
        triggerMediaStallRecovery('video', typeof payload.peerId === 'string' ? payload.peerId : '');
    }
    function onTileAudioStall(payload) {
        triggerMediaStallRecovery('audio', typeof payload.peerId === 'string' ? payload.peerId : '');
    }
    // Prune `remotePlaybackWaitingPeerIds` when a previously-stalling remote peer
    // disappears (peer-left, role flip to local, etc). The watcher only fires
    // when the stable peer/local-flag join string actually changes; otherwise the
    // rest of CallPage's tile reactivity is untouched.
    watch(() => tiles.value.map((t) => `${t.peerId}:${t.isLocal ? 'L' : 'R'}`).join('|'), () => {
        const remoteIds = new Set(tiles.value.filter((t) => !t.isLocal).map((t) => t.peerId));
        const stale = [...remotePlaybackWaitingPeerIds.value].some((id) => !remoteIds.has(id));
        if (!stale) {
            return;
        }
        remotePlaybackWaitingPeerIds.value = new Set([...remotePlaybackWaitingPeerIds.value].filter((id) => remoteIds.has(id)));
    }, { flush: 'post' });
    return {
        remotePlaybackWaitingPeerIds,
        onRemotePlaybackStall,
        onTileVideoStall,
        onTileAudioStall,
    };
}
