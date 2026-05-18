/**
 * Pure predicate for the configured CoinHub "open case" reward amount.
 *
 * Extracted from `coinHubService.openCase` so the contract that bypass mode
 * never mints a fallback amount can be pinned by a unit test without booting
 * Prisma. Returns `true` only for a finite positive number; anything else
 * (undefined, null, non-number, NaN, Infinity, 0, negative) is rejected.
 *
 * Callers are expected to translate `false` into a `CoinHubHttpError` —
 * keeping that translation in the service layer avoids dragging the
 * HTTP-error class into this pure helper.
 */
export function isValidCaseRewardAmount(rawReward: unknown): rawReward is number {
  return typeof rawReward === 'number' && Number.isFinite(rawReward) && rawReward > 0
}
