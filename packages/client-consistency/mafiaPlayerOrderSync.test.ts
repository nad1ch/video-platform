import { describe, expect, it } from 'vitest'
import { syncMafiaJoinOrder } from '../../apps/client/src/utils/mafiaPlayerOrderSync'

describe('syncMafiaJoinOrder', () => {
  it('new room: order follows first engine list appearance', () => {
    const r = syncMafiaJoinOrder({
      roomKey: 'a',
      previousRoomKey: '',
      previousOrder: ['x'],
      enginePeerOrder: ['p2', 'p1', 'p2', 'p1', 'p3'],
    })
    expect(r.roomKey).toBe('a')
    expect(r.joinOrder).toEqual(['p2', 'p1', 'p3'])
  })

  it('same room: drop leavers, keep order; append new in engine list order', () => {
    const r1 = syncMafiaJoinOrder({
      roomKey: 'room',
      previousRoomKey: 'room',
      previousOrder: ['a', 'b', 'c'],
      enginePeerOrder: ['a', 'b', 'c'],
    })
    expect(r1.joinOrder).toEqual(['a', 'b', 'c'])

    const r2 = syncMafiaJoinOrder({
      roomKey: 'room',
      previousRoomKey: 'room',
      previousOrder: r1.joinOrder,
      enginePeerOrder: ['b', 'a'],
    })
    expect(r2.joinOrder).toEqual(['a', 'b'])

    const r3 = syncMafiaJoinOrder({
      roomKey: 'room',
      previousRoomKey: 'room',
      previousOrder: r2.joinOrder,
      enginePeerOrder: ['b', 'a', 'c', 'd'],
    })
    expect(r3.joinOrder).toEqual(['a', 'b', 'c', 'd'])
  })

  it('room key change: resets previous order and rebuilds from engine list', () => {
    const r = syncMafiaJoinOrder({
      roomKey: 'new',
      previousRoomKey: 'old',
      previousOrder: ['a', 'b'],
      enginePeerOrder: ['z', 'y'],
    })
    expect(r.joinOrder).toEqual(['z', 'y'])
  })
})
