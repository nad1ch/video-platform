import { computed } from 'vue';
export function useNadrawAccess(options) {
    const { sessionCanControl, authLoaded, isAuthenticated } = options;
    const showHostChrome = computed(() => authLoaded.value && isAuthenticated.value && sessionCanControl.value);
    return { showHostChrome };
}
