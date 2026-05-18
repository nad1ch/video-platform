import { describe, expect, it } from 'vitest'

import { isValidCaseRewardAmount } from '../../apps/server/src/coinHub/caseRewardValidator'

/**
 * Regression guard for the audit fix in `coinHubService.openCase` that closed
 * a dev-only bypass affordance: previously, a `bypass=true` open of a case
 * whose `CASE_OPEN_REWARD[caseId]` was undefined or non-positive minted an
 * implicit fallback amount of `1`. The validator below is the single
 * server-side gate; bypass mode now also fails closed when the reward is
 * absent or invalid (caller throws `CoinHubHttpError 409 CASE_LOCKED`).
 */
describe('isValidCaseRewardAmount', () => {
  it('accepts positive integers', () => {
    expect(isValidCaseRewardAmount(1)).toBe(true)
    expect(isValidCaseRewardAmount(50)).toBe(true)
  })

  it('accepts positive non-integer numbers', () => {
    expect(isValidCaseRewardAmount(2.5)).toBe(true)
  })

  it('rejects zero and negative numbers', () => {
    expect(isValidCaseRewardAmount(0)).toBe(false)
    expect(isValidCaseRewardAmount(-1)).toBe(false)
    expect(isValidCaseRewardAmount(-0.5)).toBe(false)
  })

  it('rejects non-number values (undefined, null, string, boolean, object)', () => {
    expect(isValidCaseRewardAmount(undefined)).toBe(false)
    expect(isValidCaseRewardAmount(null)).toBe(false)
    expect(isValidCaseRewardAmount('5')).toBe(false)
    expect(isValidCaseRewardAmount(true)).toBe(false)
    expect(isValidCaseRewardAmount({})).toBe(false)
  })

  it('rejects non-finite numbers (NaN, ±Infinity)', () => {
    expect(isValidCaseRewardAmount(NaN)).toBe(false)
    expect(isValidCaseRewardAmount(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isValidCaseRewardAmount(Number.NEGATIVE_INFINITY)).toBe(false)
  })
})
