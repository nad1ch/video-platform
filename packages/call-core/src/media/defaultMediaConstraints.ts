import type { VideoQualityPreset } from './videoQualityPreset'
import { getCallVideoConstraints } from './videoQualityPreset'

/**
 * Voice/chat defaults (widely supported). We intentionally omit `sampleRate`, `sampleSize`, and
 * `channelCount` so each browser + device can pick stable processing; forcing those can break
 * niche headsets or add unnecessary resampling.
 */
export const DEFAULT_CALL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

/** @deprecated Prefer `getCallVideoConstraints(tier)` — implicit multi-user auto profile. */
export const DEFAULT_CALL_VIDEO_CONSTRAINTS: MediaTrackConstraints = getCallVideoConstraints('auto_large_room')

export function getVideoConstraintsForPreset(preset: VideoQualityPreset): MediaTrackConstraints {
  return getCallVideoConstraints(preset)
}

/** Hint to the encoder pipeline (motion vs detail); safe no-op if unsupported. */
export function applyWebcamContentHint(track: MediaStreamTrack): void {
  if (track.kind !== 'video') {
    return
  }
  try {
    if ('contentHint' in track) {
      ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'motion'
    }
  } catch {
    /* ignore */
  }
}
