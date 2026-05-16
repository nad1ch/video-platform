import { allowCallAudioQaStorageOverrides } from './callAudioQaGate';
/**
 * Opt-in capture / publish diagnostics (`console.info` with `[call-audio-dev]`).
 * No logs unless {@link allowCallAudioQaStorageOverrides} is true **and** the storage key is `"1"`.
 * Temporary QA tooling — remove when experiments conclude.
 */
export const CALL_AUDIO_DEV_DIAGNOSTICS_STORAGE_KEY = 'streamassist:call:dev-audio-diagnostics-v1';
export function isCallAudioDevDiagnosticsEnabled() {
    if (!allowCallAudioQaStorageOverrides()) {
        return false;
    }
    if (typeof localStorage === 'undefined') {
        return false;
    }
    try {
        return localStorage.getItem(CALL_AUDIO_DEV_DIAGNOSTICS_STORAGE_KEY) === '1';
    }
    catch {
        return false;
    }
}
function cloneJsonSafe(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
    }
    catch {
        /* fall through */
    }
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return String(value);
    }
}
function readCapabilities(track) {
    try {
        if (typeof track.getCapabilities !== 'function') {
            return 'unavailable';
        }
        return track.getCapabilities();
    }
    catch {
        return 'unavailable';
    }
}
export function buildCallAudioDevMicSnapshot(track, extras) {
    if (!track || track.kind !== 'audio') {
        return {
            track: null,
            requestedAudioConstraints: extras?.requestedAudioConstraints
                ? cloneJsonSafe(extras.requestedAudioConstraints)
                : undefined,
            settings: {},
            constraints: {},
            capabilities: 'unavailable',
            noiseSuppressionIntent: extras?.noiseSuppressionIntent,
        };
    }
    const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
    const constraints = typeof track.getConstraints === 'function' ? track.getConstraints() : {};
    const caps = readCapabilities(track);
    const asBool = (v) => typeof v === 'boolean' ? v : undefined;
    return {
        track: {
            id: track.id,
            label: track.label,
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
        },
        requestedAudioConstraints: extras?.requestedAudioConstraints
            ? cloneJsonSafe(extras.requestedAudioConstraints)
            : undefined,
        settings: cloneJsonSafe(settings),
        constraints: cloneJsonSafe(constraints),
        capabilities: caps === 'unavailable' ? caps : cloneJsonSafe(caps),
        noiseSuppressionIntent: extras?.noiseSuppressionIntent,
        noiseSuppressionEffective: asBool(settings.noiseSuppression),
        autoGainControlEffective: asBool(settings.autoGainControl),
        echoCancellationEffective: asBool(settings.echoCancellation),
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
    };
}
/**
 * Logs one structured line. Gated: {@link isCallAudioDevDiagnosticsEnabled}.
 */
export function logCallAudioDevDiagnostics(phase, body) {
    if (!isCallAudioDevDiagnosticsEnabled()) {
        return;
    }
    // Dev-only, double-gated above; call-core has no shared logger dependency.
    console.info('[call-audio-dev]', phase, body);
}
