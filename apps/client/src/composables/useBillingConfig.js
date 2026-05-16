import { computed, ref } from 'vue';
import { fetchBillingConfig } from '@/services/billingApi';
import { createLogger } from '@/utils/logger';
/**
 * Singleton-ish billing config snapshot. Source of truth is the server
 * response from `GET /api/billing/config`. The frontend MUST read from this
 * to render the pricing card / modal copy — there is NO client-side fallback
 * price. If the snapshot is unavailable (network blip, server unreachable),
 * callers should disable the CTA and show "pricing temporarily unavailable"
 * rather than silently fall back to a stale hardcoded value.
 *
 * The composable mirrors the shape of `useProSubscription` (singleton ref +
 * `refresh*` function) so the two are easy to use side-by-side on
 * `BillingPage.vue` and admin views.
 */
const log = createLogger('billing-config');
const config = ref(null);
const loading = ref(false);
const lastError = ref(null);
let inflight = null;
async function refreshOnce() {
    loading.value = true;
    try {
        const r = await fetchBillingConfig();
        if (r.ok) {
            config.value = r.data;
            lastError.value = null;
        }
        else {
            // Keep last known snapshot — do NOT wipe pricing on transient errors.
            lastError.value = r.message;
            log.warn('billing/config failed', r.status, r.code, r.message);
        }
    }
    finally {
        loading.value = false;
    }
}
export function refreshBillingConfig() {
    if (inflight)
        return inflight;
    inflight = refreshOnce().finally(() => {
        inflight = null;
    });
    return inflight;
}
export function useBillingConfig() {
    const durationLabel = computed(() => {
        const c = config.value;
        if (!c)
            return null;
        return `${c.durationDays} днів`;
    });
    const isReady = computed(() => config.value !== null);
    const jarConfigured = computed(() => config.value?.jarConfigured ?? false);
    return {
        config,
        loading,
        lastError,
        isReady,
        durationLabel,
        jarConfigured,
        refreshBillingConfig,
    };
}
