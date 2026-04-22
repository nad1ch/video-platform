import { describe, expect, it } from 'vitest'
import {
  mafiaBaseRoomIdFromSignaling,
  mafiaSignalingRoomId,
} from '../../apps/client/src/composables/useMafiaMediaRoom'

describe('useMafiaMediaRoom', () => {
  it('prefixes mafia signaling room and round-trips', () => {
    expect(mafiaSignalingRoomId('abc123')).toBe('mafia:abc123')
    expect(mafiaBaseRoomIdFromSignaling('mafia:abc123')).toBe('abc123')
  })

  it('is idempotent when the base already includes the namespace', () => {
    expect(mafiaSignalingRoomId('mafia:abc')).toBe('mafia:abc')
  })

  it('strips namespace for display/URL from signaling id', () => {
    expect(mafiaBaseRoomIdFromSignaling('plain')).toBe('plain')
  })
})
