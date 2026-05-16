import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
export function useNadleStatusBanners(options) {
    const { t, locale } = useI18n();
    const { streamerLoadError, lastError, wsStatus, ircRelayStatus } = options;
    const topBanner = computed(() => {
        const se = streamerLoadError.value ?? null;
        const le = lastError.value ?? null;
        if (se) {
            return { text: se, variant: 'error' };
        }
        if (le) {
            return { text: le, variant: 'default' };
        }
        return null;
    });
    const wsStatusLabel = computed(() => {
        void locale.value;
        switch (wsStatus.value) {
            case 'open':
                return t('nadleUi.chatWsOpen');
            case 'closed':
                return t('nadleUi.chatWsClosed');
            case 'error':
                return t('nadleUi.chatWsError');
            default:
                return t('nadleUi.chatWsIdle');
        }
    });
    const ircRelayBanner = computed(() => {
        void locale.value;
        switch (ircRelayStatus.value) {
            case 'reconnecting':
                return t('nadleUi.chatIrcReconnecting');
            case 'disconnected':
                return t('nadleUi.chatIrcDisconnected');
            case 'connecting':
                return t('nadleUi.chatIrcConnecting');
            case 'error':
                return t('nadleUi.chatIrcError');
            default:
                return '';
        }
    });
    return { topBanner, wsStatusLabel, ircRelayBanner };
}
