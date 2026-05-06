import { allowCallAudioQaStorageOverrides } from './callAudioQaGate'

/**
 * Outbound Opus DTX (`mediasoup` `codecOptions.opusDtx`) for the call audio producer.
 *
 * TEMPORARY (production validation): default is **off** to test rhythmic silence artifacts
 * (“train on rails”). Revert or replace with a proper audio mode after results.
 * `opusDtx` is fixed when the audio Producer is created — reload/rejoin after deploy.
 * Optional QA localStorage override only applies when {@link allowCallAudioQaStorageOverrides};
 * `replaceTrack` does not renegotiate this flag.
 */

/** Product default for outbound mic Opus DTX (`false` while validating silence artifacts). */
export const CALL_AUDIO_OPUS_DTX_ENABLED = false as const

/**
 * localStorage key: `"1"` → next mic `produce` uses `opusDtx: false`.
 * Honored only when {@link allowCallAudioQaStorageOverrides} is true (local DEV or QA Vite build).
 */
export const CALL_AUDIO_DEV_OPUS_DTX_OFF_STORAGE_KEY = 'streamassist:call:dev-opus-dtx-off-v1'

/**
 * Resolves `codecOptions.opusDtx` for `transport.produce` on the microphone track.
 * Default: `CALL_AUDIO_OPUS_DTX_ENABLED`. QA/local storage may force `false` when allowed.
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
