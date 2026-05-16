import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useCoinHubStore } from '@/stores/coinHub';
import { formatMmSsRemaining } from '@/utils/coinHub/coinHubFormat';
/**
 * Read-only view-model over `coinHub` store: when {@link useAdminMode} is on,
 * cooldown/lock are not reflected in the UI (server may still rate-limit).
 * Pass the same `isAdmin` from {@link useAdminMode} as for `useCoinHubPageRuntime`.
 */
export function useCoinHubAdminUi(isAdmin, nowMs) {
    const { t } = useI18n();
    const coinHub = useCoinHubStore();
    const { dailySpinAvailable, freeCaseState, subscriberCaseState, caseStates, spinNextAvailableAtIso, } = storeToRefs(coinHub);
    const effectiveDailySpinAvailable = computed(() => isAdmin.value || dailySpinAvailable.value);
    const effectiveFreeCaseState = computed(() => {
        if (isAdmin.value) {
            return 'available';
        }
        return freeCaseState.value;
    });
    const effectiveSubscriberCaseState = computed(() => {
        if (isAdmin.value) {
            return 'available';
        }
        return subscriberCaseState.value;
    });
    const effectiveCaseStates = computed(() => {
        if (isAdmin.value) {
            return caseStates.value.map(() => 'available');
        }
        return caseStates.value;
    });
    const effectiveSpinCooldownHint = computed(() => {
        if (isAdmin.value) {
            return undefined;
        }
        if (dailySpinAvailable.value) {
            return undefined;
        }
        const iso = spinNextAvailableAtIso.value;
        if (!iso) {
            return undefined;
        }
        const end = new Date(iso).getTime();
        if (Number.isNaN(end)) {
            return undefined;
        }
        const rem = end - nowMs.value;
        if (rem <= 0) {
            return undefined;
        }
        return t('coinHub.spinNextIn', { t: formatMmSsRemaining(rem) });
    });
    return {
        effectiveDailySpinAvailable,
        effectiveFreeCaseState,
        effectiveSubscriberCaseState,
        effectiveCaseStates,
        effectiveSpinCooldownHint,
    };
}
