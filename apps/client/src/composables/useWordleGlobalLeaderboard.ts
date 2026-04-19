import { computed, ref, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppUser } from '@/composables/useAuth'
import {
  fetchLeaderboardRating,
  fetchLeaderboardStreak,
  fetchLeaderboardWins,
  type WordleGlobalRatingRow,
  type WordleGlobalStreakRow,
  type WordleGlobalWinsRow,
} from '@/wordle/wordleApi'
import type { WordleStreamerCard } from '@/composables/useWordleStreamerRoom'
import type { WordleGlobalLeaderboardRowVm } from '@/components/wordle/WordleGlobalLeaderboardTable.vue'

export function useWordleGlobalLeaderboard(options: {
  streamerProfile: ShallowRef<WordleStreamerCard | null>
  effectiveWordleSlug: ComputedRef<string | null>
  user: Ref<AppUser | null>
}) {
  const { t, locale } = useI18n()
  const { streamerProfile, effectiveWordleSlug, user } = options

  const globalLbTab = ref<'wins' | 'streak' | 'rating'>('rating')
  const globalLbWinsRows = ref<WordleGlobalWinsRow[]>([])
  const globalLbStreakRows = ref<WordleGlobalStreakRow[]>([])
  /** Set only after a successful streak fetch; `undefined` while not loaded on streak tab. */
  const globalLbViewerMaxStreak = ref<number | undefined>(undefined)
  const globalLbRatingRows = ref<WordleGlobalRatingRow[]>([])
  const globalLbLoading = ref(false)
  const globalLbError = ref<string | null>(null)

  function globalLbIsSelfRow(entry: { userId: string }): boolean {
    const u = user.value
    if (!u) {
      return false
    }
    if (u.dbUserId && entry.userId === u.dbUserId) {
      return true
    }
    if (entry.userId === u.id) {
      return true
    }
    if (u.twitchId && entry.userId === u.twitchId) {
      return true
    }
    return false
  }

  function globalLbInitials(name: string): string {
    const s = String(name ?? '').trim()
    if (!s) {
      return '?'
    }
    return s[0]!.toUpperCase()
  }

  function globalLeaderboardQuery(): string {
    const id = streamerProfile.value?.id
    if (typeof id === 'string' && id.length > 0) {
      return `?streamerId=${encodeURIComponent(id)}`
    }
    const slug = effectiveWordleSlug.value
    if (slug) {
      return `?streamer=${encodeURIComponent(slug)}`
    }
    return ''
  }

  async function loadGlobalLbWins(): Promise<void> {
    globalLbLoading.value = true
    globalLbError.value = null
    try {
      globalLbWinsRows.value = await fetchLeaderboardWins(globalLeaderboardQuery())
    } catch {
      globalLbError.value = t('wordleLeaderboard.loadError')
      globalLbWinsRows.value = []
    } finally {
      globalLbLoading.value = false
    }
  }

  async function loadGlobalLbStreak(): Promise<void> {
    globalLbLoading.value = true
    globalLbError.value = null
    globalLbViewerMaxStreak.value = undefined
    try {
      const { entries, viewerMaxStreak } = await fetchLeaderboardStreak(globalLeaderboardQuery())
      globalLbStreakRows.value = entries
      globalLbViewerMaxStreak.value = viewerMaxStreak
    } catch {
      globalLbError.value = t('wordleLeaderboard.loadError')
      globalLbStreakRows.value = []
      globalLbViewerMaxStreak.value = undefined
    } finally {
      globalLbLoading.value = false
    }
  }

  async function loadGlobalLbRating(): Promise<void> {
    globalLbLoading.value = true
    globalLbError.value = null
    try {
      globalLbRatingRows.value = await fetchLeaderboardRating(globalLeaderboardQuery())
    } catch {
      globalLbError.value = t('wordleLeaderboard.loadError')
      globalLbRatingRows.value = []
    } finally {
      globalLbLoading.value = false
    }
  }

  async function loadGlobalLbActive(): Promise<void> {
    if (globalLbTab.value === 'wins') {
      await loadGlobalLbWins()
    } else if (globalLbTab.value === 'streak') {
      await loadGlobalLbStreak()
    } else {
      await loadGlobalLbRating()
    }
  }

  watch(globalLbTab, () => {
    void loadGlobalLbActive()
  })

  watch(
    () => streamerProfile.value?.id,
    () => {
      void loadGlobalLbActive()
    },
  )

  const globalLbDisplayRows = computed(
    (): readonly (WordleGlobalWinsRow | WordleGlobalStreakRow | WordleGlobalRatingRow)[] => {
      if (globalLbTab.value === 'wins') {
        return globalLbWinsRows.value
      }
      if (globalLbTab.value === 'streak') {
        return globalLbStreakRows.value
      }
      return globalLbRatingRows.value
    },
  )

  const globalLbScoreLabel = computed(() => {
    void locale.value
    if (globalLbTab.value === 'wins') {
      return t('wordleLeaderboard.scoreWins')
    }
    if (globalLbTab.value === 'streak') {
      return t('wordleLeaderboard.scoreStreak')
    }
    return t('wordleLeaderboard.scoreRating')
  })

  function globalLbScoreFor(row: WordleGlobalWinsRow | WordleGlobalStreakRow | WordleGlobalRatingRow): number {
    if (globalLbTab.value === 'wins') {
      return (row as WordleGlobalWinsRow).wins
    }
    if (globalLbTab.value === 'streak') {
      return (row as WordleGlobalStreakRow).streak
    }
    return (row as WordleGlobalRatingRow).rating
  }

  const globalLbTableRows = computed((): WordleGlobalLeaderboardRowVm[] => {
    const tab = globalLbTab.value
    return globalLbDisplayRows.value.map((row) => ({
      rowKey: `${tab}-${row.userId}-${row.rank}`,
      rank: row.rank,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      score: globalLbScoreFor(row),
      isSelf: globalLbIsSelfRow(row),
      initials: globalLbInitials(row.displayName),
    }))
  })

  /** Signed-in viewer’s best streak on this channel (server); shown above the streak table. */
  const globalLbSelfStreakSummary = computed((): string | null => {
    void locale.value
    if (globalLbTab.value !== 'streak' || !user.value) {
      return null
    }
    const v = globalLbViewerMaxStreak.value
    if (v === undefined) {
      return null
    }
    return t('wordleLeaderboard.selfBestStreak', { n: v })
  })

  return {
    globalLbTab,
    globalLbLoading,
    globalLbError,
    globalLbTableRows,
    globalLbScoreLabel,
    globalLbSelfStreakSummary,
    loadGlobalLbActive,
  }
}
