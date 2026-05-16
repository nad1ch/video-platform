/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import AppContainer from '@/components/ui/AppContainer.vue';
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue';
import CoinHubHero from '@/components/coinhub/CoinHubHero.vue';
import DailyCard from '@/components/coinhub/DailyCard.vue';
import SpinModule from '@/components/coinhub/SpinModule.vue';
import CaseCard from '@/components/coinhub/CaseCard.vue';
// Case-opening modal renders only after a case is opened; lazy so the
// /app/coin-hub first paint is not blocked on the modal chunk.
const CaseOpeningModal = defineAsyncComponent(() => import('@/components/coinhub/CaseOpeningModal.vue'));
import BoostCard from '@/components/coinhub/BoostCard.vue';
import StreamerCard from '@/components/coinhub/StreamerCard.vue';
import CoinHubUpgradePanel from '@/components/coinhub/CoinHubUpgradePanel.vue';
import { useAdminMode } from '@/composables/useAdminMode';
import { useCoinHubAdminUi } from '@/composables/useCoinHubAdminUi';
import { useCoinHubPageRuntime } from '@/composables/useCoinHubPageRuntime';
import { useCoinHubStore } from '@/stores/coinHub';
import { formatMmSsRemaining } from '@/utils/coinHub/coinHubFormat';
import '@/styles/coinhub-design-system.css';
const { t } = useI18n();
const { isAdmin } = useAdminMode();
const coinHub = useCoinHubStore();
const { pending, freeCaseState, subscriberCaseState, caseStates, spinNextAvailableAtIso, caseRewards, spinPayout, caseGridCooldownUntilIso, freeCaseCooldownUntilIso, subscriberCaseCooldownUntilIso, lastError, lastErrorKind, lastAction, hubLoading, initialHydrated, openingCaseId, lastOpenedCaseRewardLine, } = storeToRefs(coinHub);
const hasPending = computed(() => pending.value > 0);
const flowFocal = computed(() => (hasPending.value ? 'claim' : 'daily'));
const COINHUB_FIRST_LOAD_MIN_MS = 500;
const showPageLoader = ref(!initialHydrated.value);
const firstLoadStartedAt = ref(!initialHydrated.value ? Date.now() : null);
let firstLoadMinHoldTimer = null;
function clearFirstLoadMinHold() {
    if (firstLoadMinHoldTimer) {
        clearTimeout(firstLoadMinHoldTimer);
        firstLoadMinHoldTimer = null;
    }
}
watch(() => ({ hydrated: initialHydrated.value, loading: hubLoading.value }), ({ hydrated, loading }) => {
    const inFirstFetch = !hydrated && loading;
    if (inFirstFetch) {
        clearFirstLoadMinHold();
        if (firstLoadStartedAt.value == null) {
            firstLoadStartedAt.value = Date.now();
        }
        showPageLoader.value = true;
        return;
    }
    if (hydrated) {
        if (firstLoadStartedAt.value == null) {
            showPageLoader.value = false;
            return;
        }
        const t0 = firstLoadStartedAt.value;
        const elapsed = Date.now() - t0;
        if (elapsed >= COINHUB_FIRST_LOAD_MIN_MS) {
            showPageLoader.value = false;
            firstLoadStartedAt.value = null;
            return;
        }
        clearFirstLoadMinHold();
        const remaining = COINHUB_FIRST_LOAD_MIN_MS - elapsed;
        firstLoadMinHoldTimer = setTimeout(() => {
            firstLoadMinHoldTimer = null;
            showPageLoader.value = false;
            firstLoadStartedAt.value = null;
        }, remaining);
    }
}, { immediate: true });
onBeforeUnmount(() => {
    clearFirstLoadMinHold();
});
const errorHeadline = computed(() => {
    const k = lastErrorKind.value;
    if (k === 'auth')
        return t('coinHub.errorAuth');
    if (k === 'network')
        return t('coinHub.errorNetwork');
    if (k === 'http')
        return t('coinHub.errorHttp');
    return t('coinHub.errorHttp');
});
function luckCaseId(i) {
    return `luck-${i}`;
}
function cooldownDetail(iso, state, now) {
    if (state !== 'cooldown' || !iso)
        return null;
    const end = new Date(iso).getTime();
    if (Number.isNaN(end))
        return null;
    return formatMmSsRemaining(end - now);
}
const { nowMs } = useCoinHubPageRuntime({
    onBackgroundLoad: () => {
        void coinHub.loadSnapshot({ background: true });
    },
    shouldRefreshOnCooldownEdge: (now) => {
        if (isAdmin.value) {
            return false;
        }
        const isos = [
            ...caseGridCooldownUntilIso.value,
            freeCaseCooldownUntilIso.value,
            subscriberCaseCooldownUntilIso.value,
            spinNextAvailableAtIso.value,
        ];
        for (const iso of isos) {
            if (iso == null)
                continue;
            const end = new Date(iso).getTime();
            if (Number.isNaN(end))
                continue;
            const rem = end - now;
            if (rem <= 0 && rem > -3_000) {
                return true;
            }
        }
        return false;
    },
});
const { effectiveDailySpinAvailable, effectiveFreeCaseState, effectiveSubscriberCaseState, effectiveCaseStates, effectiveSpinCooldownHint, } = useCoinHubAdminUi(isAdmin, nowMs);
const luckCaseDetail = computed(() => caseStates.value.map((state, i) => cooldownDetail(caseGridCooldownUntilIso.value[i] ?? null, state, nowMs.value)));
const freeCaseDetail = computed(() => cooldownDetail(freeCaseCooldownUntilIso.value, freeCaseState.value, nowMs.value));
const subscriberCaseDetail = computed(() => cooldownDetail(subscriberCaseCooldownUntilIso.value, subscriberCaseState.value, nowMs.value));
onMounted(() => {
    void coinHub.loadSnapshot();
});
watch(showPageLoader, (loading) => {
    if (loading) {
        return;
    }
    void nextTick().then(() => {
        requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });
    });
});
function onRetry() {
    void coinHub.retryLastAction();
}
const caseModalOpen = ref(false);
const caseModalResolving = ref(false);
const caseModalReward = ref(null);
const caseModalTitle = ref('');
function onCaseModalUpdateOpen(v) {
    caseModalOpen.value = v;
    if (!v) {
        caseModalResolving.value = false;
        caseModalReward.value = null;
        caseModalTitle.value = '';
    }
}
async function onLuckCaseOpen(index) {
    if (!isAdmin.value && caseStates.value[index] !== 'available') {
        return;
    }
    if (openingCaseId.value) {
        return;
    }
    caseModalTitle.value = t('coinHub.casePlaceholder');
    caseModalOpen.value = true;
    caseModalResolving.value = true;
    caseModalReward.value = null;
    const id = luckCaseId(index);
    const ok = await coinHub.openCase(id);
    caseModalResolving.value = false;
    if (!ok) {
        caseModalOpen.value = false;
        caseModalReward.value = null;
        return;
    }
    caseModalReward.value = caseRewards.value[index] ?? lastOpenedCaseRewardLine.value ?? t('coinHub.caseRewardDemo');
}
async function onDailyCaseOpen(kind) {
    const state = kind === 'free' ? effectiveFreeCaseState.value : effectiveSubscriberCaseState.value;
    if (!isAdmin.value && state !== 'available') {
        return;
    }
    if (openingCaseId.value) {
        return;
    }
    caseModalTitle.value = kind === 'free' ? t('coinHub.freeCase') : t('coinHub.subscriberCase');
    caseModalOpen.value = true;
    caseModalResolving.value = true;
    caseModalReward.value = null;
    const id = kind === 'free' ? 'free' : 'subscriber';
    const ok = await coinHub.openCase(id);
    caseModalResolving.value = false;
    if (!ok) {
        caseModalOpen.value = false;
        caseModalReward.value = null;
        return;
    }
    caseModalReward.value = lastOpenedCaseRewardLine.value ?? t('coinHub.caseRewardDemo');
}
const luckCasePriceLabels = computed(() => [
    t('coinHub.casePriceCommon'),
    t('coinHub.casePriceRare'),
    t('coinHub.casePriceEpic'),
    t('coinHub.casePriceLegendary'),
]);
const luckCaseRarityTitles = [
    'coinHub.caseRarity0',
    'coinHub.caseRarity1',
    'coinHub.caseRarity2',
    'coinHub.caseRarity3',
];
function luckCaseTitle(index) {
    const k = luckCaseRarityTitles[index];
    return k ? t(k) : t('coinHub.casePlaceholder');
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['coin-hub--game-ui']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-route coin-hub coin-hub--game-ui ch-ds-root relative min-h-0 w-full flex-1" },
    'aria-busy': (__VLS_ctx.showPageLoader),
    inert: (__VLS_ctx.showPageLoader || undefined),
});
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
/** @type {__VLS_StyleScopedClasses['coin-hub']} */ ;
/** @type {__VLS_StyleScopedClasses['coin-hub--game-ui']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-root']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-hero-and-upgrade w-full min-w-0 flex flex-col gap-0 md:mx-auto md:grid md:max-w-[1320px] md:grid-cols-[1.4fr_1fr] md:items-stretch md:gap-6 md:px-4 md:pt-5 md:pb-5" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero-and-upgrade']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
/** @type {__VLS_StyleScopedClasses['md:mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid']} */ ;
/** @type {__VLS_StyleScopedClasses['md:max-w-[1320px]']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-[1.4fr_1fr]']} */ ;
/** @type {__VLS_StyleScopedClasses['md:items-stretch']} */ ;
/** @type {__VLS_StyleScopedClasses['md:gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['md:px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['md:pb-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0 min-h-0" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
const __VLS_0 = CoinHubHero;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    balanceLabel: (__VLS_ctx.t('coinHub.heroBalance')),
    pendingLabel: (__VLS_ctx.t('coinHub.pending')),
    claimLabel: (__VLS_ctx.t('coinHub.claim')),
    isFocalTarget: (__VLS_ctx.flowFocal === 'claim'),
    adminDevLabel: (__VLS_ctx.isAdmin ? __VLS_ctx.t('coinHub.adminDevMode') : undefined),
}));
const __VLS_2 = __VLS_1({
    balanceLabel: (__VLS_ctx.t('coinHub.heroBalance')),
    pendingLabel: (__VLS_ctx.t('coinHub.pending')),
    claimLabel: (__VLS_ctx.t('coinHub.claim')),
    isFocalTarget: (__VLS_ctx.flowFocal === 'claim'),
    adminDevLabel: (__VLS_ctx.isAdmin ? __VLS_ctx.t('coinHub.adminDevMode') : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_5 = CoinHubUpgradePanel;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "max-md:hidden min-h-0 h-full" },
    inlineWithHero: true,
}));
const __VLS_7 = __VLS_6({
    ...{ class: "max-md:hidden min-h-0 h-full" },
    inlineWithHero: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
const __VLS_10 = AppContainer || AppContainer;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "coin-hub__inner flex min-h-0 flex-col gap-6 pb-8 pt-6 md:pb-8" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "coin-hub__inner flex min-h-0 flex-col gap-6 pb-8 pt-6 md:pb-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['coin-hub__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['md:pb-8']} */ ;
const { default: __VLS_15 } = __VLS_13.slots;
if (__VLS_ctx.lastError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col items-stretch gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 sm:flex-row sm:items-center sm:justify-between" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-stretch']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-950/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-medium text-amber-200/90" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-200/90']} */ ;
    (__VLS_ctx.errorHeadline);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-0.5 text-xs text-amber-200/50" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-200/50']} */ ;
    (__VLS_ctx.lastError);
    if (__VLS_ctx.lastAction) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.onRetry) },
            type: "button",
            ...{ class: "shrink-0 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-100 hover:bg-amber-500/20" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-amber-500/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-100']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-amber-500/20']} */ ;
        (__VLS_ctx.t('coinHub.retry'));
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "coinhub-roulette-section w-full min-w-0 px-4" },
    'aria-label': (__VLS_ctx.t('coinHub.dailySpin')),
});
/** @type {__VLS_StyleScopedClasses['coinhub-roulette-section']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mx-auto w-full max-w-[1300px] min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[1300px]']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
const __VLS_16 = SpinModule;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    variant: "hero",
    tagLabel: (__VLS_ctx.t('coinHub.labelDaily')),
    title: (__VLS_ctx.t('coinHub.dailySpin')),
    actionLabel: (__VLS_ctx.t('coinHub.ctaSpin')),
    isFocalTarget: (__VLS_ctx.flowFocal === 'daily'),
    showAvailabilityPulse: (__VLS_ctx.flowFocal === 'daily' && __VLS_ctx.effectiveDailySpinAvailable),
    stateLabelAvailable: (__VLS_ctx.t('coinHub.stateAvailable')),
    targetPayout: (__VLS_ctx.spinPayout),
    spinAvailable: (__VLS_ctx.effectiveDailySpinAvailable),
    spinCooldownHint: (__VLS_ctx.effectiveSpinCooldownHint),
    omitHeroHeading: (true),
}));
const __VLS_18 = __VLS_17({
    variant: "hero",
    tagLabel: (__VLS_ctx.t('coinHub.labelDaily')),
    title: (__VLS_ctx.t('coinHub.dailySpin')),
    actionLabel: (__VLS_ctx.t('coinHub.ctaSpin')),
    isFocalTarget: (__VLS_ctx.flowFocal === 'daily'),
    showAvailabilityPulse: (__VLS_ctx.flowFocal === 'daily' && __VLS_ctx.effectiveDailySpinAvailable),
    stateLabelAvailable: (__VLS_ctx.t('coinHub.stateAvailable')),
    targetPayout: (__VLS_ctx.spinPayout),
    spinAvailable: (__VLS_ctx.effectiveDailySpinAvailable),
    spinCooldownHint: (__VLS_ctx.effectiveSpinCooldownHint),
    omitHeroHeading: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "coinhub-daily-cases-block hidden w-full min-w-0 px-4" },
    'aria-label': (__VLS_ctx.t('coinHub.dailyCasesTitle')),
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily-cases-block']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-daily-cases-block__inner ch-ds-card ch-ds-card--alt ch-ds-card--interactive mx-auto max-w-[1300px] flex min-w-0 flex-col gap-4 p-6 sm:p-8" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily-cases-block__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--alt']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[1300px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:p-8']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "ch-ds-text-label text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-label']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.18em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[#9CA3AF]']} */ ;
(__VLS_ctx.t('coinHub.dailyAreaLabel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "ch-ds-text-section mt-1 text-[22px] sm:text-[28px]" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-section']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-[28px]']} */ ;
(__VLS_ctx.t('coinHub.dailyCasesTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-daily-cases__stack flex min-h-0 min-w-0 flex-1 flex-col gap-6" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-daily-cases__stack']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
const __VLS_21 = DailyCard;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    ...{ 'onOpen': {} },
    visualTier: "free",
    tagLabel: (__VLS_ctx.t('coinHub.labelFree')),
    title: (__VLS_ctx.t('coinHub.freeCase')),
    actionLabel: (__VLS_ctx.t('coinHub.ctaOpen')),
    state: (__VLS_ctx.effectiveFreeCaseState),
    detailLabel: (__VLS_ctx.effectiveFreeCaseState === 'cooldown' ? (__VLS_ctx.freeCaseDetail || __VLS_ctx.t('coinHub.cooldownSample')) : undefined),
    stateLabelAvailable: (__VLS_ctx.t('coinHub.stateAvailable')),
    stateLabelLocked: (__VLS_ctx.t('coinHub.stateLocked')),
    stateLabelCooldown: (__VLS_ctx.t('coinHub.stateCooldown')),
}));
const __VLS_23 = __VLS_22({
    ...{ 'onOpen': {} },
    visualTier: "free",
    tagLabel: (__VLS_ctx.t('coinHub.labelFree')),
    title: (__VLS_ctx.t('coinHub.freeCase')),
    actionLabel: (__VLS_ctx.t('coinHub.ctaOpen')),
    state: (__VLS_ctx.effectiveFreeCaseState),
    detailLabel: (__VLS_ctx.effectiveFreeCaseState === 'cooldown' ? (__VLS_ctx.freeCaseDetail || __VLS_ctx.t('coinHub.cooldownSample')) : undefined),
    stateLabelAvailable: (__VLS_ctx.t('coinHub.stateAvailable')),
    stateLabelLocked: (__VLS_ctx.t('coinHub.stateLocked')),
    stateLabelCooldown: (__VLS_ctx.t('coinHub.stateCooldown')),
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
let __VLS_26;
const __VLS_27 = ({ open: {} },
    { onOpen: (...[$event]) => {
            __VLS_ctx.onDailyCaseOpen('free');
            // @ts-ignore
            [showPageLoader, showPageLoader, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, flowFocal, flowFocal, flowFocal, isAdmin, lastError, lastError, errorHeadline, lastAction, onRetry, effectiveDailySpinAvailable, effectiveDailySpinAvailable, spinPayout, effectiveSpinCooldownHint, effectiveFreeCaseState, effectiveFreeCaseState, freeCaseDetail, onDailyCaseOpen,];
        } });
var __VLS_24;
var __VLS_25;
const __VLS_28 = DailyCard;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
    ...{ 'onOpen': {} },
    visualTier: "subscriber",
    tagLabel: (__VLS_ctx.t('coinHub.labelSubscriber')),
    title: (__VLS_ctx.t('coinHub.subscriberCase')),
    actionLabel: (__VLS_ctx.t('coinHub.ctaOpen')),
    state: (__VLS_ctx.effectiveSubscriberCaseState),
    detailLabel: (__VLS_ctx.effectiveSubscriberCaseState === 'cooldown' ? (__VLS_ctx.subscriberCaseDetail || __VLS_ctx.t('coinHub.cooldownSample')) : undefined),
    stateLabelAvailable: (__VLS_ctx.t('coinHub.stateAvailable')),
    stateLabelLocked: (__VLS_ctx.t('coinHub.stateLocked')),
    stateLabelCooldown: (__VLS_ctx.t('coinHub.stateCooldown')),
}));
const __VLS_30 = __VLS_29({
    ...{ 'onOpen': {} },
    visualTier: "subscriber",
    tagLabel: (__VLS_ctx.t('coinHub.labelSubscriber')),
    title: (__VLS_ctx.t('coinHub.subscriberCase')),
    actionLabel: (__VLS_ctx.t('coinHub.ctaOpen')),
    state: (__VLS_ctx.effectiveSubscriberCaseState),
    detailLabel: (__VLS_ctx.effectiveSubscriberCaseState === 'cooldown' ? (__VLS_ctx.subscriberCaseDetail || __VLS_ctx.t('coinHub.cooldownSample')) : undefined),
    stateLabelAvailable: (__VLS_ctx.t('coinHub.stateAvailable')),
    stateLabelLocked: (__VLS_ctx.t('coinHub.stateLocked')),
    stateLabelCooldown: (__VLS_ctx.t('coinHub.stateCooldown')),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_33;
const __VLS_34 = ({ open: {} },
    { onOpen: (...[$event]) => {
            __VLS_ctx.onDailyCaseOpen('subscriber');
            // @ts-ignore
            [t, t, t, t, t, t, t, onDailyCaseOpen, effectiveSubscriberCaseState, effectiveSubscriberCaseState, subscriberCaseDetail,];
        } });
var __VLS_31;
var __VLS_32;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-lower-grid hidden grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6 lg:items-start" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-lower-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-12']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "coinhub-panel coinhub-panel--secondary coinhub-lower__luck ch-ds-card ch-ds-card--interactive p-8 lg:col-span-5" },
    'aria-label': (__VLS_ctx.t('coinHub.sectionLuck')),
});
/** @type {__VLS_StyleScopedClasses['coinhub-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-panel--secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-lower__luck']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "coinhub-sec-h coinhub-sec-h--secondary mb-6 md:mb-7" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-sec-h']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-sec-h--secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['md:mb-7']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "ch-ds-text-section text-[24px] sm:text-[28px]" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-section']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-[28px]']} */ ;
(__VLS_ctx.t('coinHub.sectionLuck'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "ch-ds-text-muted mt-2 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.t('coinHub.luckSectionHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-2']} */ ;
for (const [state, index] of __VLS_vFor((__VLS_ctx.effectiveCaseStates))) {
    const __VLS_35 = CaseCard;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
        ...{ 'onOpen': {} },
        key: (`case-${index}`),
        title: (__VLS_ctx.luckCaseTitle(index)),
        actionLabel: (__VLS_ctx.t('coinHub.caseCta')),
        priceLabel: (__VLS_ctx.luckCasePriceLabels[index] ?? undefined),
        state: (state),
        rarityId: (index),
        detailLabel: (state === 'cooldown' ? (__VLS_ctx.luckCaseDetail[index] || __VLS_ctx.t('coinHub.cooldownSample')) : undefined),
        stateLabelLocked: (__VLS_ctx.t('coinHub.stateLocked')),
        stateLabelCooldown: (__VLS_ctx.t('coinHub.stateCooldown')),
        isRemoteBusy: (__VLS_ctx.openingCaseId === __VLS_ctx.luckCaseId(index)),
    }));
    const __VLS_37 = __VLS_36({
        ...{ 'onOpen': {} },
        key: (`case-${index}`),
        title: (__VLS_ctx.luckCaseTitle(index)),
        actionLabel: (__VLS_ctx.t('coinHub.caseCta')),
        priceLabel: (__VLS_ctx.luckCasePriceLabels[index] ?? undefined),
        state: (state),
        rarityId: (index),
        detailLabel: (state === 'cooldown' ? (__VLS_ctx.luckCaseDetail[index] || __VLS_ctx.t('coinHub.cooldownSample')) : undefined),
        stateLabelLocked: (__VLS_ctx.t('coinHub.stateLocked')),
        stateLabelCooldown: (__VLS_ctx.t('coinHub.stateCooldown')),
        isRemoteBusy: (__VLS_ctx.openingCaseId === __VLS_ctx.luckCaseId(index)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    let __VLS_40;
    const __VLS_41 = ({ open: {} },
        { onOpen: (...[$event]) => {
                __VLS_ctx.onLuckCaseOpen(index);
                // @ts-ignore
                [t, t, t, t, t, t, t, effectiveCaseStates, luckCaseTitle, luckCasePriceLabels, luckCaseDetail, openingCaseId, luckCaseId, onLuckCaseOpen,];
            } });
    var __VLS_38;
    var __VLS_39;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-lower__mid flex flex-col gap-6 lg:col-span-4" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-lower__mid']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "coinhub-panel coinhub-panel--tertiary ch-ds-card ch-ds-card--interactive p-8" },
    'aria-label': (__VLS_ctx.t('coinHub.sectionBoosts')),
});
/** @type {__VLS_StyleScopedClasses['coinhub-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-panel--tertiary']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "coinhub-sec-h coinhub-sec-h--tertiary mb-5" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-sec-h']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-sec-h--tertiary']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "ch-ds-text-section text-[24px] sm:text-[28px]" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-section']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-[28px]']} */ ;
(__VLS_ctx.t('coinHub.sectionBoosts'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "ch-ds-text-label mt-2" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-label']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
(__VLS_ctx.t('coinHub.activeBoosts'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "ch-ds-text-muted mt-1.5 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.t('coinHub.spendSectionHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
const __VLS_42 = BoostCard;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
    label: (__VLS_ctx.t('coinHub.boostMoney')),
    variant: "money",
}));
const __VLS_44 = __VLS_43({
    label: (__VLS_ctx.t('coinHub.boostMoney')),
    variant: "money",
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
const __VLS_47 = BoostCard;
// @ts-ignore
const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
    label: (__VLS_ctx.t('coinHub.boostSpeed')),
    variant: "speed",
}));
const __VLS_49 = __VLS_48({
    label: (__VLS_ctx.t('coinHub.boostSpeed')),
    variant: "speed",
}, ...__VLS_functionalComponentArgsRest(__VLS_48));
const __VLS_52 = BoostCard;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
    label: (__VLS_ctx.t('coinHub.boostLuck')),
    variant: "luck",
}));
const __VLS_54 = __VLS_53({
    label: (__VLS_ctx.t('coinHub.boostLuck')),
    variant: "luck",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const __VLS_57 = CoinHubUpgradePanel;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
    ...{ class: "md:hidden" },
}));
const __VLS_59 = __VLS_58({
    ...{ class: "md:hidden" },
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "coinhub-panel coinhub-panel--tertiary coinhub-lower__live ch-ds-card ch-ds-card--interactive p-8 lg:col-span-3" },
    'aria-label': (__VLS_ctx.t('coinHub.sectionLive')),
});
/** @type {__VLS_StyleScopedClasses['coinhub-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-panel--tertiary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-lower__live']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "coinhub-sec-h coinhub-sec-h--tertiary mb-5" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-sec-h']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-sec-h--tertiary']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "ch-ds-text-section text-[24px] sm:text-[28px]" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-section']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:text-[28px]']} */ ;
(__VLS_ctx.t('coinHub.sectionLive'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "ch-ds-text-muted mt-2 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.t('coinHub.liveSectionHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
const __VLS_62 = StreamerCard;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
    name: (__VLS_ctx.t('coinHub.streamerPlaceholder')),
    viewersLabel: (__VLS_ctx.t('coinHub.streamerViewersSample1')),
    live: true,
}));
const __VLS_64 = __VLS_63({
    name: (__VLS_ctx.t('coinHub.streamerPlaceholder')),
    viewersLabel: (__VLS_ctx.t('coinHub.streamerViewersSample1')),
    live: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
const __VLS_67 = StreamerCard;
// @ts-ignore
const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
    name: (__VLS_ctx.t('coinHub.streamerPlaceholder')),
    viewersLabel: (__VLS_ctx.t('coinHub.streamerViewersSample2')),
    live: true,
}));
const __VLS_69 = __VLS_68({
    name: (__VLS_ctx.t('coinHub.streamerPlaceholder')),
    viewersLabel: (__VLS_ctx.t('coinHub.streamerViewersSample2')),
    live: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_68));
