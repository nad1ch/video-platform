import { allowCallAudioQaStorageOverrides } from './callAudioQaGate'

/**
 * Outbound Opus DTX (`mediasoup` `codecOptions.opusDtx`) for the call audio producer.
 *
 * Product default stays enabled. `opusDtx` is fixed when the audio Producer is created;
 * toggling the localStorage override requires a **new** audio producer (leave room and rejoin, or
 * otherwise recreate publish) — `replaceTrack` does not renegotiate this flag.
 */

/** Product default: Opus DTX on outbound call audio (unchanged shipping behavior). */
export const CALL_AUDIO_OPUS_DTX_ENABLED = true as const

/**
 * localStorage key: `"1"` → next mic `produce` uses `opusDtx: false`.
 * Honored only when {@link allowCallAudioQaStorageOverrides} is true (local DEV or QA Vite build).
 */
export const CALL_AUDIO_DEV_OPUS_DTX_OFF_STORAGE_KEY = 'streamassist:call:dev-opus-dtx-off-v1'

/**
 * Resolves `codecOptions.opusDtx` for `transport.produce` on the microphone track.
 * Default shipping: always `CALL_AUDIO_OPUS_DTX_ENABLED`. QA/local: may return `false` when storage is set.
 */
export function resolveCallOutboundOpusDtxForProduce(): boolean {
  if (!allowCallAudioQaStorageOverrides()) {
    return CALL_AUDIO_OPUS_DTX_ENABLED
  }
  try {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(CALL_AUDIO_DEV_OPUS_DTX_OFF_STORAGE_KEY) === '1'
    ) {
      return false
    }
  } catch {
    /* private mode / blocked storage */
  }
  return CALL_AUDIO_OPUS_DTX_ENABLED
}
