/**
 * Outbound Opus DTX (`mediasoup` `codecOptions.opusDtx`) for the call audio producer.
 *
 * Product default is **off** to reduce rhythmic silence artifacts on open mics.
 * `opusDtx` is fixed when the audio Producer is created — reload/rejoin after deploy.
 * `replaceTrack` does not change this flag.
 */

/** Product default: outbound mic Opus DTX disabled. */
export const CALL_AUDIO_OPUS_DTX_ENABLED = false as const

/**
 * Resolves `codecOptions.opusDtx` for `transport.produce` on the microphone track.
 * Always returns {@link CALL_AUDIO_OPUS_DTX_ENABLED} (no env or QA storage).
 */
export function resolveCallOutboundOpusDtxForProduce(): boolean {
  return CALL_AUDIO_OPUS_DTX_ENABLED
}
