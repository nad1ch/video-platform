import { describe, expect, it } from 'vitest'

import { formatInboxErrorMessage } from '../../apps/server/src/billing/monoWebhookInbox'

/**
 * Regression guard for the audit Batch G fix. The webhook handler now writes
 * the raw payload to `MonoWebhookInbox` before attempting `ingestStatementWebhook`.
 * When the inline call throws, `formatInboxErrorMessage` clamps the human-readable
 * error string that is written to `lastError` so a malicious / very long throw
 * cannot blow up the row. This pure helper is the only thing in that module
 * that does not touch Prisma; pinning its behavior here is the cheapest way to
 * lock the contract.
 */
describe('formatInboxErrorMessage', () => {
  it('uses name + message for Error instances', () => {
    const err = new TypeError('parse blew up')
    expect(formatInboxErrorMessage(err)).toBe('TypeError: parse blew up')
  })

  it('trims trailing whitespace and handles empty messages', () => {
    const err = new Error('')
    expect(formatInboxErrorMessage(err)).toBe('Error:')
  })

  it('caps very long error messages to 1000 characters', () => {
    const longBody = 'x'.repeat(2000)
    const err = new Error(longBody)
    const out = formatInboxErrorMessage(err)
    expect(out.length).toBe(1000)
    expect(out.startsWith('Error: xxx')).toBe(true)
  })

  it('preserves plain string throws', () => {
    expect(formatInboxErrorMessage('boom')).toBe('boom')
  })

  it('caps long plain string throws to 1000 characters', () => {
    const longString = 'a'.repeat(2000)
    const out = formatInboxErrorMessage(longString)
    expect(out.length).toBe(1000)
  })

  it('falls back to "unknown" for non-string non-Error throws', () => {
    expect(formatInboxErrorMessage(null)).toBe('unknown')
    expect(formatInboxErrorMessage(undefined)).toBe('unknown')
    expect(formatInboxErrorMessage(42)).toBe('unknown')
    expect(formatInboxErrorMessage({ what: 'object' })).toBe('unknown')
  })
})
