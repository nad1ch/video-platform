import { getCallVideoConstraints } from './videoQualityPreset';
/**
 * Voice/chat defaults (widely supported). We intentionally omit `sampleRate`, `sampleSize`, and
 * `channelCount` so each browser + device can pick stable processing; forcing those can break
 * niche headsets or add unnecessary resampling.
 */
export const DEFAULT_CALL_AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};
export const DEFAULT_CALL_VIDEO_CONSTRAINTS = getCallVideoConstraints('auto_large_room');
export function getVideoConstraintsForPreset(preset) {
    return getCallVideoConstraints(preset);
}
export function applyWebcamContentHint(track) {
    if (track.kind !== 'video') {
        return;
    }
    try {
        if ('contentHint' in track) {
            ;
            track.contentHint = 'motion';
        }
    }
    catch {
        /* ignore */
    }
}
