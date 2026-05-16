import { ref, watch } from 'vue';
export function useCallPresenceToasts(options) {
    const { callPresenceMessages, t } = options;
    const callToasts = ref([]);
    let lastPresenceToastSourceId = '';
    function pushCallToast(text, kind = 'join', ttlMs = 4200) {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        callToasts.value = [...callToasts.value, { id, text, kind }];
        window.setTimeout(() => {
            callToasts.value = callToasts.value.filter((x) => x.id !== id);
        }, ttlMs);
    }
    watch(() => callPresenceMessages.value[callPresenceMessages.value.length - 1]?.id, () => {
        const msgs = callPresenceMessages.value;
        const last = msgs[msgs.length - 1];
        if (!last || last.id === lastPresenceToastSourceId) {
            return;
        }
        lastPresenceToastSourceId = last.id;
        const name = last.displayName;
        const text = last.kind === 'join'
            ? t('callPage.presenceJoined', { name })
            : t('callPage.presenceLeft', { name });
        const id = `toast-${last.id}`;
        callToasts.value = [...callToasts.value, { id, text, kind: last.kind }];
        window.setTimeout(() => {
            callToasts.value = callToasts.value.filter((x) => x.id !== id);
        }, 4200);
    });
    return { callToasts, pushCallToast };
}
