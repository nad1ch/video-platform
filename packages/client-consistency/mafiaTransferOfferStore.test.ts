import { describe, expect, it, beforeEach, vi } from 'vitest'

import {
  _resetMafiaTransferOfferStoreForTests,
  _transferOfferStoreSizeForTests,
  clearTransferOffer,
  clearTransferOfferForPeer,
  createTransferOffer,
  getTransferOffer,
  type MafiaTransferOffer,
} from '../../apps/server/src/signaling/mafiaTransferOfferStore'

/**
 * Behavior baseline for the Mafia two-phase transfer-host pending-offer
 * store (audit Finding I).
 *
 * Pins:
 *   - replace semantics: a new offer for the same room cancels the prior's
 *     timer and returns the prior offer to the caller;
 *   - lazy + timer-driven expiry, including `onExpire` firing exactly once;
 *   - per-peer cleanup that returns which role matched so the caller can
 *     unicast `cancelled` to the surviving party.
 */

const baseOffer = (overrides: Partial<Omit<MafiaTransferOffer, 'expiresAt'>> = {}) => ({
  fromUserId: 'user-host',
  fromPeerId: 'peer-host',
  fromSessionId: 'sess-host',
  fromDisplayName: 'Host',
  targetUserId: 'user-target',
  targetPeerId: 'peer-target',
  targetSessionId: 'sess-target',
  ...overrides,
})

describe('mafiaTransferOfferStore', () => {
  beforeEach(() => {
    _resetMafiaTransferOfferStoreForTests()
  })

  it('returns null for an unseen roomId', () => {
    expect(getTransferOffer('mafia:room-1')).toBeNull()
  })

  it('creates an offer that round-trips through get', () => {
    const onExpire = vi.fn()
    createTransferOffer('mafia:room-1', baseOffer(), onExpire, 60_000)
    const got = getTransferOffer('mafia:room-1')
    expect(got).not.toBeNull()
    expect(got?.fromUserId).toBe('user-host')
    expect(got?.targetUserId).toBe('user-target')
    expect(got?.fromDisplayName).toBe('Host')
    expect(_transferOfferStoreSizeForTests()).toBe(1)
  })

  it('rejects empty roomId without inserting', () => {
    const result = createTransferOffer('', baseOffer(), vi.fn())
    expect(result).toBeNull()
    expect(_transferOfferStoreSizeForTests()).toBe(0)
  })

  it('replace returns the prior offer and cancels its expiry timer', async () => {
    const firstExpire = vi.fn()
    const secondExpire = vi.fn()
    createTransferOffer('mafia:room-1', baseOffer({ targetUserId: 'A' }), firstExpire, 5)
    const prior = createTransferOffer(
      'mafia:room-1',
      baseOffer({ targetUserId: 'B' }),
      secondExpire,
      60_000,
    )
    expect(prior).not.toBeNull()
    expect(prior?.targetUserId).toBe('A')
    // First expiry must NOT fire even though its 5ms TTL has long passed,
    // because the second create cancelled the timer.
    await new Promise((r) => setTimeout(r, 25))
    expect(firstExpire).not.toHaveBeenCalled()
    expect(secondExpire).not.toHaveBeenCalled()
    expect(getTransferOffer('mafia:room-1')?.targetUserId).toBe('B')
  })

  it('timer-driven expiry fires onExpire once and drops the row', async () => {
    const onExpire = vi.fn()
    createTransferOffer('mafia:room-1', baseOffer(), onExpire, 5)
    await new Promise((r) => setTimeout(r, 25))
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledWith(
      expect.objectContaining({ fromUserId: 'user-host', targetUserId: 'user-target' }),
    )
    expect(getTransferOffer('mafia:room-1')).toBeNull()
    expect(_transferOfferStoreSizeForTests()).toBe(0)
  })

  it('lazy expiry on get returns null and drops when expiresAt has passed', async () => {
    const onExpire = vi.fn()
    // TTL 0 → already expired at creation. The timer path is skipped (ttl===0
    // does not schedule), so lazy get is the only path that drops the row.
    createTransferOffer('mafia:room-1', baseOffer(), onExpire, 0)
    expect(_transferOfferStoreSizeForTests()).toBe(1)
    expect(getTransferOffer('mafia:room-1')).toBeNull()
    expect(_transferOfferStoreSizeForTests()).toBe(0)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('clearTransferOffer returns the cleared offer and removes the row', () => {
    createTransferOffer('mafia:room-1', baseOffer(), vi.fn(), 60_000)
    const cleared = clearTransferOffer('mafia:room-1')
    expect(cleared?.fromUserId).toBe('user-host')
    expect(getTransferOffer('mafia:room-1')).toBeNull()
    expect(_transferOfferStoreSizeForTests()).toBe(0)
  })

  it('clearTransferOffer is a no-op when no offer is present', () => {
    expect(clearTransferOffer('mafia:room-1')).toBeNull()
  })

  it('clearTransferOfferForPeer matches host peerId and reports the role', () => {
    createTransferOffer('mafia:room-1', baseOffer(), vi.fn(), 60_000)
    const out = clearTransferOfferForPeer('mafia:room-1', 'peer-host')
    expect(out.role).toBe('host')
    expect(out.offer?.targetPeerId).toBe('peer-target')
    expect(getTransferOffer('mafia:room-1')).toBeNull()
  })

  it('clearTransferOfferForPeer matches target peerId and reports the role', () => {
    createTransferOffer('mafia:room-1', baseOffer(), vi.fn(), 60_000)
    const out = clearTransferOfferForPeer('mafia:room-1', 'peer-target')
    expect(out.role).toBe('target')
    expect(out.offer?.fromPeerId).toBe('peer-host')
    expect(getTransferOffer('mafia:room-1')).toBeNull()
  })

  it('clearTransferOfferForPeer is a no-op for an unrelated peerId', () => {
    createTransferOffer('mafia:room-1', baseOffer(), vi.fn(), 60_000)
    const out = clearTransferOfferForPeer('mafia:room-1', 'peer-unrelated')
    expect(out.role).toBeNull()
    expect(out.offer).toBeNull()
    expect(getTransferOffer('mafia:room-1')?.targetUserId).toBe('user-target')
  })

  it('clearTransferOfferForPeer cancels the timer so onExpire never fires', async () => {
    const onExpire = vi.fn()
    createTransferOffer('mafia:room-1', baseOffer(), onExpire, 5)
    clearTransferOfferForPeer('mafia:room-1', 'peer-host')
    await new Promise((r) => setTimeout(r, 25))
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('keeps two rooms isolated', () => {
    createTransferOffer(
      'mafia:room-1',
      baseOffer({ fromUserId: 'host-1', targetUserId: 'target-1' }),
      vi.fn(),
      60_000,
    )
    createTransferOffer(
      'mafia:room-2',
      baseOffer({ fromUserId: 'host-2', targetUserId: 'target-2' }),
      vi.fn(),
      60_000,
    )
    clearTransferOffer('mafia:room-1')
    expect(getTransferOffer('mafia:room-1')).toBeNull()
    expect(getTransferOffer('mafia:room-2')?.targetUserId).toBe('target-2')
  })

  it('_resetMafiaTransferOfferStoreForTests clears every room and cancels timers', async () => {
    const a = vi.fn()
    const b = vi.fn()
    createTransferOffer('mafia:room-1', baseOffer(), a, 5)
    createTransferOffer('mafia:room-2', baseOffer(), b, 5)
    _resetMafiaTransferOfferStoreForTests()
    await new Promise((r) => setTimeout(r, 25))
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
    expect(_transferOfferStoreSizeForTests()).toBe(0)
  })
})
