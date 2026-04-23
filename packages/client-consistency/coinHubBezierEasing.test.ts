import { describe, expect, it } from 'vitest'
import {
  dailySpinReelProgress,
  slotCubicBezierProgress,
  spinCubicBezierProgress,
} from '@/utils/coinHub/coinHubBezierEasing'

describe('slotCubicBezierProgress (0.15, 0.85, 0.3, 1) — main reel', () => {
  it('is 0 and 1 at the ends', () => {
    expect(slotCubicBezierProgress(0)).toBe(0)
    expect(slotCubicBezierProgress(1)).toBe(1)
  })
  it('is monotonic in [0, 1]', () => {
    let prev = slotCubicBezierProgress(0)
    for (let i = 1; i <= 50; i += 1) {
      const u = i / 50
      const p = slotCubicBezierProgress(u)
      expect(p + 1e-9).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
})

describe('dailySpinReelProgress (0.05, 0.8, 0.2, 1) — main daily strip', () => {
  it('is 0 and 1 at the ends', () => {
    expect(dailySpinReelProgress(0)).toBe(0)
    expect(dailySpinReelProgress(1)).toBe(1)
  })
  it('is monotonic in [0, 1]', () => {
    let prev = dailySpinReelProgress(0)
    for (let i = 1; i <= 50; i += 1) {
      const u = i / 50
      const p = dailySpinReelProgress(u)
      expect(p + 1e-9).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
})

describe('spinCubicBezierProgress (CSS cubic-bezier(0.1, 0.7, 0.1, 1))', () => {
  it('is 0 and 1 at the ends', () => {
    expect(spinCubicBezierProgress(0)).toBe(0)
    expect(spinCubicBezierProgress(1)).toBe(1)
  })
  it('is monotonic in [0, 1]', () => {
    const samples = 64
    let prev = spinCubicBezierProgress(0)
    for (let i = 1; i <= samples; i += 1) {
      const u = i / samples
      const p = spinCubicBezierProgress(u)
      expect(p + 1e-6).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })
})
