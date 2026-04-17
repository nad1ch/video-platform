import { describe, expect, it, vi } from 'vitest'
import { replyJsonPingIfNeeded } from '../call-core/src/utils/jsonWsPing'

describe('replyJsonPingIfNeeded', () => {
  it('returns false and does not send for non-ping payloads', () => {
    const send = vi.fn()
    const ws = { send } as Pick<WebSocket, 'send'>

    expect(replyJsonPingIfNeeded(null, ws as WebSocket)).toBe(false)
    expect(replyJsonPingIfNeeded(undefined, ws as WebSocket)).toBe(false)
    expect(replyJsonPingIfNeeded('text', ws as WebSocket)).toBe(false)
    expect(replyJsonPingIfNeeded({ type: 'pong' }, ws as WebSocket)).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('returns true and sends pong JSON for ping', () => {
    const send = vi.fn()
    const ws = { send } as Pick<WebSocket, 'send'>

    expect(replyJsonPingIfNeeded({ type: 'ping' }, ws as WebSocket)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBe(JSON.stringify({ type: 'pong' }))
  })

  it('returns true and swallows send errors', () => {
    const ws = { send: () => { throw new Error('closed') } } as Pick<WebSocket, 'send'>

    expect(replyJsonPingIfNeeded({ type: 'ping' }, ws as WebSocket)).toBe(true)
  })
})
