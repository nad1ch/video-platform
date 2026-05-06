/**
 * User-controlled override for the browser's `noiseSuppression` audio
 * constraint on the LOCAL outgoing microphone. Persisted in `localStorage`
 * so the choice survives page refresh, but kept entirely client-side —
 * server / signaling are not aware.
 *
 * Default `true` matches the historical {@link import('../media/defaultMediaConstraints').DEFAULT_CALL_AUDIO_CONSTRAINTS},
 * so users who never touch the toggle keep getting browser-level noise
 * suppression exactly like before this option existed.
 *
 * Light, additive layer: callers should still spread the existing default
 * audio constraints first and let the override flip only `noiseSuppression`.
 * No custom DSP, no AudioWorklet — just `MediaTrackConstraints`.
 */

const STORAGE_KEY = 'streamassist:call:light-noise-suppression-v1'

/**
 * Read the persisted preference. Returns `true` when storage is unavailable
 * (private mode / SSR) so behaviour matches the historical default.
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

export function saveCallNoiseSuppressionPreference(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* quota / private-mode: silently ignore */
  }
}

/**
 * Returns a shallow copy of the supplied base constraints with
 * `noiseSuppression` set to the user's preference. Other fields
 * (`echoCancellation`, `autoGainControl`, `deviceId`, …) are preserved.
 */
export function audioConstraintsWithUserNoiseSuppression(
  base: MediaTrackConstraints,
): MediaTrackConstraints {
  const enabled = loadCallNoiseSuppressionPreference()
  return { ...base, noiseSuppression: enabled }
}

/**
 * Best-effort live update on an already-published audio track. Returns
 * `true` if the browser accepted the constraint, `false` otherwise.
 * Caller should treat both outcomes as success — falling back silently
 * matches the audit's "do not break WebRTC publishing" / "no audio loops"
 * guarantees.
 */
export async function applyNoiseSuppressionToTrack(
  track: MediaStreamTrack | null | undefined,
  enabled: boolean,
): Promise<boolean> {
  if (!track || track.readyState !== 'live' || track.kind !== 'audio') return false
  try {
    await track.applyConstraints({ noiseSuppression: enabled })
    return true
  } catch {
    return false
  }
}
