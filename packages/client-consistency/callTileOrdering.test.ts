import { describe, expect, it } from 'vitest'
import {
  buildFallbackOrderedTiles,
  buildHostLastOrderedTiles,
} from '@/composables/game-room/callTileOrdering'

type Tile = { peerId: string }

const t = (peerId: string): Tile => ({ peerId })

describe('buildHostLastOrderedTiles', () => {
  it('empty baseOrder + empty host: tiles preserve input array order', () => {
    const tiles = [t('c'), t('a'), t('b')]
    expect(buildHostLastOrderedTiles(tiles, [], '').map((x) => x.peerId)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('respects baseOrder for known peer ids', () => {
    const tiles = [t('p3'), t('p1'), t('p2')]
    expect(
      buildHostLastOrderedTiles(tiles, ['p1', 'p2', 'p3'], '').map((x) => x.peerId),
    ).toEqual(['p1', 'p2', 'p3'])
  })

  it('pins host last when host is in tiles but not in baseOrder', () => {
    const tiles = [t('host'), t('p1'), t('p2')]
    expect(
      buildHostLastOrderedTiles(tiles, ['p1', 'p2'], 'host').map((x) => x.peerId),
    ).toEqual(['p1', 'p2', 'host'])
  })

  it('keeps host position from baseOrder when host is listed there', () => {
    const tiles = [t('host'), t('a'), t('b')]
    expect(
      buildHostLastOrderedTiles(tiles, ['host', 'a', 'b'], 'host').map((x) => x.peerId),
    ).toEqual(['host', 'a', 'b'])
  })

  it('places late joiner (not in baseOrder) into extras before host', () => {
    const tiles = [t('p1'), t('p2'), t('late'), t('host')]
    expect(
      buildHostLastOrderedTiles(tiles, ['p1', 'p2'], 'host').map((x) => x.peerId),
    ).toEqual(['p1', 'p2', 'late', 'host'])
  })

  it('orders extras deterministically by tile-array order when host pid is empty', () => {
    const tiles = [t('late-c'), t('late-a'), t('p1')]
    expect(
      buildHostLastOrderedTiles(tiles, ['p1'], '').map((x) => x.peerId),
    ).toEqual(['p1', 'late-c', 'late-a'])
  })

  it('skips empty peer ids in baseOrder', () => {
    const tiles = [t('a'), t('b')]
    expect(
      buildHostLastOrderedTiles(tiles, ['', 'a', '', 'b'], '').map((x) => x.peerId),
    ).toEqual(['a', 'b'])
  })

  it('does not re-add duplicate peer ids in baseOrder', () => {
    const tiles = [t('a'), t('b'), t('c')]
    expect(
      buildHostLastOrderedTiles(tiles, ['a', 'b', 'a', 'c'], '').map((x) => x.peerId),
    ).toEqual(['a', 'b', 'c'])
  })

  it('host pinned last applies only to extras, not to baseOrder entries', () => {
    const tiles = [t('host'), t('a'), t('b'), t('late')]
    expect(
      buildHostLastOrderedTiles(tiles, ['host', 'a', 'b'], 'host').map((x) => x.peerId),
    ).toEqual(['host', 'a', 'b', 'late'])
  })
})

describe('buildFallbackOrderedTiles', () => {
  it('orders by tileOrder when spotlight inactive', () => {
    const tiles = [t('c'), t('a'), t('b')]
    expect(
      buildFallbackOrderedTiles(tiles, ['a', 'b', 'c'], null, false).map((x) => x.peerId),
    ).toEqual(['a', 'b', 'c'])
  })

  it('places spotlight-pinned peer first when spotlight active', () => {
    const tiles = [t('a'), t('b'), t('c')]
    expect(
      buildFallbackOrderedTiles(tiles, ['a', 'b', 'c'], 'c', true).map((x) => x.peerId),
    ).toEqual(['c', 'a', 'b'])
  })

  it('does not place pinned peer first when spotlight inactive', () => {
    const tiles = [t('a'), t('b'), t('c')]
    expect(
      buildFallbackOrderedTiles(tiles, ['a', 'b', 'c'], 'c', false).map((x) => x.peerId),
    ).toEqual(['a', 'b', 'c'])
  })

  it('does not place pinned peer first when pinnedPeerId is null even with spotlight', () => {
    const tiles = [t('a'), t('b'), t('c')]
    expect(
      buildFallbackOrderedTiles(tiles, ['a', 'b', 'c'], null, true).map((x) => x.peerId),
    ).toEqual(['a', 'b', 'c'])
  })

  it('peers missing from tileOrder go to tail with localeCompare tie-break', () => {
    const tiles = [t('extra-c'), t('extra-a'), t('a')]
    expect(
      buildFallbackOrderedTiles(tiles, ['a'], null, false).map((x) => x.peerId),
    ).toEqual(['a', 'extra-a', 'extra-c'])
  })

  it('stable on equal indices via localeCompare when no tileOrder', () => {
    const tiles = [t('b'), t('a')]
    expect(
      buildFallbackOrderedTiles(tiles, [], null, false).map((x) => x.peerId),
    ).toEqual(['a', 'b'])
  })
})
