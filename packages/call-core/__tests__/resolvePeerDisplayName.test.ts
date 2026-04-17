import { describe, expect, it } from 'vitest'
import { buildCallParticipantMap, mapTilesToParticipants } from '../src/utils/participantsMapper'
import {
  buildDisplayNameUiMap,
  resolvePeerDisplayNameForUi,
} from '../src/utils/resolvePeerDisplayName'

const uiOpts = (selfId: string) => ({
  selfPeerId: selfId,
  selfDisplayName: 'Local You',
})

describe('resolvePeerDisplayNameForUi', () => {
  it('uses participant displayName when present', () => {
    const tiles = [{ peerId: 'a', displayName: 'Ann', stream: null, isLocal: false }]
    const map = mapTilesToParticipants(tiles, {})
    expect(resolvePeerDisplayNameForUi('a', map, uiOpts('self'))).toBe('Ann')
  })

  it('uses remote-only row from buildCallParticipantMap', () => {
    const map = buildCallParticipantMap([], { z: 'Zed' }, 'self')
    expect(resolvePeerDisplayNameForUi('z', map, uiOpts('self'))).toBe('Zed')
  })

  it('falls back to guest id when peer missing from map', () => {
    const map = buildCallParticipantMap([], {}, 'self')
    expect(resolvePeerDisplayNameForUi('x', map, uiOpts('self'))).toBe('Guest x')
  })

  it('uses self fallback when local row missing', () => {
    const map = buildCallParticipantMap([], {}, 'me')
    expect(resolvePeerDisplayNameForUi('me', map, { selfPeerId: 'me', selfDisplayName: '  ' })).toBe('You')
  })
})

describe('buildDisplayNameUiMap', () => {
  it('matches per-peer resolvePeerDisplayNameForUi for every key', () => {
    const tiles = [
      { peerId: 'a', displayName: 'Ann', stream: null, isLocal: false },
      { peerId: 'me', displayName: '', stream: null, isLocal: true },
    ]
    const map = buildCallParticipantMap(tiles, { b: 'Bob' }, 'me')
    const opts = { selfPeerId: 'me', selfDisplayName: 'Local' }
    const ui = buildDisplayNameUiMap(map, opts)
    for (const peerId of map.keys()) {
      expect(ui.get(peerId)).toBe(resolvePeerDisplayNameForUi(peerId, map, opts))
    }
  })
})
