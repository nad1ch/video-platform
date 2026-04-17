import { describe, expect, it, vi } from 'vitest'
import { createRecvApplySerialQueue } from '../src/media/recvApplySerialQueue'

describe('createRecvApplySerialQueue', () => {
  it('runs jobs strictly one after another', async () => {
    const order: string[] = []
    const q = createRecvApplySerialQueue(() => {})

    const p1 = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 8))
      order.push('a')
    })
    const p2 = q.enqueue(async () => {
      order.push('b')
    })
    await Promise.all([p1, p2])
    expect(order).toEqual(['a', 'b'])
  })

  it('logs errors and continues the chain', async () => {
    const log = vi.fn()
    const q = createRecvApplySerialQueue(log)
    const order: number[] = []

    await q.enqueue(async () => {
      throw new Error('boom')
    }).catch(() => {})

    await q.enqueue(async () => {
      order.push(1)
    })

    expect(log).toHaveBeenCalled()
    expect(order).toEqual([1])
  })

  it('reset clears the tail so a new session starts fresh', async () => {
    const q = createRecvApplySerialQueue(() => {})
    let n = 0
    await q.enqueue(async () => {
      n = 1
    })
    q.reset()
    await q.enqueue(async () => {
      n = 2
    })
    expect(n).toBe(2)
  })
})
