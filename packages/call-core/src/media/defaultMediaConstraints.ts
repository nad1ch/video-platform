import type { VideoQualityPreset } from './videoQualityPreset'
import { getCallVideoConstraints } from './videoQualityPreset'

export const DEFAULT_CALL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

/** @deprecated Prefer `getCallVideoConstraints(preset)` — kept as balanced alias. */
export const DEFAULT_CALL_VIDEO_CONSTRAINTS: MediaTrackConstraints = getCallVideoConstraints('balanced')

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
