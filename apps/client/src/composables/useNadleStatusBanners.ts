import { computed, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NadleIrcRelayState, NadleWsConnectionState } from '@/nadle/ws'

export type NadleTopBanner = { text: string; variant: 'error' | 'default' }

/**
 * Top page banner (streamer load vs WS/app error) and chat relay status labels.
 * No DOM — template binds to returned computeds.
 */
export function useNadleStatusBanners(options: {
  streamerLoadError: Ref<string | null | undefined>
  lastError: Ref<string | null | undefined>
  wsStatus: Ref<NadleWsConnectionState>
  ircRelayStatus: Ref<NadleIrcRelayState>
}): {
  topBanner: ComputedRef<NadleTopBanner | null>
  wsStatusLabel: ComputedRef<string>
  ircRelayBanner: ComputedRef<string>
} {
  const { t, locale } = useI18n()
  const { streamerLoadError, lastError, wsStatus, ircRelayStatus } = options

  const topBanner = computed((): NadleTopBanner | null => {
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
        return t('nadleUi.chatWsOpen')
      case 'closed':
        return t('nadleUi.chatWsClosed')
      case 'error':
        return t('nadleUi.chatWsError')
      default:
        return t('nadleUi.chatWsIdle')
    }
  })

  const ircRelayBanner = computed(() => {
    void locale.value
    switch (ircRelayStatus.value) {
      case 'reconnecting':
        return t('nadleUi.chatIrcReconnecting')
      case 'disconnected':
        return t('nadleUi.chatIrcDisconnected')
      case 'connecting':
        return t('nadleUi.chatIrcConnecting')
      case 'error':
        return t('nadleUi.chatIrcError')
      default:
        return ''
    }
  })

  return { topBanner, wsStatusLabel, ircRelayBanner }
}
