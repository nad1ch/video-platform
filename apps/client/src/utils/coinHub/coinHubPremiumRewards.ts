/** Client-only premium “monthly” grant until real payments (Coin Hub). */
export const PREMIUM_PLUS_MONTHLY_COINS = 100
export const PREMIUM_PRO_MONTHLY_COINS = 200

export function premiumMonthlyCoins(plan: 'plus' | 'pro'): number {
  if (plan === 'pro') {
    return PREMIUM_PRO_MONTHLY_COINS
  }
  return PREMIUM_PLUS_MONTHLY_COINS
}
