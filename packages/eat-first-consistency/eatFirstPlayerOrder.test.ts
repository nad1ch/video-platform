import { describe, expect, it } from 'vitest'
import {
  deriveEatFirstDefaultPlayerOrder,
  eatFirstPlayerOrderFromUnknown,
  getEatFirstHostDisplaySeat,
  getEatFirstPlayerDisplaySeat,
  isEatFirstPlayerOrderPermutationOfAllowed,
  isEatFirstPlayerSlotId,
  resolveEatFirstEffectivePlayerOrder,
} from '../../apps/server/src/eatFirst/playerOrder'

describe('eatFirst playerOrder / display seats', () => {
  it('accepts p1..p11 and rejects p0, p12, p99', () => {
    expect(isEatFirstPlayerSlotId('p1')).toBe(true)
    expect(isEatFirstPlayerSlotId('p11')).toBe(true)
    expect(isEatFirstPlayerSlotId('p0')).toBe(false)
    expect(isEatFirstPlayerSlotId('p12')).toBe(false)
    expect(isEatFirstPlayerSlotId('p99')).toBe(false)
  })

  it('rejects playerOrder longer than allowed set / max players', () => {
    const allowed = new Set(['p1', 'p2'])
    expect(isEatFirstPlayerOrderPermutationOfAllowed(['p1', 'p2', 'p1'], allowed)).toBe(false)
    const allowed11 = new Set(Array.from({ length: 11 }, (_, i) => `p${i + 1}`))
    const order11 = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    expect(isEatFirstPlayerOrderPermutationOfAllowed(order11, allowed11)).toBe(true)
    expect(isEatFirstPlayerOrderPermutationOfAllowed([...order11, 'p1'], allowed11)).toBe(false)
  })

  it('rejects duplicate entries in playerOrder', () => {
    const order = ['p1', 'p1']
    const allowed = new Set(['p1', 'p2'])
    expect(isEatFirstPlayerOrderPermutationOfAllowed(order, allowed)).toBe(false)
    expect(eatFirstPlayerOrderFromUnknown(['p1', 'p1'])).toBe(null)
  })

  it('rejects p12 as a playerOrder entry', () => {
    expect(eatFirstPlayerOrderFromUnknown(['p1', 'p12'])).toBe(null)
  })

  it('host display seat N+1 for N = 0,1,5,11', () => {
    expect(getEatFirstHostDisplaySeat([])).toBe(1)
    expect(getEatFirstHostDisplaySeat(['p1'])).toBe(2)
    expect(getEatFirstHostDisplaySeat(['p1', 'p2', 'p3', 'p4', 'p5'])).toBe(6)
    expect(
      getEatFirstHostDisplaySeat(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11']),
    ).toBe(12)
  })

  it('getEatFirstPlayerDisplaySeat returns 1..N or null', () => {
    const order = ['p5', 'p1', 'p2']
    expect(getEatFirstPlayerDisplaySeat(order, 'p5')).toBe(1)
    expect(getEatFirstPlayerDisplaySeat(order, 'p1')).toBe(2)
    expect(getEatFirstPlayerDisplaySeat(order, 'p9')).toBe(null)
  })

  it('legacy: missing playerOrder falls back to sorted allowed ids', () => {
    const allowed = new Set(['p3', 'p1'])
    expect(resolveEatFirstEffectivePlayerOrder(undefined, allowed)).toEqual(['p1', 'p3'])
    expect(resolveEatFirstEffectivePlayerOrder(null, allowed)).toEqual(['p1', 'p3'])
  })

  it('uses stored playerOrder when it is a full permutation of allowed', () => {
    const allowed = new Set(['p1', 'p2'])
    expect(resolveEatFirstEffectivePlayerOrder(['p2', 'p1'], allowed)).toEqual(['p2', 'p1'])
  })

  it('deriveEatFirstDefaultPlayerOrder sorts numerically', () => {
    expect(deriveEatFirstDefaultPlayerOrder(new Set(['p10', 'p2', 'p1']))).toEqual(['p1', 'p2', 'p10'])
  })
})
