/**
 * Nadle public barrel for app code that intentionally pulls the full surface (e.g. re-exports).
 *
 * Pages, Vue components, and `composables/useNadle*` should import from `@/nadle/nadleApi`,
 * `@/nadle/nadleLogic`, `@/nadle/ws`, or `@/composables/useNadle*` — not from `@/nadle` — to avoid circular graphs.
 */
export {
  fetchLeaderboardRating,
  fetchLeaderboardStreak,
  type FetchLeaderboardStreakResult,
  fetchLeaderboardWins,
  postNadleWin,
  requestNadlePublicConfig,
  type NadleGlobalRatingRow,
  type NadleGlobalStreakRow,
  type NadleGlobalWinsRow,
  type NadlePublicConfigPayload,
  type NadlePublicConfigResult,
} from './nadleApi'

export {
  MAX_ATTEMPTS,
  WORD_LENGTH_OPTIONS,
  computeFeedback,
  isAllowedGuess,
  normalizeWord,
  randomWord,
  wordGraphemeCount,
  type Feedback,
  type LocalGuessRow,
  type WordLength,
} from './nadleLogic'

export {
  useNadleWs,
  NadleWs,
  type NadleChatLine,
  type NadleGamePlayer,
  type NadleGameStatePayload,
  type NadleGuessRow,
  type NadleIrcRelayState,
  type NadleLeaderboardEntry,
  type NadleStreamSessionUser,
  type NadleWsConnectionState,
} from './ws'

export { useNadleGlobalLeaderboard } from '@/composables/useNadleGlobalLeaderboard'
export { useNadleState } from '@/composables/useNadleState'
export { useNadleStatusBanners } from '@/composables/useNadleStatusBanners'
export { useNadleStreamerRoom, type NadleStreamerCard } from '@/composables/useNadleStreamerRoom'
