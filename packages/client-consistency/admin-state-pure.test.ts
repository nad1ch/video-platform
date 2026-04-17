import { describe, expect, it } from 'vitest'
import {
  adminDatabaseConfiguredFromPayload,
  interpretAdminGetJson,
  streamerDeleteOutcome,
  streamerPostOutcome,
} from '@/admin/state/adminStatePure'

describe('interpretAdminGetJson', () => {
  it('tags forbidden', () => {
    expect(interpretAdminGetJson({ forbidden: true })).toEqual({ tag: 'forbidden' })
  })

  it('tags bad when notOk', () => {
    expect(interpretAdminGetJson({ forbidden: false, notOk: true })).toEqual({ tag: 'bad' })
  })

  it('tags bad when data is null', () => {
    expect(interpretAdminGetJson({ forbidden: false, notOk: false, data: null })).toEqual({ tag: 'bad' })
  })

  it('tags ok with data', () => {
    expect(interpretAdminGetJson({ forbidden: false, notOk: false, data: { x: 1 } })).toEqual({
      tag: 'ok',
      data: { x: 1 },
    })
  })
})

describe('streamerPostOutcome', () => {
  it('403 → forbidden', () => {
    expect(streamerPostOutcome({ status: 403, ok: false })).toBe('forbidden')
  })

  it('non-ok → save', () => {
    expect(streamerPostOutcome({ status: 500, ok: false })).toBe('save')
  })

  it('ok → ok', () => {
    expect(streamerPostOutcome({ status: 200, ok: true })).toBe('ok')
  })
})

describe('streamerDeleteOutcome', () => {
  it('403 → forbidden', () => {
    expect(streamerDeleteOutcome({ status: 403, ok: false })).toBe('forbidden')
  })

  it('204 with not ok still ok (idempotent delete)', () => {
    expect(streamerDeleteOutcome({ status: 204, ok: false })).toBe('ok')
  })

  it('other non-ok → save', () => {
    expect(streamerDeleteOutcome({ status: 500, ok: false })).toBe('save')
  })

  it('200 ok → ok', () => {
    expect(streamerDeleteOutcome({ status: 200, ok: true })).toBe('ok')
  })
})

describe('adminDatabaseConfiguredFromPayload', () => {
  it('true when missing or true', () => {
    expect(adminDatabaseConfiguredFromPayload(undefined)).toBe(true)
    expect(adminDatabaseConfiguredFromPayload(null)).toBe(true)
    expect(adminDatabaseConfiguredFromPayload({})).toBe(true)
    expect(adminDatabaseConfiguredFromPayload({ databaseConfigured: true })).toBe(true)
  })

  it('false only when explicitly false', () => {
    expect(adminDatabaseConfiguredFromPayload({ databaseConfigured: false })).toBe(false)
  })
})
