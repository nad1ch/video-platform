import { describe, expect, it } from 'vitest'
import {
  remapEatFirstSpeakingQueueForSwap,
  swapEatFirstPlayerOrder,
} from '@/eat-first/utils/eatFirstPlayerOrderSwap'

describe('swapEatFirstPlayerOrder', () => {
  it('swaps two non-adjacent slot positions', () => {
    expect(swapEatFirstPlayerOrder(['p1', 'p2', 'p3'], 'p1', 'p3')).toEqual([
      'p3',
      'p2',
      'p1',
    ])
  })

  it('swaps two adjacent slot positions', () => {
    expect(swapEatFirstPlayerOrder(['p1', 'p2', 'p3'], 'p1', 'p2')).toEqual([
      'p2',
      'p1',
      'p3',
    ])
  })

  it('identical slot ids → no-op, returns same reference', () => {
    const order = ['p1', 'p2', 'p3']
    expect(swapEatFirstPlayerOrder(order, 'p2', 'p2')).toBe(order)
  })

  it('missing slotA → no-op, returns same reference', () => {
    const order = ['p1', 'p2', 'p3']
    expect(swapEatFirstPlayerOrder(order, 'p99', 'p2')).toBe(order)
  })

  it('missing slotB → no-op, returns same reference', () => {
    const order = ['p1', 'p2', 'p3']
    expect(swapEatFirstPlayerOrder(order, 'p1', 'p99')).toBe(order)
  })

  it('preserves length', () => {
    const out = swapEatFirstPlayerOrder(['p1', 'p2', 'p3', 'p4'], 'p1', 'p4')
    expect(out).toHaveLength(4)
  })

  it('on a real swap, returns a new array and does NOT mutate the input', () => {
    const order = ['p1', 'p2', 'p3']
    const out = swapEatFirstPlayerOrder(order, 'p1', 'p3')
    expect(out).not.toBe(order)
    expect(order).toEqual(['p1', 'p2', 'p3'])
  })

  it('swap with `p11` (max slot id)', () => {
    expect(swapEatFirstPlayerOrder(['p1', 'p11'], 'p1', 'p11')).toEqual([
      'p11',
      'p1',
    ])
  })

  it('only swaps positions; intermediate slots untouched', () => {
    expect(
      swapEatFirstPlayerOrder(['p1', 'p2', 'p3', 'p4', 'p5'], 'p1', 'p5'),
    ).toEqual(['p5', 'p2', 'p3', 'p4', 'p1'])
  })
})

describe('remapEatFirstSpeakingQueueForSwap', () => {
  it('swaps every occurrence of seatA <-> seatB (pair-encoded queue)', () => {
    // pre-swap pairs: (1→3) (2→1)
    // after seat 1<->3 swap: (3→1) (2→3)
    expect(remapEatFirstSpeakingQueueForSwap([1, 3, 2, 1], 1, 3)).toEqual([
      3, 1, 2, 3,
    ])
  })

  it('identical seats → no-op, returns same reference', () => {
    const q = [1, 2, 3]
    expect(remapEatFirstSpeakingQueueForSwap(q, 2, 2)).toBe(q)
  })

  it('queue with no references to either seat → no-op, returns same reference', () => {
    const q = [4, 5, 6]
    expect(remapEatFirstSpeakingQueueForSwap(q, 1, 2)).toBe(q)
  })

  it('queue with references to only seatA still triggers remap (one-direction)', () => {
    expect(remapEatFirstSpeakingQueueForSwap([1, 4, 1, 5], 1, 3)).toEqual([
      3, 4, 3, 5,
    ])
  })

  it('queue with references to only seatB still triggers remap (one-direction)', () => {
    expect(remapEatFirstSpeakingQueueForSwap([4, 3, 5], 1, 3)).toEqual([4, 1, 5])
  })

  it('preserves queue length', () => {
    expect(remapEatFirstSpeakingQueueForSwap([1, 2, 3, 4], 1, 4)).toHaveLength(4)
  })

  it('preserves pair structure across multiple nominations', () => {
    // (1→2) (3→4) → swap 2<->4 → (1→4) (3→2)
    expect(remapEatFirstSpeakingQueueForSwap([1, 2, 3, 4], 2, 4)).toEqual([
      1, 4, 3, 2,
    ])
  })

  it('on a real remap, returns a new array and does NOT mutate the input', () => {
    const q = [1, 3, 2, 1]
    const out = remapEatFirstSpeakingQueueForSwap(q, 1, 3)
    expect(out).not.toBe(q)
    expect(q).toEqual([1, 3, 2, 1])
  })

  it('empty queue → empty queue (idempotent on empty)', () => {
    const q: readonly number[] = []
    expect(remapEatFirstSpeakingQueueForSwap(q, 1, 3)).toBe(q)
  })
})
