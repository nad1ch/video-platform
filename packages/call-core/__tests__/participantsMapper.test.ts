import { describe, expect, it } from 'vitest'
import {
  buildCallParticipantMap,
  mapTilesToParticipants,
  resolveParticipantDisplayName,
} from '../src/utils/participantsMapper'

function mockStreamWithTracks(
  tracks: Array<{ kind: 'audio' | 'video' }>,
): MediaStream {
  return {
    getTracks() {
      return tracks as MediaStreamTrack[]
    },
  } as MediaStream
}

describe('mapTilesToParticipants', () => {
  it('maps a single tile', () => {
    const stream = mockStreamWithTracks([{ kind: 'audio' }, { kind: 'video' }])
    const tiles = [{ peerId: 'p1', displayName: 'Alice', stream, isLocal: false }]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.size).toBe(1)
    expect(map.get('p1')).toMatchObject({
      peerId: 'p1',
      displayName: 'Alice',
      isLocal: false,
    })
    expect(map.get('p1')?.audioTrack).toBeDefined()
    expect(map.get('p1')?.videoTrack).toBeDefined()
  })

  it('maps multiple peers', () => {
    const tiles = [
      { peerId: 'a', displayName: 'A', stream: null, isLocal: true },
      { peerId: 'b', displayName: 'B', stream: null, isLocal: false },
    ]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.size).toBe(2)
    expect(map.get('a')?.displayName).toBe('A')
    expect(map.get('b')?.displayName).toBe('B')
  })

  it('uses remoteDisplayNames when tile displayName is empty (remote)', () => {
    const tiles = [{ peerId: 'remote-1', displayName: '', stream: null, isLocal: false }]
    const names = { 'remote-1': '  Carol  ' }
    const map = mapTilesToParticipants(tiles, names)
    expect(map.get('remote-1')?.displayName).toBe('Carol')
  })

  it('uses "You" for local when tile name empty', () => {
    const tiles = [{ peerId: 'self', displayName: '   ', stream: null, isLocal: true }]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.get('self')?.displayName).toBe('You')
  })

  it('falls back to Guest label when remote name missing', () => {
    const tiles = [{ peerId: 'xyz789012', displayName: '', stream: null, isLocal: false }]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.get('xyz789012')?.displayName).toBe('Guest 789012')
  })

  it('returns empty map for empty tiles', () => {
    expect(mapTilesToParticipants([], {}).size).toBe(0)
    expect(mapTilesToParticipants([], { x: 'y' }).size).toBe(0)
  })

  it('defaults isLocal to false when omitted (treated as remote)', () => {
    const tiles = [{ peerId: 'r', displayName: '', stream: null }]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.get('r')?.isLocal).toBe(false)
    expect(map.get('r')?.displayName).toMatch(/^Guest/)
  })

  it('last tile wins for duplicate peerId in the input array', () => {
    const tiles = [
      { peerId: '1', displayName: 'First', stream: null, isLocal: false },
      { peerId: '1', displayName: 'Second', stream: null, isLocal: false },
    ]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.size).toBe(1)
    expect(map.get('1')?.displayName).toBe('Second')
  })

  it('treats whitespace-only tile displayName as empty (uses remote or Guest)', () => {
    const tiles = [{ peerId: 'z', displayName: '   ', stream: null, isLocal: false }]
    expect(mapTilesToParticipants(tiles, { z: 'Zoe' }).get('z')?.displayName).toBe('Zoe')
    expect(mapTilesToParticipants(tiles, {}).get('z')?.displayName).toMatch(/^Guest/)
  })

  it('marks local participant with isLocal true', () => {
    const tiles = [{ peerId: 'me', displayName: 'Local', stream: null, isLocal: true }]
    expect(mapTilesToParticipants(tiles, {}).get('me')?.isLocal).toBe(true)
  })
})

describe('mapTilesToParticipants (streams)', () => {
  it('uses stream.getTracks() and keeps last track per kind when multiple exist', () => {
    const tracks = [
      { kind: 'audio' } as MediaStreamTrack,
      { kind: 'video' } as MediaStreamTrack,
      { kind: 'video' } as MediaStreamTrack,
    ]
    const stream = {
      getTracks() {
        return tracks
      },
    } as MediaStream
    const tiles = [{ peerId: 'p', displayName: 'M', stream, isLocal: false }]
    const map = mapTilesToParticipants(tiles, {})
    expect(map.get('p')?.videoTrack).toBe(tracks[2])
  })
})

describe('buildCallParticipantMap', () => {
  it('adds remote-only peers not yet on tiles', () => {
    const tiles = [{ peerId: 'local', displayName: 'Me', stream: null, isLocal: true }]
    const remote = { onlyRemote: 'Sam' }
    const map = buildCallParticipantMap(tiles, remote, 'local')
    expect(map.get('onlyRemote')?.displayName).toBe('Sam')
    expect(map.get('local')?.displayName).toBe('Me')
  })

  it('does not duplicate tile peers', () => {
    const tiles = [{ peerId: 'a', displayName: 'A', stream: null, isLocal: false }]
    const remote = { a: 'FromRemote' }
    expect(buildCallParticipantMap(tiles, remote, 'self').get('a')?.displayName).toBe('A')
  })
})

describe('resolveParticipantDisplayName', () => {
  it('prefers non-empty tile string', () => {
    expect(resolveParticipantDisplayName('p', 'Tile', false, { p: 'Remote' })).toBe('Tile')
  })

  it('uses remote map when tile empty', () => {
    expect(resolveParticipantDisplayName('p', '', false, { p: 'Server' })).toBe('Server')
  })
})
