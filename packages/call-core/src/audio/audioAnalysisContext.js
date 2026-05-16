/**
 * Single AudioContext for analysis paths (analysers, levels). Do not route to destination.
 * Avoids extra AudioContext instances when call UI remounts.
 */
let shared = null;
export function getAudioAnalysisAudioContext() {
    if (!shared || shared.state === 'closed') {
        shared = new AudioContext();
    }
    return shared;
}
