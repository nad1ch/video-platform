import { beforeAll, describe, expect, it } from 'vitest'
import { localPreviewStreamForOutbound } from '../src/screenShare/previewStream'

beforeAll(() => {
  if (typeof globalThis.MediaStream !== 'undefined') {
    return
  }
  globalThis.MediaStream = class MediaStream {
    private readonly tracks: MediaStreamTrack[]
    constructor(tracks: MediaStreamTrack[]) {
      this.tracks = tracks
    }
    getVideoTracks(): MediaStreamTrack[] {
      return this.tracks.filter((t) => t.kind === 'video')
    }
    getAudioTracks(): MediaStreamTrack[] {
      return this.tracks.filter((t) => t.kind === 'audio')
    }
  } as unknown as typeof MediaStream
})

function fakeStream(
  videoTracks: Array<{ kind?: string; readyState: MediaStreamTrack['readyState'] }>,
): MediaStream {
  return {
    getVideoTracks: () => videoTracks as MediaStreamTrack[],
    getAudioTracks: () => [],
  } as unknown as MediaStream
}

describe('localPreviewStreamForOutbound', () => {
  it('uses display stream when outbound is screen and track is live', () => {
    const screen = fakeStream([{ kind: 'video', readyState: 'live' }])
    expect(localPreviewStreamForOutbound('screen', screen, null)).toBe(screen)
  })

  it('returns null for screen when track is not live', () => {
    const screen = fakeStream([{ kind: 'video', readyState: 'ended' }])
    expect(localPreviewStreamForOutbound('screen', screen, null)).toBe(null)
  })

  it('uses local stream when outbound is camera', () => {
    const cam = fakeStream([])
    expect(localPreviewStreamForOutbound('camera', null, cam)).toBe(cam)
  })

  it('returns null for none even if streams exist', () => {
    const cam = fakeStream([{ kind: 'video', readyState: 'live' }])
    expect(localPreviewStreamForOutbound('none', null, cam)).toBe(null)
  })

  it('ignores screen stream when outbound is camera', () => {
    const screen = fakeStream([{ kind: 'video', readyState: 'live' }])
    const cam = fakeStream([])
    expect(localPreviewStreamForOutbound('camera', screen, cam)).toBe(cam)
  })

  it('puts the live camera track first when slot [0] is stale (matches producer pick)', () => {
    const stale = { kind: 'video', readyState: 'ended' } as unknown as MediaStreamTrack
    const live = { kind: 'video', readyState: 'live' } as unknown as MediaStreamTrack
    const cam = {
      getVideoTracks: () => [stale, live],
      getAudioTracks: () => [] as MediaStreamTrack[],
    } as unknown as MediaStream
    const out = localPreviewStreamForOutbound('camera', null, cam)
    expect(out).not.toBe(cam)
    expect(out?.getVideoTracks()[0]).toBe(live)
  })
})
