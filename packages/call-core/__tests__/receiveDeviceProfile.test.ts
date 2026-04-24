import { describe, expect, it } from 'vitest'
import {
  RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
  RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
  resolveReceiveDeviceProfile,
} from '../src/media/receiveDeviceProfile'

describe('resolveReceiveDeviceProfile', () => {
  it('returns default profile when input is undefined', () => {
    const p = resolveReceiveDeviceProfile(undefined)
    expect(p.profile).toBe('default')
    expect(p.maxHighStreams).toBe(RECEIVE_DEVICE_DEFAULT_MAX_HIGH)
    expect(p.maxMediumStreams).toBe(RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM)
    expect(p.allowRenderSuppression).toBe(false)
    expect(p.maxActiveRemoteVideos).toBe(7)
    expect(p.pressureBadStreakToShift).toBe(3)
  })

  it('classifies Android UA as mobile', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 8,
    })
    expect(p.profile).toBe('mobile')
    expect(p.maxHighStreams).toBe(1)
    expect(p.maxMediumStreams).toBe(3)
    expect(p.allowRenderSuppression).toBe(true)
    expect(p.maxActiveRemoteVideos).toBe(4)
    expect(p.pressureBadStreakToShift).toBe(2)
  })

  it('classifies iPhone UA as mobile', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    expect(p.profile).toBe('mobile')
    expect(p.maxHighStreams).toBe(1)
  })

  it('classifies weak desktop (low core count) as constrained', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      hardwareConcurrency: 4,
    })
    expect(p.profile).toBe('constrained')
    expect(p.maxHighStreams).toBe(1)
    expect(p.maxMediumStreams).toBe(4)
    expect(p.maxActiveRemoteVideos).toBe(5)
    expect(p.pressureBadStreakToShift).toBe(2)
  })

  it('classifies low deviceMemory as constrained', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 4,
    })
    expect(p.profile).toBe('constrained')
  })

  it('classifies many-core desktop without memory API as strong', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      hardwareConcurrency: 12,
    })
    expect(p.profile).toBe('strong')
    expect(p.maxHighStreams).toBe(RECEIVE_DEVICE_DEFAULT_MAX_HIGH)
    expect(p.maxMediumStreams).toBe(RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM)
    expect(p.allowRenderSuppression).toBe(false)
    expect(p.maxActiveRemoteVideos).toBe(9)
    expect(p.pressureBadStreakToShift).toBe(4)
  })

  it('classifies 8 cores + 8 GB as strong', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 8,
    })
    expect(p.profile).toBe('strong')
  })

  it('uses default for mid-range desktop (6 cores, no memory)', () => {
    const p = resolveReceiveDeviceProfile({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      hardwareConcurrency: 6,
    })
    expect(p.profile).toBe('default')
  })
})
