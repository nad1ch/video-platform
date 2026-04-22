import { describe, expect, it } from 'vitest'
import { computeMafiaLastNightResult } from '../../apps/client/src/utils/mafiaLastNightResult'

describe('computeMafiaLastNightResult', () => {
  it('returns null when mafia target is not set', () => {
    expect(computeMafiaLastNightResult({})).toBeNull()
    expect(computeMafiaLastNightResult({ doctor: 2 })).toBeNull()
  })

  it('same mafia and doctor seat: no death (saved)', () => {
    expect(computeMafiaLastNightResult({ mafia: 3, doctor: 3 })).toEqual({ saved: true })
  })

  it('different seats: mafia victim dies', () => {
    expect(computeMafiaLastNightResult({ mafia: 2, doctor: 5 })).toEqual({ died: 2, saved: false })
  })

  it('doctor unset: mafia victim dies', () => {
    expect(computeMafiaLastNightResult({ mafia: 4 })).toEqual({ died: 4, saved: false })
  })
})
