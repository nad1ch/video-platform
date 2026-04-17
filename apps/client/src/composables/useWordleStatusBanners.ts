import { computed, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WordleIrcRelayState, WordleWsConnectionState } from '@/wordle/ws'

export type WordleTopBanner = { text: string; variant: 'error' | 'default' }

/**
 * Top page banner (streamer load vs WS/app error) and chat relay status labels.
 * No DOM — template binds to returned computeds.
 */
export function useWordleStatusBanners(options: {
  streamerLoadError: Ref<string | null | undefined>
  lastError: Ref<string | null | undefined>
  wsStatus: Ref<WordleWsConnectionState>
  ircRelayStatus: Ref<WordleIrcRelayState>
}): {
  topBanner: ComputedRef<WordleTopBanner | null>
  wsStatusLabel: ComputedRef<string>
  ircRelayBanner: ComputedRef<string>
} {
  const { t, locale } = useI18n()
  const { streamerLoadError, lastError, wsStatus, ircRelayStatus } = options

  const topBanner = computed((): WordleTopBanner | null => {
    const se = streamerLoadError.value ?? null
    const le = lastError.value ?? null
    if (se) {
      return { text: se, variant: 'error' }
    }
    if (le) {
      return { text: le, variant: 'default' }
    }
    return null
  })

  const wsStatusLabel = computed(() => {
    void locale.value
    switch (wsStatus.value) {
      case 'open':
        return t('wordleUi.chatWsOpen')
      case 'closed':
        return t('wordleUi.chatWsClosed')
      case 'error':
        return t('wordleUi.chatWsError')
      default:
        return t('wordleUi.chatWsIdle')
    }
  })

  const ircRelayBanner = computed(() => {
    void locale.value
    switch (ircRelayStatus.value) {
      case 'reconnecting':
        return t('wordleUi.chatIrcReconnecting')
      case 'disconnected':
        return t('wordleUi.chatIrcDisconnected')
      case 'connecting':
        return t('wordleUi.chatIrcConnecting')
      case 'error':
        return t('wordleUi.chatIrcError')
      default:
        return ''
    }
  })

  return { topBanner, wsStatusLabel, ircRelayBanner }
}
