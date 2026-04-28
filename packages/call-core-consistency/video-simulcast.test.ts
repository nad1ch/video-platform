import { describe, expect, it } from 'vitest'
import {
  VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM,
  shouldUseVideoSimulcastForRoom,
  spatialLayerForGridSizeTier,
} from '../call-core/src/media/videoSimulcast'

describe('shouldUseVideoSimulcastForRoom', () => {
  it('keeps the compatibility threshold unreachable', () => {
    expect(VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM).toBe(Number.POSITIVE_INFINITY)
  })

  it('always disables simulcast regardless of peer count', () => {
    expect(shouldUseVideoSimulcastForRoom(5)).toBe(false)
    expect(shouldUseVideoSimulcastForRoom(6)).toBe(false)
    expect(shouldUseVideoSimulcastForRoom(100)).toBe(false)
  })

  it('is false for non-positive peer counts', () => {
    expect(shouldUseVideoSimulcastForRoom(0)).toBe(false)
    expect(shouldUseVideoSimulcastForRoom(-3)).toBe(false)
  })
})

describe('spatialLayerForGridSizeTier', () => {
  it('maps grid tier to spatial layer index', () => {
    expect(spatialLayerForGridSizeTier('sm')).toBe(0)
    expect(spatialLayerForGridSizeTier('md')).toBe(1)
    expect(spatialLayerForGridSizeTier('lg')).toBe(2)
  })
})
