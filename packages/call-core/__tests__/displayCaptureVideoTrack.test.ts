import { describe, expect, it } from 'vitest'
import { ensureDisplayCaptureVideoTrackEnabled } from '../src/screenShare/displayCaptureVideoTrack'

describe('ensureDisplayCaptureVideoTrackEnabled', () => {
  it('sets enabled when displaySurface is present', () => {
    const track = {
      kind: 'video',
      enabled: false,
      getSettings: () => ({ displaySurface: 'monitor' }),
    } as unknown as MediaStreamTrack
    ensureDisplayCaptureVideoTrackEnabled(track)
    expect(track.enabled).toBe(true)
  })

  it('does not change camera tracks (no displaySurface)', () => {
    const track = {
      kind: 'video',
      enabled: false,
      getSettings: () => ({}),
    } as unknown as MediaStreamTrack
    ensureDisplayCaptureVideoTrackEnabled(track)
    expect(track.enabled).toBe(false)
  })

  it('ignores null', () => {
    ensureDisplayCaptureVideoTrackEnabled(null)
  })
})
