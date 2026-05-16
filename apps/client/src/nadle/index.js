/**
 * Nadle public barrel for app code that intentionally pulls the full surface (e.g. re-exports).
 *
 * Pages, Vue components, and `composables/useNadle*` should import from `@/nadle/nadleApi`,
 * `@/nadle/nadleLogic`, `@/nadle/ws`, or `@/composables/useNadle*` — not from `@/nadle` — to avoid circular graphs.
 */
export { fetchLeaderboardRating, fetchLeaderboardStreak, fetchLeaderboardWins, requestNadlePublicConfig, } from './nadleApi';
export { MAX_ATTEMPTS, WORD_LENGTH_OPTIONS, computeFeedback, isAllowedGuess, normalizeWord, randomWord, wordGraphemeCount, } from './nadleLogic';
export { useNadleWs, NadleWs, } from './ws';
export { useNadleGlobalLeaderboard } from '@/composables/useNadleGlobalLeaderboard';
export { useNadleState } from '@/composables/useNadleState';
export { useNadleStatusBanners } from '@/composables/useNadleStatusBanners';
export { useNadleStreamerRoom } from '@/composables/useNadleStreamerRoom';
