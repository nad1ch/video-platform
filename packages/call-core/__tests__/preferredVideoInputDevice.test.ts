import { describe, expect, it } from 'vitest'
import { selectPreferredVideoInputDeviceId } from '../src/media/preferredVideoInputDevice'

function dev(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
): MediaDeviceInfo {
  return { deviceId, kind, label, groupId: '', toJSON: () => ({}) } as unknown as MediaDeviceInfo
}

describe('selectPreferredVideoInputDeviceId', () => {
  it('prefers saved id when still listed', () => {
    const d = [
      dev('a', 'videoinput', 'Camera A'),
      dev('obs-id', 'videoinput', 'OBS Virtual Camera'),
    ]
    expect(selectPreferredVideoInputDeviceId(d, 'a')).toBe('a')
  })

  it('falls back to OBS-labeled device when saved is missing', () => {
    const d = [
      dev('droid', 'videoinput', 'DroidCam Video'),
      dev('obs-id', 'videoinput', 'OBS Virtual Camera'),
    ]
    expect(selectPreferredVideoInputDeviceId(d, null)).toBe('obs-id')
  })

  it('does not prefer saved id if not among devices', () => {
    const d = [dev('obs-id', 'videoinput', 'OBS Virtual Camera')]
    expect(selectPreferredVideoInputDeviceId(d, 'gone')).toBe('obs-id')
  })

  it('returns undefined when no match and no OBS', () => {
    const d = [dev('d1', 'videoinput', 'DroidCam Video')]
    expect(selectPreferredVideoInputDeviceId(d, null)).toBe(undefined)
  })
})
