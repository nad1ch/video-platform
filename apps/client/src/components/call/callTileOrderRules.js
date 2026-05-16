/**
 * Pure tile-order rules shared by the call grid (Mafia + Eat First).
 *
 * Both games place the host's tile last, but they pick the host id slightly
 * differently:
 *   - Eat First: only ever uses an explicit host (server-driven `hostPeerId`).
 *   - Mafia: uses the explicit `mafiaHostPeerId` once available, otherwise
 *     falls back to "the last entry of the previous numbering order" so the
 *     grid does not snap when `mafia:host-updated` finally arrives. This
 *     fallback is critical for the seat-numbering pre-claim: if we picked
 *     no host, the unclaimed last peer would become seat 1, then re-snap to
 *     "host (no number)" the moment claim arrives.
 *
 * Behaviour preserved 1:1 from the original inline forms in CallPage.
 * Pure — no Vue, no store. Safe to test in isolation.
 */
/**
 * Pick the host peer to pin at the end of the grid.
 *
 * @param explicitHostId  The server-authoritative host peerId, or empty string
 *                        when not yet known (e.g. before `host-updated`).
 * @param fallbackOrder   The previous display ordering. Last entry is treated
 *                        as the implicit host when no explicit id is set.
 *                        Pass an empty array to disable fallback (Eat First).
 * @returns The peerId to pin last, or '' when neither path resolves a host.
 */
export function resolveHostPeerIdForGrid(explicitHostId, fallbackOrder) {
    if (explicitHostId.length > 0) {
        return explicitHostId;
    }
    if (fallbackOrder.length > 0) {
        return fallbackOrder[fallbackOrder.length - 1] ?? '';
    }
    return '';
}
/**
 * Sort peerIds alphabetically and pin the host peer (if present) to the end.
 *
 * Used by the `tiles` watcher to compute a *new* tileOrder for game routes
 * where the seating order is alphabetical-and-host-last (rather than
 * preserve-previous-order which is the generic /app/call behaviour).
 *
 * @param peerIds      The current set of tile peerIds (any order).
 * @param hostPeerId   The peerId to pin last; pass '' to skip pinning.
 * @returns A new array; never mutates the input.
 */
export function sortPeerIdsHostLast(peerIds, hostPeerId) {
    const sorted = [...peerIds].sort((a, b) => a.localeCompare(b));
    if (!hostPeerId || !sorted.includes(hostPeerId)) {
        return sorted;
    }
    return [...sorted.filter((id) => id !== hostPeerId), hostPeerId];
}
