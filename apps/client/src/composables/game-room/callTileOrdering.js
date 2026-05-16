/**
 * Block 26 — pure tile-ordering helpers extracted from the two
 * `orderedTiles` computeds in `CallPage.vue` and
 * `GameTemplateCallPage.vue`. The page-side branches were:
 *
 *   - Mafia / Game Template host-last branch: build an order index from
 *     the store-provided display order, pin the host at the end, then
 *     fold any tiles not in that order in (with the host last) and sort
 *     the live tile list.
 *   - EatFirst slot branch: build an order index from the slot list
 *     (`eatFirstShell.playerOrder` mapped via `eatFirstSlotByPeer`), pin
 *     the host at the end. The "extras + host last" tail is identical
 *     to the host-last branch.
 *   - Fallback branch: `tileOrder` as the primary index, with the
 *     pinned-peer pushed first whenever spotlight desktop is active.
 *
 * Two helpers cover all three:
 *
 *   - `buildHostLastOrderedTiles` — used by the Mafia / Game Template
 *     and EatFirst branches. The caller supplies the `baseOrder` and
 *     the resolved `hostPeerIdForGrid`; this helper handles the
 *     `extras` fold and the final stable sort.
 *   - `buildFallbackOrderedTiles` — used by the fallback branch.
 *     Spotlight-pinned peer comes first whenever `spotlightActive` is
 *     true and `pinnedPeerId` is non-null.
 *
 * Pure: no Vue refs, no stores, no protocol imports. Safe to test in
 * isolation.
 */
/**
 * Sort `tiles` into Mafia / Game-Template / EatFirst grid order:
 *
 *   1. Tiles whose `peerId` is in `baseOrder` come first, in that
 *      order. Empty / non-string peer ids in `baseOrder` are skipped.
 *   2. Tiles **not** in `baseOrder` come next ("extras"). Within the
 *      extras tail, the host (if any) goes last so the grid host slot
 *      remains stable even when claim/join timing reorders the
 *      underlying tile list.
 *   3. Same `orderIndex` → fallback to `peerId.localeCompare` so the
 *      sort is deterministic.
 *
 * `hostPeerIdForGrid` is the already-resolved grid host (typically from
 * `resolveHostPeerIdForGrid` upstream); pass an empty string to disable
 * the host-last extras carve-out.
 */
export function buildHostLastOrderedTiles(tiles, baseOrder, hostPeerIdForGrid) {
    const orderIndex = new Map();
    let cursor = 0;
    for (const peerId of baseOrder) {
        if (typeof peerId !== 'string' || peerId.length < 1)
            continue;
        if (orderIndex.has(peerId))
            continue;
        orderIndex.set(peerId, cursor);
        cursor += 1;
    }
    const extras = tiles.filter((t) => !orderIndex.has(t.peerId));
    const extrasOrdered = hostPeerIdForGrid.length > 0
        ? [
            ...extras.filter((t) => t.peerId !== hostPeerIdForGrid),
            ...extras.filter((t) => t.peerId === hostPeerIdForGrid),
        ]
        : extras.slice();
    for (const tile of extrasOrdered) {
        orderIndex.set(tile.peerId, cursor);
        cursor += 1;
    }
    return [...tiles].sort((a, b) => {
        const ai = orderIndex.get(a.peerId) ?? Number.MAX_SAFE_INTEGER;
        const bi = orderIndex.get(b.peerId) ?? Number.MAX_SAFE_INTEGER;
        if (ai !== bi)
            return ai - bi;
        return a.peerId.localeCompare(b.peerId);
    });
}
/**
 * Sort `tiles` into fallback / `/call` grid order:
 *
 *   - `tileOrder` is the primary index for known peer ids.
 *   - When the spotlight layout is active on desktop and a peer is
 *     pinned, that peer is forced to the front of the sort.
 *   - Tiles with a `tileOrder` index come before tiles without one.
 *   - Same index ties → `peerId.localeCompare`.
 *
 * Matches the inline form the pages used 1:1.
 */
export function buildFallbackOrderedTiles(tiles, tileOrder, pinnedPeerId, spotlightActive) {
    const orderIndex = new Map(tileOrder.map((peerId, index) => [peerId, index]));
    return [...tiles].sort((a, b) => {
        if (spotlightActive && pinnedPeerId != null) {
            if (a.peerId === pinnedPeerId)
                return -1;
            if (b.peerId === pinnedPeerId)
                return 1;
        }
        const ai = orderIndex.get(a.peerId);
        const bi = orderIndex.get(b.peerId);
        if (ai != null && bi != null && ai !== bi)
            return ai - bi;
        if (ai != null && bi == null)
            return -1;
        if (ai == null && bi != null)
            return 1;
        return a.peerId.localeCompare(b.peerId);
    });
}
