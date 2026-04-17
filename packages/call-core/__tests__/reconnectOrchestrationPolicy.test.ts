import { describe, expect, it } from 'vitest'
import {
  decideAfterDocumentBecameVisible,
  decideAfterSocketStatusChange,
  decideAfterWindowFocus,
  type OrchestrationInput,
  type WsStatus,
} from '../src/reconnectOrchestrationPolicy'

function baseInput(over: Partial<OrchestrationInput> = {}): OrchestrationInput {
  return {
    intentionalLeave: false,
    inCall: true,
    joining: false,
    wsStatus: 'open',
    reconnectTimerActive: false,
    ...over,
  }
}

describe('decideAfterSocketStatusChange', () => {
  it('noop on intentional leave', () => {
    expect(
      decideAfterSocketStatusChange('open', 'closed', baseInput({ intentionalLeave: true })),
    ).toEqual({ kind: 'noop' })
  })

  it('noop when not in call', () => {
    expect(decideAfterSocketStatusChange('open', 'closed', baseInput({ inCall: false }))).toEqual({
      kind: 'noop',
    })
  })

  it('noop when joining (avoid stacked reconnect)', () => {
    expect(decideAfterSocketStatusChange('open', 'closed', baseInput({ joining: true }))).toEqual({
      kind: 'noop',
    })
  })

  it('noop when reconnect timer already scheduled', () => {
    expect(
      decideAfterSocketStatusChange('open', 'closed', baseInput({ reconnectTimerActive: true })),
    ).toEqual({ kind: 'noop' })
  })

  it('schedule-reconnect when open → closed', () => {
    expect(decideAfterSocketStatusChange('open', 'closed', baseInput())).toEqual({
      kind: 'schedule-reconnect',
      reason: 'socket-not-open',
    })
  })

  it('schedule-reconnect when open → error', () => {
    expect(decideAfterSocketStatusChange('open', 'error', baseInput())).toEqual({
      kind: 'schedule-reconnect',
      reason: 'socket-not-open',
    })
  })

  it('noop when transition is not from open to closed/error', () => {
    expect(decideAfterSocketStatusChange('connecting', 'closed', baseInput())).toEqual({
      kind: 'noop',
    })
  })

  it('noop on WS flap (closed → connecting) without open→dead drop', () => {
    expect(decideAfterSocketStatusChange('closed', 'connecting', baseInput())).toEqual({
      kind: 'noop',
    })
  })

  it('noop on first watch tick (prev undefined)', () => {
    expect(decideAfterSocketStatusChange(undefined, 'open', baseInput())).toEqual({ kind: 'noop' })
  })
})

describe('decideAfterDocumentBecameVisible', () => {
  it('noop on intentional leave', () => {
    expect(decideAfterDocumentBecameVisible(baseInput({ intentionalLeave: true }))).toEqual({
      kind: 'noop',
    })
  })

  it('noop when not in call', () => {
    expect(decideAfterDocumentBecameVisible(baseInput({ inCall: false }))).toEqual({
      kind: 'noop',
    })
  })

  it('soft-resync when WS open', () => {
    expect(decideAfterDocumentBecameVisible(baseInput({ wsStatus: 'open' }))).toEqual({
      kind: 'soft-resync',
      source: 'visibility',
    })
  })

  it('schedule-reconnect when WS not open (backoff path)', () => {
    const dead: WsStatus[] = ['closed', 'error', 'connecting', 'idle']
    for (const wsStatus of dead) {
      expect(decideAfterDocumentBecameVisible(baseInput({ wsStatus }))).toEqual({
        kind: 'schedule-reconnect',
        reason: 'tab-visible-again',
      })
    }
  })

  it('tab visible + WS dead: schedule-reconnect only, never soft-resync (no conflicting paths)', () => {
    expect(decideAfterDocumentBecameVisible(baseInput({ wsStatus: 'closed' }))).toEqual({
      kind: 'schedule-reconnect',
      reason: 'tab-visible-again',
    })
    expect(decideAfterDocumentBecameVisible(baseInput({ wsStatus: 'open' })).kind).toBe('soft-resync')
  })

  it('tab visible + WS dead + joining: policy still schedules reconnect; executor may noop (duplicate guard)', () => {
    expect(
      decideAfterDocumentBecameVisible(
        baseInput({ wsStatus: 'closed', joining: true, reconnectTimerActive: false }),
      ),
    ).toEqual({ kind: 'schedule-reconnect', reason: 'tab-visible-again' })
  })
})

describe('decideAfterWindowFocus', () => {
  it('noop when WS not open (focus does not schedule reconnect)', () => {
    expect(decideAfterWindowFocus(baseInput({ wsStatus: 'closed' }))).toEqual({ kind: 'noop' })
  })

  it('soft-resync when WS open', () => {
    expect(decideAfterWindowFocus(baseInput({ wsStatus: 'open' }))).toEqual({
      kind: 'soft-resync',
      source: 'focus',
    })
  })
})
