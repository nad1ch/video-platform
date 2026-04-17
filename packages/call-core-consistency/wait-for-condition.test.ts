import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForCondition } from '../call-core/src/utils/waitForCondition'

describe('waitForCondition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves once predicate returns true', async () => {
    let ok = false
    const p = waitForCondition(() => ok, 500, 50)
    await vi.advanceTimersByTimeAsync(0)
    ok = true
    await vi.advanceTimersByTimeAsync(50)
    await expect(p).resolves.toBeUndefined()
  })

  it('resolves immediately when predicate is already true', async () => {
    const p = waitForCondition(() => true, 100, 50)
    await vi.advanceTimersByTimeAsync(0)
    await expect(p).resolves.toBeUndefined()
  })

  it('rejects after timeout when predicate stays false', async () => {
    const p = waitForCondition(() => false, 100, 30)
    const done = expect(p).rejects.toThrow('Timeout waiting for condition')
    await vi.advanceTimersByTimeAsync(500)
    await done
  })

  it('uses custom interval between polls', async () => {
    let calls = 0
    const p = waitForCondition(() => {
      calls += 1
      return calls >= 3
    }, 500, 100)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(calls).toBe(2)
    await vi.advanceTimersByTimeAsync(100)
    await expect(p).resolves.toBeUndefined()
    expect(calls).toBe(3)
  })
})
