/**
 * Wordle public barrel for app code that intentionally pulls the full surface (e.g. re-exports).
 *
 * Pages, Vue components, and `composables/useWordle*` must import from `@/wordle/wordleApi`,
 * `@/wordle/wordleLogic`, `@/wordle/ws`, or `@/composables/useWordle*` — not from `@/wordle` — to avoid circular graphs.
 */
export {
  fetchLeaderboardRating,
  fetchLeaderboardStreak,
  fetchLeaderboardWins,
  postWordleWin,
  requestWordlePublicConfig,
  type WordleGlobalRatingRow,
  type WordleGlobalStreakRow,
  type WordleGlobalWinsRow,
  type WordlePublicConfigPayload,
  type WordlePublicConfigResult,
} from './wordleApi'

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
} from './wordleLogic'

export {
  useWordleWs,
  WordleWs,
  type WordleChatLine,
  type WordleGamePlayer,
  type WordleGameStatePayload,
  type WordleGuessRow,
  type WordleIrcRelayState,
  type WordleLeaderboardEntry,
  type WordleStreamSessionUser,
  type WordleWsConnectionState,
} from './ws'

export { useWordleGlobalLeaderboard } from '@/composables/useWordleGlobalLeaderboard'
export { useWordleLeaderboardSelfName } from '@/composables/useWordleLeaderboardSelfName'
export { useWordleState } from '@/composables/useWordleState'
export { useWordleStatusBanners } from '@/composables/useWordleStatusBanners'
export { useWordleStreamerRoom, type WordleStreamerCard } from '@/composables/useWordleStreamerRoom'
