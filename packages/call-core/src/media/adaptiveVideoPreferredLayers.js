/**
 * Phase 1 receiver-driven layer assignment.
 *
 * For each remote video peer, picks the simulcast layers the receiver wants
 * the SFU to forward. The output is consumed by `flushPreferredLayersToServer`
 * which sends one `set-consumer-preferred-layers` per video consumer.
 *
 * Phase 1 rules:
 *   - All NORMAL webcam peers get the same `baselineLayer` (no per-tile
 *     ranking, no active-speaker high). This is the whole point of "single
 *     baseline per receiver" — see receiverBaselineLayerPolicy.ts.
 *   - Screen-share peers get `'high'` regardless of baseline (text must stay
 *     readable; transient pressure should not blur a slide deck).
 *   - Off-screen tiles do NOT get a different layer here — the receive-side
 *     `set-consumer-paused` flow handles offscreen pause separately. This
 *     function only decides "what does the SFU forward when it forwards".
 *
 * Backward compat: pre-Phase-1 callers passed only `videoPeerIds` +
 * speaker/visibility refs and got an all-zero map (the historic stub).
 * That signature still works — when `baselineLayer` is omitted we fall
 * back to spatialLayer 0, which is what Phase 0 received from the stub.
 * Phase 1 callers pass `baselineLayer` and `screenShareSourceByPeerId`.
 */
import { RECEIVE_DEVICE_DEFAULT_MAX_HIGH, RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM, } from './receiveDeviceProfile';
import { simulcastLayersForBaseline, } from './receiverBaselineLayerPolicy';
export const MAX_HIGH_STREAMS = RECEIVE_DEVICE_DEFAULT_MAX_HIGH;
export const MAX_MEDIUM_STREAMS = RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM;
const ZERO_LAYERS = { spatialLayer: 0, temporalLayer: 0 };
const HIGH_LAYERS = { spatialLayer: 2, temporalLayer: 2 };
export function assignAdaptivePreferredLayersByPeerId(input) {
    const out = new Map();
    // De-dup + stable order (matches existing test expectations).
    const ids = [...new Set(input.videoPeerIds)].sort((a, b) => a.localeCompare(b));
    // Legacy callers: no baselineLayer → return all-zero map (preserves the
    // pre-Phase-1 behavior for callers that have not migrated).
    if (input.baselineLayer === undefined) {
        for (const id of ids) {
            out.set(id, ZERO_LAYERS);
        }
        return out;
    }
    const baseLayers = simulcastLayersForBaseline(input.baselineLayer);
    for (const id of ids) {
        const source = input.screenShareSourceByPeerId?.get(id);
        if (source === 'screen') {
            // Screen share consumer pinned to high — readable text matters more
            // than the receiver's baseline pressure decision. If the publisher
            // emits only a single encoding (small room or screen-share publisher),
            // mediasoup forwards that single encoding regardless of preferredLayers,
            // so this is harmless.
            out.set(id, HIGH_LAYERS);
            continue;
        }
        out.set(id, baseLayers);
    }
    return out;
}
