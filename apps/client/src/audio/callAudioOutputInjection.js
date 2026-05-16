import { getSharedCallPlaybackContext } from '@/audio/callPlaybackAudioContext';
/** Injected `deviceId` for HTMLAudioElement `setSinkId` (empty string = browser default). */
export const CALL_AUDIO_OUTPUT_DEVICE_ID_KEY = Symbol('CALL_AUDIO_OUTPUT_DEVICE_ID_KEY');
export async function applyCallAudioOutputSinkToStreamAudios(deviceId) {
    const id = deviceId.trim();
    if (typeof document === 'undefined' || id.length < 1) {
        return;
    }
    try {
        const ctx = getSharedCallPlaybackContext();
        const setCtx = ctx.setSinkId;
        if (typeof setCtx === 'function') {
            await setCtx.call(ctx, id);
        }
    }
    catch {
        /* ignore unsupported / invalid sink */
    }
    const nodes = document.querySelectorAll('audio.stream-audio');
    for (const node of nodes) {
        const el = node;
        if (typeof el.setSinkId !== 'function') {
            continue;
        }
        try {
            await el.setSinkId(id);
        }
        catch {
            /* ignore unsupported / invalid sink */
        }
    }
}
