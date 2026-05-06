/**
 * Sender-side "light noise reduction" for the LOCAL outgoing microphone: browser
 * `noiseSuppression` plus reaffirmed `echoCancellation` / `autoGainControl` on the
 * live track so capture processing stays coherent after `getUserMedia`.
 * Persisted in `localStorage` (client-only; server unaware).
 *
 * Default `true` matches historical {@link import('../media/defaultMediaConstraints').DEFAULT_CALL_AUDIO_CONSTRAINTS}.
 * No AudioWorklet / WASM — constraints only.
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
 * Shallow copy of `base` with `noiseSuppression` set from storage. Other fields
 * (`echoCancellation`, `autoGainControl`, `deviceId`, …) are preserved for gUM.
 */
export function audioConstraintsWithUserNoiseSuppression(
  base: MediaTrackConstraints,
): MediaTrackConstraints {
  const enabled = loadCallNoiseSuppressionPreference()
  return { ...base, noiseSuppression: enabled }
}

function warnIfNoiseSuppressionMismatch(track: MediaStreamTrack, intent: boolean): void {
  if (!import.meta.env.DEV) {
    return
  }
  try {
    const s = typeof track.getSettings === 'function' ? track.getSettings() : null
    if (s && typeof s.noiseSuppression === 'boolean' && s.noiseSuppression !== intent) {
      console.warn('[call-mic] noiseSuppression intent vs getSettings()', {
        intent,
        effective: s.noiseSuppression,
      })
    }
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort live update on an already-published mic track: applies sender-side
 * light noise reduction (`noiseSuppression` per user) and reaffirms
 * `echoCancellation` / `autoGainControl` so browsers do not leave processing in a
 * partial state after constraint toggles. Falls back to `{ noiseSuppression }` only
 * if the full bundle is rejected.
 *
 * Returns `true` if any `applyConstraints` attempt succeeded. Caller should still
 * treat failure as non-fatal for publishing continuity.
 */
export async function applyNoiseSuppressionToTrack(
  track: MediaStreamTrack | null | undefined,
  enabled: boolean,
): Promise<boolean> {
  if (!track || track.readyState !== 'live' || track.kind !== 'audio') {
    return false
  }
  const bundle: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: enabled,
    autoGainControl: true,
  }
  try {
    await track.applyConstraints(bundle)
    warnIfNoiseSuppressionMismatch(track, enabled)
    return true
  } catch {
    try {
      await track.applyConstraints({ noiseSuppression: enabled })
      warnIfNoiseSuppressionMismatch(track, enabled)
      return true
    } catch {
      return false
    }
  }
}
