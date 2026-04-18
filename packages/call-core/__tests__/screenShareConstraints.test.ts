import { describe, expect, it } from 'vitest'
import { SCREEN_SHARE_GET_DISPLAY_MEDIA } from '../src/screenShare/useCallScreenShare'

describe('SCREEN_SHARE_GET_DISPLAY_MEDIA', () => {
  it('uses moderate fps and no mic track passthrough', () => {
    expect(SCREEN_SHARE_GET_DISPLAY_MEDIA.audio).toBe(false)
    expect(SCREEN_SHARE_GET_DISPLAY_MEDIA.video).toEqual({
      frameRate: { ideal: 15, max: 30 },
    })
  })
})
