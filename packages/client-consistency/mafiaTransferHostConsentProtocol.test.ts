import { describe, expect, it } from 'vitest'

import {
  parseMafiaTransferHostPending,
  parseMafiaTransferHostResult,
} from '../../apps/client/src/composables/mafiaTransferHostConsentParsers'

/**
 * Wire-format contract for the two server-emitted Mafia transfer-host
 * consent frames (audit Finding I). Pins:
 *   - happy-path payloads parse;
 *   - any required-field anomaly returns `null`;
 *   - `outcome` is restricted to the four documented values.
 */

describe('parseMafiaTransferHostPending', () => {
  const valid = {
    type: 'mafia:transfer-host-pending',
    payload: {
      fromUserId: 'user-host',
      fromDisplayName: 'Host',
      expiresAt: 1_700_000_000_000,
    },
  }

  it('accepts a well-formed pending payload', () => {
    expect(parseMafiaTransferHostPending(valid)).toEqual({
      fromUserId: 'user-host',
      fromDisplayName: 'Host',
      expiresAt: 1_700_000_000_000,
    })
  })

  it('accepts a null fromDisplayName', () => {
    const out = parseMafiaTransferHostPending({
      ...valid,
      payload: { ...valid.payload, fromDisplayName: null },
    })
    expect(out?.fromDisplayName).toBeNull()
  })

  it('coerces empty-string fromDisplayName to null', () => {
    const out = parseMafiaTransferHostPending({
      ...valid,
      payload: { ...valid.payload, fromDisplayName: '' },
    })
    expect(out?.fromDisplayName).toBeNull()
  })

  it('rejects wrong type', () => {
    expect(parseMafiaTransferHostPending({ ...valid, type: 'something-else' })).toBeNull()
  })

  it('rejects missing payload', () => {
    expect(parseMafiaTransferHostPending({ type: 'mafia:transfer-host-pending' })).toBeNull()
  })

  it('rejects missing fromUserId', () => {
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { fromDisplayName: 'Host', expiresAt: 1 },
      }),
    ).toBeNull()
  })

  it('rejects empty fromUserId', () => {
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { ...valid.payload, fromUserId: '' },
      }),
    ).toBeNull()
  })

  it('rejects non-number expiresAt', () => {
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { ...valid.payload, expiresAt: '123' },
      }),
    ).toBeNull()
  })

  it('rejects non-finite expiresAt', () => {
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { ...valid.payload, expiresAt: Number.POSITIVE_INFINITY },
      }),
    ).toBeNull()
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { ...valid.payload, expiresAt: Number.NaN },
      }),
    ).toBeNull()
  })

  it('rejects zero or negative expiresAt', () => {
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { ...valid.payload, expiresAt: 0 },
      }),
    ).toBeNull()
    expect(
      parseMafiaTransferHostPending({
        ...valid,
        payload: { ...valid.payload, expiresAt: -1 },
      }),
    ).toBeNull()
  })

  it('rejects null / undefined / non-object input', () => {
    expect(parseMafiaTransferHostPending(null)).toBeNull()
    expect(parseMafiaTransferHostPending(undefined)).toBeNull()
    expect(parseMafiaTransferHostPending('mafia:transfer-host-pending')).toBeNull()
    expect(parseMafiaTransferHostPending(42)).toBeNull()
  })
})

describe('parseMafiaTransferHostResult', () => {
  const make = (outcome: unknown) => ({
    type: 'mafia:transfer-host-result',
    payload: { outcome },
  })

  it.each(['accepted', 'rejected', 'expired', 'cancelled'] as const)(
    'accepts outcome=%s',
    (outcome) => {
      expect(parseMafiaTransferHostResult(make(outcome))).toEqual({ outcome })
    },
  )

  it('rejects unknown outcome string', () => {
    expect(parseMafiaTransferHostResult(make('queued'))).toBeNull()
  })

  it('rejects non-string outcome', () => {
    expect(parseMafiaTransferHostResult(make(true))).toBeNull()
    expect(parseMafiaTransferHostResult(make(123))).toBeNull()
    expect(parseMafiaTransferHostResult(make(null))).toBeNull()
  })

  it('rejects wrong type', () => {
    expect(
      parseMafiaTransferHostResult({ type: 'mafia:host-updated', payload: { outcome: 'accepted' } }),
    ).toBeNull()
  })

  it('rejects missing payload', () => {
    expect(parseMafiaTransferHostResult({ type: 'mafia:transfer-host-result' })).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(parseMafiaTransferHostResult(null)).toBeNull()
    expect(parseMafiaTransferHostResult(undefined)).toBeNull()
    expect(parseMafiaTransferHostResult('mafia:transfer-host-result')).toBeNull()
  })
})
