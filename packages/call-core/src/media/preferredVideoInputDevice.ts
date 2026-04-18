/** @internal — unit-tested; stable across sessions like Discord device memory */
export const PREFERRED_VIDEO_INPUT_DEVICE_ID_STORAGE_KEY = 'call.preferredVideoInputDeviceId'

export function readPreferredVideoInputDeviceId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  try {
    const v = localStorage.getItem(PREFERRED_VIDEO_INPUT_DEVICE_ID_STORAGE_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

export function savePreferredVideoInputDeviceId(deviceId: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  const t = deviceId.trim()
  if (!t) {
    return
  }
  try {
    localStorage.setItem(PREFERRED_VIDEO_INPUT_DEVICE_ID_STORAGE_KEY, t)
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Picks which `deviceId` to pass into `getUserMedia` video constraints.
 *
 * Priority: **persisted id** if still present → **OBS Virtual Camera** (label match, case-insensitive)
 * → `undefined` (let the browser choose the default device).
 *
 * Does **not** exclude virtual cameras — OBS is a valid primary capture for many streamers.
 */
export function selectPreferredVideoInputDeviceId(
  devices: MediaDeviceInfo[],
  savedId: string | null | undefined,
): string | undefined {
  const videos = devices.filter((d) => d.kind === 'videoinput')
  const saved = typeof savedId === 'string' ? savedId.trim() : ''
  if (saved.length > 0 && videos.some((d) => d.deviceId === saved)) {
    return saved
  }
  const obs = videos.find((d) => {
    const label = typeof d.label === 'string' ? d.label.trim() : ''
    return label.length > 0 && /obs/i.test(label)
  })
  if (obs?.deviceId) {
    return obs.deviceId
  }
  return undefined
}

export function persistVideoInputDeviceIdFromTrack(track: MediaStreamTrack | null | undefined): void {
  if (!track || track.kind !== 'video') {
    return
  }
  const id = (track.getSettings?.() as { deviceId?: string }).deviceId
  if (typeof id === 'string' && id.trim().length > 0) {
    savePreferredVideoInputDeviceId(id)
  }
}
