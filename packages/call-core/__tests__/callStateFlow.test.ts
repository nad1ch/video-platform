import { describe, expect, it } from 'vitest'
import { createMockCallState } from './mockCallState'

/**
 * Invariants (aligned with recv pipeline):
 * - At most one consumer slot per `producerId` in `consumedProducerIds`.
 * - `new-producer` then `producer-sync` with the same id does not grow the set.
 * - After hard reset, a sync can recreate consumption for the same ids (logical reconnect).
 */

describe('mock call state flow (producer → consume dedup)', () => {
  it('new producer creates a single consumer slot', () => {
    const s = createMockCallState()
    expect(s.onNewProducer('p1')).toBe('created')
    expect(s.consumerCount).toBe(1)
    expect(s.consumedProducerIds.has('p1')).toBe(true)
  })

  it('producer-sync after new-producer with same id does not duplicate', () => {
    const s = createMockCallState()
    expect(s.onNewProducer('p1')).toBe('created')
    const syncResults = s.onProducerSync(['p1'])
    expect(syncResults).toEqual(['alreadyConsumed'])
    expect(s.consumerCount).toBe(1)
  })

  it('producer-sync can add producers that were not in new-producer', () => {
    const s = createMockCallState()
    s.onNewProducer('a')
    const r = s.onProducerSync(['a', 'b'])
    expect(r).toEqual(['alreadyConsumed', 'created'])
    expect(s.consumerCount).toBe(2)
  })

  it('reconnect: hard reset then sync restores consumer slots', () => {
    const s = createMockCallState()
    s.onNewProducer('p1')
    s.onNewProducer('p2')
    expect(s.consumerCount).toBe(2)

    s.hardResetRecvConsumers()
    expect(s.consumerCount).toBe(0)

    const afterSync = s.onProducerSync(['p1', 'p2'])
    expect(afterSync).toEqual(['created', 'created'])
    expect(s.consumerCount).toBe(2)
  })

  it('duplicate ids in one sync batch still yield one slot per id', () => {
    const s = createMockCallState()
    const r = s.onProducerSync(['x', 'x', 'x'])
    expect(r).toEqual(['created', 'alreadyConsumed', 'alreadyConsumed'])
    expect(s.consumerCount).toBe(1)
  })
})
