import { computed, type Ref, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppUser } from '@/composables/useAuth'
import type { WordleStreamSessionUser } from '@/wordle/ws'

/** Display name for the solo leaderboard row: WS session first, then auth user, else guest label. */
export function useWordleLeaderboardSelfName(options: {
  sessionUser: ShallowRef<WordleStreamSessionUser | null>
  user: Ref<AppUser | null>
}) {
  const { t, locale } = useI18n()
  const { sessionUser, user } = options

  const leaderboardSelfName = computed(() => {
    void locale.value
    const wsUser = sessionUser.value
    if (wsUser?.display_name) {
      return wsUser.display_name
    }
    const u = user.value
    if (u?.displayName) {
      return u.displayName
    }
    return t('wordleUi.guest')
  })

  return { leaderboardSelfName }
}
