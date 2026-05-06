/**
 * Sender-side browser capture for the outgoing call microphone: always applies
 * `echoCancellation`, `noiseSuppression`, and `autoGainControl` on constraints and
 * on the live track after `getUserMedia` / mic device swap (`applyConstraints`).
 * No AudioWorklet / WASM — constraints only.
 *
 * Capture no longer reads a persisted toggle; {@link loadCallNoiseSuppressionPreference} /
 * {@link saveCallNoiseSuppressionPreference} remain as legacy no-ops for the same storage key
 * (writes are harmless; reads are unused by call-core).
 */

/** Legacy storage key (capture ignores reads for defaults). */
const STORAGE_KEY = 'streamassist:call:light-noise-suppression-v1'

/**
 * Legacy read — not used for capture constraints anymore.
 */
export function loadCallNoiseSuppressionPreference(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return true
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
  }
}

/**
 * Legacy write — not consulted for capture; safe to call from old code paths.
 */
export function saveCallNoiseSuppressionPreference(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* quota / private-mode: silently ignore */
  }
}

/**
 * Merge `base` audio constraints with the fixed outgoing-mic capture bundle.
 */
export function mergeCallOutgoingMicAudioCaptureConstraints(
  base: MediaTrackConstraints,
): MediaTrackConstraints {
  return { ...base, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
}

function warnIfNoiseSuppressionMismatch(track: MediaStreamTrack): void {
  if (!import.meta.env.DEV) {
    return
  }
  try {
    const s = typeof track.getSettings === 'function' ? track.getSettings() : null
    if (s && typeof s.noiseSuppression === 'boolean' && s.noiseSuppression !== true) {
      console.warn('[call-mic] noiseSuppression intent vs getSettings()', {
        intent: true,
        effective: s.noiseSuppression,
      })
    }
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort live update on an already-published mic track: applies the full
 * outgoing capture bundle. Falls back to `{ noiseSuppression: true }` only if the
 * bundle is rejected.
 */
export async function applyOutgoingCallMicCaptureConstraints(
  track: MediaStreamTrack | null | undefined,
): Promise<boolean> {
  if (!track || track.readyState !== 'live' || track.kind !== 'audio') {
    return false
  }
  const bundle: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
  try {
    await track.applyConstraints(bundle)
    warnIfNoiseSuppressionMismatch(track)
    return true
  } catch {
    try {
      await track.applyConstraints({ noiseSuppression: true })
      warnIfNoiseSuppressionMismatch(track)
      return true
    } catch {
      return false
    }
  }
}
