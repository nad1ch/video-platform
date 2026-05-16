/**
 * Phase 1 receiver baseline-layer policy. Pure — no Vue, no WebRTC.
 *
 * The receiver picks ONE baseline layer for all normal remote webcam
 * consumers based on its initial device profile and the active camera
 * publisher count, then optionally shifts the baseline by sustained
 * runtime pressure. Screen-share consumers ignore this baseline (they
 * are pinned to high downstream — see `assignAdaptivePreferredLayersByPeerId`).
 *
 * Why a SINGLE baseline (not per-tile / per-active-speaker):
 *   - Avoids quality flicker when speakers change (12-person Mafia changes
 *     speaker every 5–10 seconds; per-tile policy would re-PLI on every
 *     change).
 *   - Predictable: every webcam tile for that receiver looks the same.
 *   - Receiver-only: changes here only affect THIS receiver's downlink;
 *     other peers are not penalized.
 *
 * Why strong desktop starts at high even in 12-camera rooms:
 *   - Strong device CAN handle 11 × 854×480/20 fps decode.
 *   - We only step it down when sustained pressure proves otherwise.
 *
 * Why active speaker is not used in Phase 1:
 *   - The whole point of Phase 1 is to ship adaptive simulcast WITHOUT
 *     introducing speaker-driven quality changes. Phase 2 may layer that
 *     on top once the baseline path is proven safe.
 */
/**
 * Maps a baseline layer to mediasoup `setPreferredLayers({spatialLayer, temporalLayer})`.
 *
 * Spatial layer ordering matches the publisher rid order (`q,h,f` → 0,1,2).
 * Temporal layer is always 2 (full frame rate at the chosen spatial rung) —
 * Phase 1 reduces pixels, never frames.
 */
export function simulcastLayersForBaseline(layer) {
    if (layer === 'high') {
        return { spatialLayer: 2, temporalLayer: 2 };
    }
    if (layer === 'medium') {
        return { spatialLayer: 1, temporalLayer: 2 };
    }
    return { spatialLayer: 0, temporalLayer: 2 };
}
const LAYER_ORDER = ['low', 'medium', 'high'];
function clampLayerIndex(i) {
    if (i < 0)
        return 0;
    if (i > LAYER_ORDER.length - 1)
        return LAYER_ORDER.length - 1;
    return i;
}
/** Move one layer up; never above the input ceiling (defaults to 'high'). */
export function stepUpLayer(layer, ceiling = 'high') {
    const i = clampLayerIndex(LAYER_ORDER.indexOf(layer) + 1);
    const cap = LAYER_ORDER.indexOf(ceiling);
    return LAYER_ORDER[Math.min(i, cap)];
}
/** Move one layer down; never below the input floor (defaults to 'low'). */
export function stepDownLayer(layer, floor = 'low') {
    const i = clampLayerIndex(LAYER_ORDER.indexOf(layer) - 1);
    const fl = LAYER_ORDER.indexOf(floor);
    return LAYER_ORDER[Math.max(i, fl)];
}
/** True iff `a` is at or below `b` in the order low < medium < high. */
export function layerAtOrBelow(a, b) {
    return LAYER_ORDER.indexOf(a) <= LAYER_ORDER.indexOf(b);
}
/**
 * Per-profile floor (lowest layer this profile is ever pinned to) and
 * ceiling (highest layer this profile is ever allowed to use). Both bounds
 * are inclusive.
 */
export function profileFloorCeiling(profile, role) {
    // Viewer/OBS floor: the streamer's broadcast is the product. Even under
    // transient pressure we never go below medium so OBS does not record
    // 240p footage if a single Chrome GC stalls the receive pipeline.
    // Strong viewer keeps the high ceiling; weaker classes still get medium
    // floor protection.
    if (role === 'viewer') {
        if (profile === 'mobile' || profile === 'constrained') {
            return { floor: 'medium', ceiling: 'high' };
        }
        return { floor: 'medium', ceiling: 'high' };
    }
    switch (profile) {
        case 'strong':
            return { floor: 'medium', ceiling: 'high' };
        case 'default':
            return { floor: 'low', ceiling: 'high' };
        case 'constrained':
            return { floor: 'low', ceiling: 'medium' };
        case 'mobile':
            return { floor: 'low', ceiling: 'medium' };
    }
}
/**
 * Initial (room-size-driven) baseline before any pressure adjustment.
 * Returns a layer that fits the profile floor/ceiling.
 *
 * Rules:
 *   - 1–6 active cameras: high (Phase 1 small-room invariant — no change).
 *   - 7+ cameras:
 *       strong   → high
 *       default  → medium
 *       constrained → low
 *       mobile   → low
 *       viewer   → high (small) / medium (large), capped at ceiling
 */
export function resolveInitialBaselineLayer(profile, role, activeCameraPublishers) {
    const { floor, ceiling } = profileFloorCeiling(profile, role);
    // Receiver-side small-room rule (independent of the publisher simulcast
    // threshold): with ≤6 active cameras, every receiver picks 'high' as the
    // initial baseline. Reasoning is decode-load tolerance, not supply: ≤6 ×
    // 854×480/20 fps is comfortable on every modern device, so there is no
    // need to bias weaker profiles toward medium/low at this room size. From
    // 7 cameras up the per-profile mapping below kicks in.
    //
    // With the publisher threshold currently at 1, publishers in 2-6 cam
    // rooms DO emit multi-rung supply — a receiver under runtime pressure
    // can still step down through `resolveReceiverBaselineLayer` and the
    // SFU has the lower rungs ready to forward. So the 'high' default in
    // small rooms is the head-room ceiling, not a constraint.
    if (activeCameraPublishers <= 6) {
        return 'high';
    }
    if (role === 'viewer') {
        // Strong viewer keeps high; any other class drops to the lowest of (medium, ceiling).
        return profile === 'strong'
            ? ceiling
            : (layerAtOrBelow('medium', ceiling) ? 'medium' : ceiling);
    }
    switch (profile) {
        case 'strong':
            return ceiling; // 'high'
        case 'default':
            return clampLayerToBounds('medium', floor, ceiling);
        case 'constrained':
            return clampLayerToBounds('low', floor, ceiling);
        case 'mobile':
            return clampLayerToBounds('low', floor, ceiling);
    }
}
function clampLayerToBounds(layer, floor, ceiling) {
    if (layerAtOrBelow(layer, floor) && layer !== floor)
        return floor;
    if (!layerAtOrBelow(layer, ceiling))
        return ceiling;
    return layer;
}
/**
 * Resolve the FINAL baseline layer combining initial baseline (room-size)
 * with sustained pressure. Caller is responsible for hysteresis: this fn
 * just maps verdict → step count.
 *
 * - `normal`     → use initial baseline.
 * - `constrained` → step down once from initial (clamped to floor).
 * - `critical`   → step down twice (clamped to floor; usually = floor).
 *
 * Step direction is intentionally one-way at a time (caller never asks for
 * a multi-step jump from the policy directly). High → medium → low.
 */
export function resolveReceiverBaselineLayer(input) {
    const initial = resolveInitialBaselineLayer(input.profile, input.role, input.activeCameraPublishers);
    const { floor } = profileFloorCeiling(input.profile, input.role);
    if (input.pressure === 'normal') {
        return initial;
    }
    if (input.pressure === 'constrained') {
        return stepDownLayer(initial, floor);
    }
    // 'critical' — two steps below initial, clamped to floor.
    return stepDownLayer(stepDownLayer(initial, floor), floor);
}
