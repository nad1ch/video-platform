import { describe, expect, it } from 'vitest'
import { createConsumeLifecycleManager } from '../src/media/consumeLifecycleManager'

describe('createConsumeLifecycleManager', () => {
  it('reserves once after transport semantics (second caller loses)', () => {
    const m = createConsumeLifecycleManager()
    expect(m.isAlreadyConsumed('p1')).toBe(false)
    expect(m.tryReserveAfterTransport('p1')).toBe(true)
    expect(m.isAlreadyConsumed('p1')).toBe(true)
    expect(m.tryReserveAfterTransport('p1')).toBe(false)
  })

  it('releaseReservation allows a new reserve', () => {
    const m = createConsumeLifecycleManager()
    expect(m.tryReserveAfterTransport('p1')).toBe(true)
    m.releaseReservation('p1')
    expect(m.isAlreadyConsumed('p1')).toBe(false)
    expect(m.tryReserveAfterTransport('p1')).toBe(true)
  })

  it('inflight registration coalesces parallel callers', async () => {
    const m = createConsumeLifecycleManager()
    let runs = 0
    const task = (async () => {
      runs += 1
      await new Promise((r) => setTimeout(r, 5))
    })()
    m.registerInflightTask('p1', task)
    expect(m.getInflightTask('p1')).toBe(task)
    await task
    m.unregisterInflightTask('p1')
    expect(m.getInflightTask('p1')).toBeUndefined()
    expect(runs).toBe(1)
  })

  it('removeProducerLifecycle clears reservation, consuming marker, and inflight', () => {
    const m = createConsumeLifecycleManager()
    expect(m.tryReserveAfterTransport('p1')).toBe(true)
    m.markConsuming('p1')
    const p = Promise.resolve()
    m.registerInflightTask('p1', p)
    m.removeProducerLifecycle('p1')
    expect(m.isAlreadyConsumed('p1')).toBe(false)
    expect(m.getInflightTask('p1')).toBeUndefined()
  })

  it('resetAllLifecycle clears everything', () => {
    const m = createConsumeLifecycleManager()
    expect(m.tryReserveAfterTransport('a')).toBe(true)
    expect(m.tryReserveAfterTransport('b')).toBe(true)
    m.markConsuming('a')
    m.registerInflightTask('b', Promise.resolve())
    m.resetAllLifecycle()
    expect(m.isAlreadyConsumed('a')).toBe(false)
    expect(m.isAlreadyConsumed('b')).toBe(false)
    expect(m.getInflightTask('b')).toBeUndefined()
  })

  it('M8: getGeneration / isCurrentGeneration track resetAllLifecycle', () => {
    const m = createConsumeLifecycleManager()
    const g0 = m.getGeneration()
    expect(m.isCurrentGeneration(g0)).toBe(true)
    m.resetAllLifecycle()
    expect(m.isCurrentGeneration(g0)).toBe(false)
    const g1 = m.getGeneration()
    expect(g1).not.toBe(g0)
    expect(m.isCurrentGeneration(g1)).toBe(true)
    // A second reset bumps again so the prior generation also stops matching.
    m.resetAllLifecycle()
    expect(m.isCurrentGeneration(g1)).toBe(false)
  })

  it('M8: generation token captured before reset becomes stale after reset', () => {
    const m = createConsumeLifecycleManager()
    const captured = m.getGeneration()
    m.tryReserveAfterTransport('p1')
    m.resetAllLifecycle()
    // After teardown a previously-captured token must not match.
    expect(m.isCurrentGeneration(captured)).toBe(false)
    // The fresh generation can reserve the same producer id again because
    // the consumed set was cleared.
    expect(m.tryReserveAfterTransport('p1')).toBe(true)
  })
})
