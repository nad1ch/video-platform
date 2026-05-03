import { describe, expect, it } from 'vitest'
import { clientMessageSchema } from '../../apps/server/src/signaling/clientMessageSchema'

/**
 * Sanity tests for the WS contract changes that ship with multi-codec / consumer-pause.
 * The full schema has many shapes — we focus on the new and most safety-critical ones
 * so a future refactor cannot quietly drop a field or relax a constraint.
 */

describe('clientMessageSchema', () => {
  describe('set-consumer-paused (new in this change)', () => {
    it('accepts a valid pause request', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-paused',
        payload: { consumerId: 'consumer-1', paused: true },
      })
      expect(parsed.success).toBe(true)
    })

    it('accepts a valid resume request', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-paused',
        payload: { consumerId: 'consumer-1', paused: false },
      })
      expect(parsed.success).toBe(true)
    })

    it('rejects an empty consumerId', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-paused',
        payload: { consumerId: '', paused: true },
      })
      expect(parsed.success).toBe(false)
    })

    it('rejects a non-boolean paused value (no truthy coercion)', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-paused',
        payload: { consumerId: 'consumer-1', paused: 'yes' },
      })
      expect(parsed.success).toBe(false)
    })

    it('rejects a missing payload', () => {
      const parsed = clientMessageSchema.safeParse({ type: 'set-consumer-paused' })
      expect(parsed.success).toBe(false)
    })
  })

  describe('set-consumer-preferred-layers (existing — guard against regressions)', () => {
    it('accepts spatial-only', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-preferred-layers',
        payload: { consumerId: 'c1', spatialLayer: 0 },
      })
      expect(parsed.success).toBe(true)
    })

    it('accepts spatial + temporal', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-preferred-layers',
        payload: { consumerId: 'c1', spatialLayer: 2, temporalLayer: 2 },
      })
      expect(parsed.success).toBe(true)
    })

    it('rejects out-of-range spatialLayer (3)', () => {
      const parsed = clientMessageSchema.safeParse({
        type: 'set-consumer-preferred-layers',
        payload: { consumerId: 'c1', spatialLayer: 3 },
      })
      expect(parsed.success).toBe(false)
    })
  })
})
