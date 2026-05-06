/**
 * Temporary QA build gate for call audio experiments (Opus DTX override, diagnostics).
 * Remove this module when experiments are finished and product chooses final behavior.
 *
 * Normal production: `VITE_ENABLE_CALL_AUDIO_QA_TOOLS` is unset → {@link allowCallAudioQaStorageOverrides}
 * is false (except local `vite` dev where `import.meta.env.DEV` is true).
 *
 * Preview / prod-like QA: set `VITE_ENABLE_CALL_AUDIO_QA_TOOLS=true` at **build** time, then use
 * `localStorage` keys documented on `CALL_AUDIO_DEV_OPUS_DTX_OFF_STORAGE_KEY` and
 * `CALL_AUDIO_DEV_DIAGNOSTICS_STORAGE_KEY`.
 */

export function isCallAudioQaToolsViteEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_CALL_AUDIO_QA_TOOLS === 'true'
}

/**
 * When false, `localStorage` QA keys must not affect runtime (default shipping behavior).
 */
export function allowCallAudioQaStorageOverrides(): boolean {
  return import.meta.env.DEV === true || isCallAudioQaToolsViteEnabled()
}
