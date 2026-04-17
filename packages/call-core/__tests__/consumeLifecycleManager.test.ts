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
})