const __VLS_72 = StreamerCard;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
    name: (__VLS_ctx.t('coinHub.streamerPlaceholder')),
    viewersLabel: (__VLS_ctx.t('coinHub.streamerViewersSample3')),
    live: true,
}));
const __VLS_74 = __VLS_73({
    name: (__VLS_ctx.t('coinHub.streamerPlaceholder')),
    viewersLabel: (__VLS_ctx.t('coinHub.streamerViewersSample3')),
    live: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
// @ts-ignore
[t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t,];
var __VLS_13;
const __VLS_77 = AppFullPageLoader;
// @ts-ignore
const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({
    visible: (__VLS_ctx.showPageLoader),
    'aria-label': (__VLS_ctx.t('app.routeLoadingAria')),
    teleport: (false),
    label: "",
}));
const __VLS_79 = __VLS_78({
    visible: (__VLS_ctx.showPageLoader),
    'aria-label': (__VLS_ctx.t('app.routeLoadingAria')),
    teleport: (false),
    label: "",
}, ...__VLS_functionalComponentArgsRest(__VLS_78));
if (__VLS_ctx.caseModalOpen) {
    let __VLS_82;
    /** @ts-ignore @type { | typeof __VLS_components.CaseOpeningModal} */
    CaseOpeningModal;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({
        ...{ 'onUpdate:open': {} },
        open: (__VLS_ctx.caseModalOpen),
        title: (__VLS_ctx.caseModalTitle || __VLS_ctx.t('coinHub.casePlaceholder')),
        resolving: (__VLS_ctx.caseModalResolving),
        rewardLine: (__VLS_ctx.caseModalReward),
    }));
    const __VLS_84 = __VLS_83({
        ...{ 'onUpdate:open': {} },
        open: (__VLS_ctx.caseModalOpen),
        title: (__VLS_ctx.caseModalTitle || __VLS_ctx.t('coinHub.casePlaceholder')),
        resolving: (__VLS_ctx.caseModalResolving),
        rewardLine: (__VLS_ctx.caseModalReward),
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    let __VLS_87;
    const __VLS_88 = ({ 'update:open': {} },
        { 'onUpdate:open': (__VLS_ctx.onCaseModalUpdateOpen) });
    var __VLS_85;
    var __VLS_86;
}
// @ts-ignore
[showPageLoader, t, t, caseModalOpen, caseModalOpen, caseModalTitle, caseModalResolving, caseModalReward, onCaseModalUpdateOpen,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
