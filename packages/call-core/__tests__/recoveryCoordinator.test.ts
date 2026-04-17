import { describe, expect, it } from 'vitest'
import {
  buildRequestProducerSyncPayload,
  createRecoveryCoordinator,
  planProducerSyncRecovery,
  producerSyncParsedToRecoveryEvent,
} from '../src/media/recoveryCoordinator'
import { parseProducerSyncPayload } from '../src/signaling/producerSyncPayload'
import type { RemoteProducerInfo } from '../src/signaling/useRoomConnection'

function row(p: Partial<RemoteProducerInfo> & { producerId: string; peerId: string; kind: 'audio' | 'video' }): RemoteProducerInfo {
  return {
    producerId: p.producerId,
    peerId: p.peerId,
    kind: p.kind,
    videoSource: p.videoSource,
  }
}

describe('planProducerSyncRecovery', () => {
  it('soft sync: no teardown, consumes deduped list', () => {
    const parsed = {
      forceResync: false,
      producers: [
        row({ producerId: 'a', peerId: 'p1', kind: 'video' }),
        row({ producerId: 'a', peerId: 'p1', kind: 'video', videoSource: 'screen' }),
      ],
    }
    const plan = planProducerSyncRecovery(parsed)
    expect(plan.teardownRecvConsumers).toBe(false)
    expect(plan.producersToConsume).toHaveLength(1)
    expect(plan.producersToConsume[0]?.videoSource).toBe('screen')
  })

  it('client-refresh: teardown then consume list', () => {
    const plan = planProducerSyncRecovery({
      forceResync: true,
      producers: [row({ producerId: 'x', peerId: 'p', kind: 'audio' })],
    })
    expect(plan.teardownRecvConsumers).toBe(true)
    expect(plan.producersToConsume).toHaveLength(1)
  })

  it('parses WS payload and matches coordinator plan (client-refresh)', () => {
    const data = {
      type: 'producer-sync',
      payload: {
        syncReason: 'client-refresh',
        producers: [{ producerId: 'z', peerId: 'peer', kind: 'video' }],
      },
    }
    const parsed = parseProducerSyncPayload(data)
    expect(parsed).not.toBeNull()
    const plan = planProducerSyncRecovery(parsed!)
    expect(plan.teardownRecvConsumers).toBe(true)
    expect(plan.producersToConsume[0]?.producerId).toBe('z')
  })
})

describe('buildRequestProducerSyncPayload', () => {
  it('soft = no resetConsumers', () => {
    expect(buildRequestProducerSyncPayload('soft')).toEqual({ resetConsumers: false })
  })
  it('hard = resetConsumers', () => {
    expect(buildRequestProducerSyncPayload('hard')).toEqual({ resetConsumers: true })
  })
})

describe('createRecoveryCoordinator', () => {
  const r = row({ producerId: 'c', peerId: 'p', kind: 'video' })

  it('producer-sync soft: reset false, apply list', () => {
    const c = createRecoveryCoordinator()
    const d = c.onEvent({ type: 'producer-sync', producers: [r] })
    expect(d.shouldReset).toBe(false)
    expect(d.shouldApplySync).toBe(true)
    expect(d.producersToApply).toHaveLength(1)
  })

  it('producer-sync client-refresh: reset true', () => {
    const c = createRecoveryCoordinator()
    const d = c.onEvent({ type: 'producer-sync', producers: [r], reason: 'client-refresh' })
    expect(d.shouldReset).toBe(true)
    expect(d.shouldApplySync).toBe(true)
  })

  it('new-producer: single row, no reset', () => {
    const c = createRecoveryCoordinator()
    const d = c.onEvent({ type: 'new-producer', producer: r })
    expect(d.shouldReset).toBe(false)
    expect(d.producersToApply).toEqual([r])
  })

  it('connected / client-refresh event: noop', () => {
    const c = createRecoveryCoordinator()
    expect(c.onEvent({ type: 'connected' }).shouldApplySync).toBe(false)
    expect(c.onEvent({ type: 'client-refresh' }).shouldApplySync).toBe(false)
  })

  it('duplicate producer-sync payloads: same decision shape (idempotent at consume layer)', () => {
    const c = createRecoveryCoordinator()
    const ev = producerSyncParsedToRecoveryEvent({ forceResync: false, producers: [r, r] })
    const a = c.onEvent(ev)
    const b = c.onEvent(ev)
    expect(a.shouldReset).toBe(b.shouldReset)
    expect(a.producersToApply.length).toBe(b.producersToApply.length)
  })

  it('markResetDone increments generation; markSyncApplied stores signature', () => {
    const c = createRecoveryCoordinator()
    expect(c.resetGeneration).toBe(0)
    c.markResetDone()
    expect(c.resetGeneration).toBe(1)
    c.markSyncApplied(['b', 'a'])
    expect(c.lastSyncSignature).toBe('a\u0000b')
  })
})
