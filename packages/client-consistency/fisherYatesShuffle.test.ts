import { describe, expect, it } from 'vitest'
import { fisherYatesShuffle } from '../../apps/client/src/utils/fisherYatesShuffle'

describe('fisherYatesShuffle', () => {
  it('returns a permutation of the same length and multiset', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const s = fisherYatesShuffle(a)
    expect(s).toHaveLength(a.length)
    expect(s.slice().sort((x, y) => x - y)).toEqual(a.slice().sort((x, y) => x - y))
  })

  it('does not mutate the input array', () => {
    const a = [1, 2, 3, 4, 5]
    const c = a.slice()
    const s = fisherYatesShuffle(a)
    void s
    expect(a).toEqual(c)
  })
})
