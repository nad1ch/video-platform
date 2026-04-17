import { describe, expect, it } from 'vitest'
import { mapTilesToParticipants } from '../src/utils/participantsMapper'
import { tryConsumeProducerOnce } from '../src/utils/consumerDedup'
import { mergeProducerLists } from '../src/media/mergeProducerLists'
import { parseProducerSyncPayload } from '../src/signaling/producerSyncPayload'
import type { RemoteProducerInfo } from '../src/signaling/useRoomConnection'

/**
 * Fast, deterministic tests for call-core invariants (no WebRTC, no browser).
 * Covers producer list merging, producer-sync parsing, and tile → participant mapping.
 */

function audioProducer(id: string, peerId: string): RemoteProducerInfo {
  return { producerId: id, peerId, kind: 'audio' }
}

function videoProducer(id: string, peerId: string): RemoteProducerInfo {
  return { producerId: id, peerId, kind: 'video' }
}

describe('mergeProducerLists (join / room-state / new-producer overlap)', () => {
  it('merges two peers worth of producers into one deduped list', () => {
    const peerA = [videoProducer('vp-a', 'peer-a')]
    const peerB = [audioProducer('ap-b', 'peer-b'), videoProducer('vp-b', 'peer-b')]
    const merged = mergeProducerLists(peerA, peerB)
    expect(merged).toHaveLength(3)
    const ids = new Set(merged.map((p) => p.producerId))
    expect(ids.has('vp-a')).toBe(true)
    expect(ids.has('ap-b')).toBe(true)
    expect(ids.has('vp-b')).toBe(true)
  })

  it('does not duplicate producers when the same producer appears in two sync batches', () => {
    const batch = [audioProducer('a1', 'p1'), videoProducer('v1', 'p1')]
    const merged = mergeProducerLists(batch, batch)
    expect(merged).toHaveLength(2)
    expect(mergeProducerLists(batch, batch, batch)).toHaveLength(2)
  })

  it('reconnect-style overlap: same producerId from snapshot + live list stays single entry', () => {
    const before = [videoProducer('vp1', 'alice')]
    const after = [videoProducer('vp1', 'alice'), audioProducer('ap2', 'bob')]
    expect(mergeProducerLists(before, after)).toHaveLength(2)
  })

  it('later list wins on duplicate producerId (last merged batch overwrites)', () => {
    const older = [{ producerId: 'p1', peerId: 'first', kind: 'video' as const }]
    const newer = [{ producerId: 'p1', peerId: 'second', kind: 'video' as const }]
    expect(mergeProducerLists(older, newer).find((p) => p.producerId === 'p1')?.peerId).toBe('second')
    expect(mergeProducerLists(newer, older).find((p) => p.producerId === 'p1')?.peerId).toBe('first')
  })
})

describe('parseProducerSyncPayload', () => {
  it('parses producers and forceResync for client-refresh', () => {
    const msg = {
      type: 'producer-sync',
      payload: {
        syncReason: 'client-refresh',
        producers: [
          { producerId: 'pr1', peerId: 'u1', kind: 'video', videoSource: 'camera' },
        ],
      },
    }
    const parsed = parseProducerSyncPayload(msg)
    expect(parsed).not.toBeNull()
    expect(parsed!.forceResync).toBe(true)
    expect(parsed!.producers).toEqual([
      { producerId: 'pr1', peerId: 'u1', kind: 'video', videoSource: 'camera' },
    ])
  })

  it('returns null for non producer-sync messages', () => {
    expect(parseProducerSyncPayload({ type: 'room-state', payload: {} })).toBeNull()
    expect(parseProducerSyncPayload(null)).toBeNull()
  })

  it('returns null when payload.producers is not an array', () => {
    expect(
      parseProducerSyncPayload({
        type: 'producer-sync',
        payload: { producers: 'not-array' },
      }),
    ).toBeNull()
    expect(
      parseProducerSyncPayload({
        type: 'producer-sync',
        payload: { producers: null },
      }),
    ).toBeNull()
  })
})

describe('tryConsumeProducerOnce (mirrors consumeProducer producerId guard)', () => {
  it('does not double-count the same producerId across repeated sync passes', () => {
    const consumed = new Set<string>()
    const fromServer = [audioProducer('a', 'p1')]
    for (const pass of [fromServer, fromServer]) {
      for (const pr of pass) {
        tryConsumeProducerOnce(pr.producerId, consumed)
      }
    }
    expect(consumed.size).toBe(1)
  })

  it('is idempotent under repeated calls for the same id', () => {
    const consumed = new Set<string>()
    expect(tryConsumeProducerOnce('p', consumed)).toBe('created')
    expect(tryConsumeProducerOnce('p', consumed)).toBe('alreadyConsumed')
    expect(tryConsumeProducerOnce('p', consumed)).toBe('alreadyConsumed')
    expect(consumed.size).toBe(1)
  })
})

describe('mapTilesToParticipants', () => {
  it('maps tiles to a Map keyed by peerId', () => {
    const mockStream = {
      getTracks() {
        return [
          { kind: 'audio' } as MediaStreamTrack,
          { kind: 'video' } as MediaStreamTrack,
        ]
      },
    } as MediaStream

    const tiles = [
      { peerId: '1', displayName: 'A', stream: mockStream, isLocal: false },
      { peerId: '2', displayName: 'B', stream: null, isLocal: false },
    ]
    const participants = mapTilesToParticipants(tiles, {})
    expect(participants.get('1')).toMatchObject({
      peerId: '1',
      displayName: 'A',
    })
    expect(participants.get('1')?.audioTrack).toBeDefined()
    expect(participants.get('1')?.videoTrack).toBeDefined()
    expect(participants.get('2')?.stream).toBeUndefined()
  })
})
