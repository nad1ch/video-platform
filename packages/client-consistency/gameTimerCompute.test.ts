import { describe, expect, it } from 'vitest'
import {
  computeTimerIsActive,
  computeTimerIsTicking,
  computeTimerRemainingMs,
  formatTimerMmss,
  pickInitialTimerPreset,
} from '@/utils/gameTimerCompute'

describe('computeTimerRemainingMs', () => {
  it('running timer computes remaining from nowMs - startedAt', () => {
    const remaining = computeTimerRemainingMs({
      timer: { startedAt: 1000, durationMs: 60_000 },
      nowMs: 1000 + 20_000,
    })
    expect(remaining).toBe(40_000)
  })

  it('remaining never goes below 0', () => {
    const remaining = computeTimerRemainingMs({
      timer: { startedAt: 0, durationMs: 30_000 },
      nowMs: 100_000,
    })
    expect(remaining).toBe(0)
  })

  it('returns 0 when timer is null and not paused', () => {
    expect(computeTimerRemainingMs({ timer: null, nowMs: 5_000 })).toBe(0)
  })

  it('paused + finite frozenRemainingMs returns the frozen value', () => {
    const remaining = computeTimerRemainingMs({
      timer: { startedAt: 1000, durationMs: 60_000 },
      nowMs: 999_999_999,
      paused: true,
      frozenRemainingMs: 42_000,
    })
    expect(remaining).toBe(42_000)
  })

  it('paused + two different nowMs values returns the same frozen value', () => {
    const a = computeTimerRemainingMs({
      timer: { startedAt: 1000, durationMs: 60_000 },
      nowMs: 1_500,
      paused: true,
      frozenRemainingMs: 12_345,
    })
    const b = computeTimerRemainingMs({
      timer: { startedAt: 1000, durationMs: 60_000 },
      nowMs: 9_999_999,
      paused: true,
      frozenRemainingMs: 12_345,
    })
    expect(a).toBe(12_345)
    expect(b).toBe(12_345)
  })

  it('paused + null frozen remaining falls back to timer-derived remaining', () => {
    const remaining = computeTimerRemainingMs({
      timer: { startedAt: 0, durationMs: 60_000 },
      nowMs: 20_000,
      paused: true,
      frozenRemainingMs: null,
    })
    expect(remaining).toBe(40_000)
  })

  it('paused + non-finite frozen remaining falls back to timer-derived remaining', () => {
    const remaining = computeTimerRemainingMs({
      timer: { startedAt: 0, durationMs: 60_000 },
      nowMs: 20_000,
      paused: true,
      frozenRemainingMs: Number.NaN,
    })
    expect(remaining).toBe(40_000)
  })

  it('paused + null frozen + null timer returns 0', () => {
    expect(
      computeTimerRemainingMs({
        timer: null,
        nowMs: 5_000,
        paused: true,
        frozenRemainingMs: null,
      }),
    ).toBe(0)
  })

  it('Mafia / Game Template default branch: no paused, no frozen', () => {
    const remaining = computeTimerRemainingMs({
      timer: { startedAt: 1_000, durationMs: 30_000 },
      nowMs: 11_000,
    })
    expect(remaining).toBe(20_000)
  })
})

describe('computeTimerIsActive', () => {
  it('true when timer running and remainingMs > 0', () => {
    expect(
      computeTimerIsActive({
        timer: { startedAt: 0, durationMs: 60_000 },
        remainingMs: 5_000,
      }),
    ).toBe(true)
  })

  it('false when timer is null and no frozen remaining', () => {
    expect(computeTimerIsActive({ timer: null, remainingMs: 0 })).toBe(false)
  })

  it('false when timer running but remainingMs is 0', () => {
    expect(
      computeTimerIsActive({
        timer: { startedAt: 0, durationMs: 60_000 },
        remainingMs: 0,
      }),
    ).toBe(false)
  })

  it('true while paused with positive frozen remaining', () => {
    expect(
      computeTimerIsActive({
        timer: null,
        remainingMs: 0,
        paused: true,
        frozenRemainingMs: 5_000,
      }),
    ).toBe(true)
  })

  it('false while paused with zero frozen remaining', () => {
    expect(
      computeTimerIsActive({
        timer: null,
        remainingMs: 0,
        paused: true,
        frozenRemainingMs: 0,
      }),
    ).toBe(false)
  })

  it('false while paused with null frozen remaining and no live timer', () => {
    expect(
      computeTimerIsActive({
        timer: null,
        remainingMs: 0,
        paused: true,
        frozenRemainingMs: null,
      }),
    ).toBe(false)
  })

  it('stays true while paused even when both branches qualify', () => {
    expect(
      computeTimerIsActive({
        timer: { startedAt: 0, durationMs: 60_000 },
        remainingMs: 30_000,
        paused: true,
        frozenRemainingMs: 30_000,
      }),
    ).toBe(true)
  })
})

describe('computeTimerIsTicking', () => {
  it('true when active and not paused', () => {
    expect(computeTimerIsTicking({ isActive: true })).toBe(true)
    expect(computeTimerIsTicking({ isActive: true, paused: false })).toBe(true)
  })

  it('false while paused even if active', () => {
    expect(computeTimerIsTicking({ isActive: true, paused: true })).toBe(false)
  })

  it('false when not active', () => {
    expect(computeTimerIsTicking({ isActive: false })).toBe(false)
    expect(computeTimerIsTicking({ isActive: false, paused: true })).toBe(false)
  })
})

describe('formatTimerMmss', () => {
  it('formats 90000 ms as 1:30', () => {
    expect(formatTimerMmss(90_000)).toBe('1:30')
  })

  it('formats 0 ms as 0:00', () => {
    expect(formatTimerMmss(0)).toBe('0:00')
  })

  it('pads seconds to two digits', () => {
    expect(formatTimerMmss(5_000)).toBe('0:05')
    expect(formatTimerMmss(65_000)).toBe('1:05')
  })

  it('floors sub-second remainders', () => {
    expect(formatTimerMmss(59_999)).toBe('0:59')
  })

  it('formats large values', () => {
    expect(formatTimerMmss(10 * 60_000)).toBe('10:00')
  })
})

describe('pickInitialTimerPreset', () => {
  const presets = [30_000, 60_000, 90_000, 120_000] as const

  it('returns the default when it is a member of the preset list', () => {
    expect(pickInitialTimerPreset(90_000, presets)).toBe(90_000)
  })

  it('falls back to the last preset when default is undefined', () => {
    expect(pickInitialTimerPreset(undefined, presets)).toBe(120_000)
  })

  it('falls back to the last preset when default is not in the list', () => {
    expect(pickInitialTimerPreset(45_000, presets)).toBe(120_000)
  })

  it('returns 90_000 fallback when both default and list are empty', () => {
    expect(pickInitialTimerPreset(undefined, [])).toBe(90_000)
  })

  it('returns the only preset when list has one entry', () => {
    expect(pickInitialTimerPreset(undefined, [60_000])).toBe(60_000)
  })
})
