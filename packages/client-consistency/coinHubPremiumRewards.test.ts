import { describe, expect, it } from 'vitest'
import {
  PREMIUM_PRO_MONTHLY_COINS,
  premiumMonthlyCoins,
} from '@/utils/coinHub/coinHubPremiumRewards'

describe('premiumMonthlyCoins', () => {
  it('grants 100 for Plus and 200 for Pro', () => {
    expect(premiumMonthlyCoins('plus')).toBe(100)
    expect(premiumMonthlyCoins('pro')).toBe(200)
    expect(PREMIUM_PRO_MONTHLY_COINS).toBe(200)
  })
})
