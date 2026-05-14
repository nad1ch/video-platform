import { describe, expect, it } from 'vitest'
import { createSignalingRoomHelpers } from '@/composables/game-room/createSignalingRoomHelpers'

describe('createSignalingRoomHelpers', () => {
  it('prefixes mafia: signaling and round-trips', () => {
    const h = createSignalingRoomHelpers('mafia:')
    expect(h.signalingRoomId('abc')).toBe('mafia:abc')
    expect(h.baseRoomIdFromSignaling('mafia:abc')).toBe('abc')
  })

  it('prefixes gameroom: signaling and round-trips', () => {
    const h = createSignalingRoomHelpers('gameroom:')
    expect(h.signalingRoomId('abc')).toBe('gameroom:abc')
    expect(h.baseRoomIdFromSignaling('gameroom:abc')).toBe('abc')
  })

  it('prefixes eat: signaling and round-trips', () => {
    const h = createSignalingRoomHelpers('eat:')
    expect(h.signalingRoomId('abc')).toBe('eat:abc')
    expect(h.baseRoomIdFromSignaling('eat:abc')).toBe('abc')
  })

  it('idempotent when base already includes the prefix', () => {
    const h = createSignalingRoomHelpers('mafia:')
    expect(h.signalingRoomId('mafia:abc')).toBe('mafia:abc')
  })

  it('empty input collapses to demo', () => {
    const h = createSignalingRoomHelpers('eat:')
    expect(h.signalingRoomId('')).toBe('eat:demo')
    expect(h.signalingRoomId('   ')).toBe('eat:demo')
  })

  it('baseRoomIdFromSignaling strips only the matching prefix', () => {
    const h = createSignalingRoomHelpers('mafia:')
    expect(h.baseRoomIdFromSignaling('plain')).toBe('plain')
  })

  it('baseRoomIdFromSignaling collapses an empty tail to demo', () => {
    const h = createSignalingRoomHelpers('mafia:')
    expect(h.baseRoomIdFromSignaling('mafia:')).toBe('demo')
  })

  it('same base produces distinct signaling room ids per prefix', () => {
    const mafia = createSignalingRoomHelpers('mafia:')
    const gameroom = createSignalingRoomHelpers('gameroom:')
    const eat = createSignalingRoomHelpers('eat:')
    expect(mafia.signalingRoomId('abc')).toBe('mafia:abc')
    expect(gameroom.signalingRoomId('abc')).toBe('gameroom:abc')
    expect(eat.signalingRoomId('abc')).toBe('eat:abc')
    expect(
      new Set([
        mafia.signalingRoomId('abc'),
        gameroom.signalingRoomId('abc'),
        eat.signalingRoomId('abc'),
      ]).size,
    ).toBe(3)
  })
})
