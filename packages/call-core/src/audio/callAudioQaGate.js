/**
 * Optional QA build gate for **diagnostics only** (see `callAudioDevDiagnostics.ts`).
 * Opus DTX is not gated here; production uses {@link import('./callOutboundOpusPolicy').CALL_AUDIO_OPUS_DTX_ENABLED}.
 *
 * Normal production: `VITE_ENABLE_CALL_AUDIO_QA_TOOLS` unset → {@link allowCallAudioQaStorageOverrides}
 * is false (except local `vite` dev). Diagnostics never run in production unless that env is set and storage is opted in.
 */
export function isCallAudioQaToolsViteEnabled() {
    return import.meta.env.VITE_ENABLE_CALL_AUDIO_QA_TOOLS === 'true';
}
/**
 * When false, `localStorage` QA keys must not affect runtime (default shipping behavior).
 */
export function allowCallAudioQaStorageOverrides() {
    return import.meta.env.DEV === true || isCallAudioQaToolsViteEnabled();
}
