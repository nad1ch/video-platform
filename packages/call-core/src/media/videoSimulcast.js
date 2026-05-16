import { getSimulcastEncodingsForPreset, getSingleLayerEncodingsForPreset } from './videoQualityPreset';
/**
 * Simulcast is disabled for fixed-quality calls. The constant remains for compatibility only.
 */
export const VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM = Number.POSITIVE_INFINITY;
export function shouldUseVideoSimulcastForRoom(peerCount) {
    void peerCount;
    return false;
}
export const VP8_SINGLE_LAYER_ENCODING = getSingleLayerEncodingsForPreset('auto_large_room');
/** Back-compat export; simulcast is disabled and this contains one fixed 480p layer. */
export const VP8_SIMULCAST_ENCODINGS = getSimulcastEncodingsForPreset('auto_large_room');
export function spatialLayerForGridSizeTier(tier) {
    if (tier === 'sm') {
        return 0;
    }
    if (tier === 'md') {
        return 1;
    }
    return 2;
}
