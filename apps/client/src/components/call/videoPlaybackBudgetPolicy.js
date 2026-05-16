/**
 * Pure policy: which remote video tiles may keep `<video>` playing under a soft budget (Phase 3).
 * Does not touch WebRTC — CallPage maps this to `playbackSuppressed` on `StreamVideo`.
 */
export function rankRemoteVideoPeersForPlayback(input) {
    const set = new Set(input.remotePeerIdsWithVideo.map((id) => id.trim()).filter((id) => id.length > 0));
    const ordered = [];
    const push = (id) => {
        if (typeof id !== 'string') {
            return;
        }
        const t = id.trim();
        if (!t || !set.has(t) || ordered.includes(t)) {
            return;
        }
        ordered.push(t);
    };
    push(input.uiActiveSpeakerPeerId);
    push(input.serverActiveSpeakerPeerId);
    push(input.pinnedPeerId ?? null);
    const vis = [...set]
        .filter((id) => !ordered.includes(id) && input.viewportVisibleByPeerId.get(id) !== false)
        .sort((a, b) => a.localeCompare(b));
    ordered.push(...vis);
    const off = [...set]
        .filter((id) => !ordered.includes(id))
        .sort((a, b) => a.localeCompare(b));
    ordered.push(...off);
    return ordered;
}
export function computeAllowedRemotePlaybackPeerIds(input) {
    const ids = input.remotePeerIdsWithVideo
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    if (!input.enableVisiblePlaybackBudget || input.fullPowerUnlock === true) {
        return new Set(ids);
    }
    const cap = Math.max(1, Math.floor(input.maxActiveRemoteVideos));
    const ranked = rankRemoteVideoPeersForPlayback(input);
    return new Set(ranked.slice(0, cap));
}
