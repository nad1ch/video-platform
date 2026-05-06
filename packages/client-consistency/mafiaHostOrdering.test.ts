import { describe, expect, it } from 'vitest'
import { mafiaNightActionMaxSeatForOrder, pinHostPeerToEndOfOrder } from '@/utils/mafiaHostOrdering'

describe('mafiaHostOrdering', () => {
  it('moves host peer id to the end', () => {
    expect(pinHostPeerToEndOfOrder(['h', 'a', 'b'], 'h')).toEqual(['a', 'b', 'h'])
  })

  it('no-ops when host already last', () => {
    expect(pinHostPeerToEndOfOrder(['a', 'b', 'h'], 'h')).toEqual(['a', 'b', 'h'])
  })

  it('no-ops when host unknown', () => {
    expect(pinHostPeerToEndOfOrder(['a', 'b'], 'x')).toEqual(['a', 'b'])
  })

  it('max night seat excludes trailing host', () => {
    expect(mafiaNightActionMaxSeatForOrder(['a', 'b', 'h'], 'h')).toBe(2)
  })

  it('max night seat is full order when host not last', () => {
    expect(mafiaNightActionMaxSeatForOrder(['a', 'h', 'b'], 'h')).toBe(3)
  })
})
