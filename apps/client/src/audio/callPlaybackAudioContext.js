let shared = null;
export function getSharedCallPlaybackContext() {
    if (typeof AudioContext === 'undefined') {
        throw new Error('AudioContext not supported');
    }
    if (!shared || shared.state === 'closed') {
        shared = new AudioContext({ latencyHint: 'interactive' });
    }
    return shared;
}
export async function resumeSharedCallPlaybackContext() {
    try {
        const ctx = getSharedCallPlaybackContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
    }
    catch {
        /* autoplay policy — caller may retry after gesture */
    }
}
