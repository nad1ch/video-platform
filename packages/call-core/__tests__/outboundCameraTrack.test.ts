import { describe, expect, it } from 'vitest'
import { pickOutboundCameraVideoTrack } from '../src/screenShare/outboundCameraTrack'

describe('pickOutboundCameraVideoTrack', () => {
  it('prefers getVideoTracks()[0] when live', () => {
    const a = { kind: 'video', readyState: 'live', id: 'a' } as unknown as MediaStreamTrack
    const b = { kind: 'video', readyState: 'live', id: 'b' } as unknown as MediaStreamTrack
    const stream = {
      getVideoTracks: () => [a, b],
    } as unknown as MediaStream
    expect(pickOutboundCameraVideoTrack(stream)).toBe(a)
  })

  it('uses first live track when [0] is ended', () => {
    const stale = { kind: 'video', readyState: 'ended', id: 's' } as unknown as MediaStreamTrack
    const live = { kind: 'video', readyState: 'live', id: 'l' } as unknown as MediaStreamTrack
    const stream = {
      getVideoTracks: () => [stale, live],
    } as unknown as MediaStream
    expect(pickOutboundCameraVideoTrack(stream)).toBe(live)
  })
})
