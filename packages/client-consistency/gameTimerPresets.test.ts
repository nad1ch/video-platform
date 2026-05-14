import { describe, expect, it } from 'vitest'
import { GAME_TIMER_PRESET_MS } from '@/utils/gameTimerPresets'

describe('GAME_TIMER_PRESET_MS', () => {
  it('contains exactly 30/60/90/120 seconds in ms', () => {
    expect(Array.from(GAME_TIMER_PRESET_MS)).toEqual([30_000, 60_000, 90_000, 120_000])
  })

  it('order is strictly ascending', () => {
    const arr = Array.from(GAME_TIMER_PRESET_MS)
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]).toBeGreaterThan(arr[i - 1])
    }
  })

  it('contains no duplicate values', () => {
    const arr = Array.from(GAME_TIMER_PRESET_MS)
    expect(new Set(arr).size).toBe(arr.length)
  })
})
