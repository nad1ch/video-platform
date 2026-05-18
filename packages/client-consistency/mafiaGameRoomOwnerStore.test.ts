import { describe, expect, it, beforeEach } from 'vitest'

import {
  _ownerStoreSizeForTests,
  _resetMafiaRoomOwnerStoreForTests,
  clearMafiaRoomOwner,
  getMafiaRoomOwnerUserId,
  setMafiaRoomOwnerUserId,
} from '../../apps/server/src/signaling/mafiaRoomOwnerStore'

import {
  _gameRoomOwnerStoreSizeForTests,
  _resetGameRoomOwnerStoreForTests,
  clearGameRoomOwner,
  getGameRoomOwnerUserId,
  setGameRoomOwnerUserId,
} from '../../apps/server/src/signaling/gameRoomOwnerStore'

/**
 * Behavior baseline for the in-memory Mafia / GameRoom owner stores.
 *
 * Pins the current public API (get / set / clear / TTL semantics) so a
 * follow-up that adds Prisma persistence (`fix/full-audit-remediation` Batch F)
 * can swap the storage layer without silently regressing the contract that
 * `handleJoinRoom` and `handleMafia/GameRoomClaimHost` already rely on.
 *
 * The two namespaces must remain isolated — a Mafia claim must never grant
 * GameRoom ownership and vice versa.
 */
describe('mafiaRoomOwnerStore', () => {
  beforeEach(() => {
    _resetMafiaRoomOwnerStoreForTests()
  })

  it('returns null for an unseen roomId', () => {
    expect(getMafiaRoomOwnerUserId('mafia:room-1')).toBeNull()
  })

  it('round-trips a set then get', () => {
    setMafiaRoomOwnerUserId('mafia:room-1', 'user-A')
    expect(getMafiaRoomOwnerUserId('mafia:room-1')).toBe('user-A')
  })

  it('refresh by the same owner overwrites the prior TTL', () => {
    setMafiaRoomOwnerUserId('mafia:room-1', 'user-A', 10)
    setMafiaRoomOwnerUserId('mafia:room-1', 'user-A', 60_000)
    expect(getMafiaRoomOwnerUserId('mafia:room-1')).toBe('user-A')
  })

  it('rejects empty roomId and empty userId without inserting', () => {
    setMafiaRoomOwnerUserId('', 'user-A')
    setMafiaRoomOwnerUserId('mafia:room-1', '')
    expect(_ownerStoreSizeForTests()).toBe(0)
  })

  it('treats expired entries as missing and drops them on lookup', async () => {
    setMafiaRoomOwnerUserId('mafia:room-1', 'user-A', 1)
    await new Promise((r) => setTimeout(r, 5))
    expect(getMafiaRoomOwnerUserId('mafia:room-1')).toBeNull()
    expect(_ownerStoreSizeForTests()).toBe(0)
  })

  it('clear removes a specific roomId only', () => {
    setMafiaRoomOwnerUserId('mafia:room-1', 'user-A')
    setMafiaRoomOwnerUserId('mafia:room-2', 'user-B')
    clearMafiaRoomOwner('mafia:room-1')
    expect(getMafiaRoomOwnerUserId('mafia:room-1')).toBeNull()
    expect(getMafiaRoomOwnerUserId('mafia:room-2')).toBe('user-B')
  })
})

describe('gameRoomOwnerStore', () => {
  beforeEach(() => {
    _resetGameRoomOwnerStoreForTests()
  })

  it('returns null for an unseen roomId', () => {
    expect(getGameRoomOwnerUserId('gameroom:room-1')).toBeNull()
  })

  it('round-trips a set then get', () => {
    setGameRoomOwnerUserId('gameroom:room-1', 'user-A')
    expect(getGameRoomOwnerUserId('gameroom:room-1')).toBe('user-A')
  })

  it('rejects empty roomId and empty userId without inserting', () => {
    setGameRoomOwnerUserId('', 'user-A')
    setGameRoomOwnerUserId('gameroom:room-1', '')
    expect(_gameRoomOwnerStoreSizeForTests()).toBe(0)
  })

  it('treats expired entries as missing and drops them on lookup', async () => {
    setGameRoomOwnerUserId('gameroom:room-1', 'user-A', 1)
    await new Promise((r) => setTimeout(r, 5))
    expect(getGameRoomOwnerUserId('gameroom:room-1')).toBeNull()
    expect(_gameRoomOwnerStoreSizeForTests()).toBe(0)
  })

  it('clear removes a specific roomId only', () => {
    setGameRoomOwnerUserId('gameroom:room-1', 'user-A')
    setGameRoomOwnerUserId('gameroom:room-2', 'user-B')
    clearGameRoomOwner('gameroom:room-1')
    expect(getGameRoomOwnerUserId('gameroom:room-1')).toBeNull()
    expect(getGameRoomOwnerUserId('gameroom:room-2')).toBe('user-B')
  })
})

describe('mafia ↔ gameRoom owner-store namespace isolation', () => {
  beforeEach(() => {
    _resetMafiaRoomOwnerStoreForTests()
    _resetGameRoomOwnerStoreForTests()
  })

  it('claiming a Mafia room does not grant ownership in the GameRoom namespace', () => {
    setMafiaRoomOwnerUserId('shared:room-1', 'user-A')
    expect(getMafiaRoomOwnerUserId('shared:room-1')).toBe('user-A')
    expect(getGameRoomOwnerUserId('shared:room-1')).toBeNull()
  })

  it('claiming a GameRoom does not grant ownership in the Mafia namespace', () => {
    setGameRoomOwnerUserId('shared:room-2', 'user-B')
    expect(getGameRoomOwnerUserId('shared:room-2')).toBe('user-B')
    expect(getMafiaRoomOwnerUserId('shared:room-2')).toBeNull()
  })
})
