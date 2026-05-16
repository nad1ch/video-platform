/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useCoinHubStore } from '@/stores/coinHub';
import { playCoinCollect, playUiClick } from '@/utils/coinHub/coinHubAudioStub';
import { premiumMonthlyCoins } from '@/utils/coinHub/coinHubPremiumRewards';
import PricingPlanCard from '@/components/coinhub/PricingPlanCard.vue';
import '@/styles/coinhub-design-system.css';
const FAKE_PURCHASE_MS = 1200;
const MODAL_FADE_OUT_MS = 600;
const CELEBRATION_FLY_DELAY_MS = 450;
const FLY_COIN_COUNT = 20;
const FLY_STAGGER_MS = 40;
const FLY_TO_BALANCE_MS = 900 + (FLY_COIN_COUNT - 1) * FLY_STAGGER_MS + 200;
const POST_FLY_HOLD_MS = 1800;
const CELEBRATION_OVERLAY_FADE_OUT_MS = 520;
const props = withDefaults(defineProps(), { open: false });
const emit = defineEmits();
const { t } = useI18n();
const coinHub = useCoinHubStore();
const { premiumCelebrationHeroLift } = storeToRefs(coinHub);
const planOrder = ['basic', 'plus', 'pro'];
const fakePhase = ref('idle');
const targetPlan = ref(null);
const uxPhase = ref('modal');
const modalShellDuringCelebration = ref(false);
const celebrationExiting = ref(false);
const celebrationFlySourceRef = ref(null);
const balanceSpot = ref(null);
const rewardFlyActive = ref(false);
const flyCoins = ref([]);
const rewardGrantLine = computed(() => {
    const p = targetPlan.value;
    if (p === 'plus' || p === 'pro') {
        return t('coinHub.premiumRewardGrant', { n: premiumMonthlyCoins(p) });
    }
    return '';
});
const celebrationTitle = computed(() => {
    const p = targetPlan.value;
    if (p === 'plus') {
        return t('coinHub.premiumUpgradeCelebrationTitle', { plan: t('coinHub.planPlus') });
    }
    if (p === 'pro') {
        return t('coinHub.premiumUpgradeCelebrationTitle', { plan: t('coinHub.planPro') });
    }
    return '';
});
const reduceMotion = computed(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const showModalLayer = computed(() => {
    if (!props.open) {
        return false;
    }
    if (uxPhase.value === 'modal') {
        return true;
    }
    if (uxPhase.value === 'celebration' && modalShellDuringCelebration.value) {
        return true;
    }
    return false;
});
const blockBackdrop = computed(() => fakePhase.value === 'purchasing' ||
    uxPhase.value === 'celebration' ||
    rewardFlyActive.value);
let purchaseEndTimer = null;
let modalExitTimer = null;
let flyStartTimer = null;
let flyEndTimer = null;
let celebrationPostFlyTimer = null;
let celebrationCloseTimer = null;
function clearPurchaseEndTimer() {
    if (purchaseEndTimer) {
        clearTimeout(purchaseEndTimer);
        purchaseEndTimer = null;
    }
}
function clearModalExitTimer() {
    if (modalExitTimer) {
        clearTimeout(modalExitTimer);
        modalExitTimer = null;
    }
}
function clearFlyTimers() {
    if (flyStartTimer) {
        clearTimeout(flyStartTimer);
        flyStartTimer = null;
    }
    if (flyEndTimer) {
        clearTimeout(flyEndTimer);
        flyEndTimer = null;
    }
}
function clearCelebrationEndTimers() {
    if (celebrationPostFlyTimer) {
        clearTimeout(celebrationPostFlyTimer);
        celebrationPostFlyTimer = null;
    }
    if (celebrationCloseTimer) {
        clearTimeout(celebrationCloseTimer);
        celebrationCloseTimer = null;
    }
}
function makeFlyCoins(sx, sy, ex, ey, count) {
    const ddx = ex - sx;
    const ddy = ey - sy;
    return Array.from({ length: count }, (_, i) => {
        const jx = (Math.random() - 0.5) * 40;
        const jy = (Math.random() - 0.5) * 40;
        return {
            id: `fly-${i}-${Date.now()}`,
            x: sx + jx,
            y: sy + jy,
            tx: ddx - jx,
            ty: ddy - jy,
            delay: `${i * FLY_STAGGER_MS}ms`,
            duration: `${0.78 + Math.random() * 0.2}s`,
        };
    });
}
function updateBalanceSpot() {
    const el = document.getElementById('coinhub-balance-fly-target');
    if (!el) {
        return;
    }
    const r = el.getBoundingClientRect();
    balanceSpot.value = {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        w: r.width,
        h: r.height,
    };
}
function resetFakePurchase() {
    clearPurchaseEndTimer();
    clearModalExitTimer();
    clearFlyTimers();
    clearCelebrationEndTimers();
    fakePhase.value = 'idle';
    targetPlan.value = null;
    uxPhase.value = 'modal';
    modalShellDuringCelebration.value = false;
    celebrationExiting.value = false;
    rewardFlyActive.value = false;
    flyCoins.value = [];
}
function applyPremiumRewardAndNotify() {
    const plan = targetPlan.value;
    if (plan === 'plus' || plan === 'pro') {
        coinHub.applyLocalPremiumBonus(premiumMonthlyCoins(plan));
        coinHub.requestBalanceCelebrationPulse();
    }
    playCoinCollect();
    if (plan && plan !== 'basic') {
        emit('selectPlan', plan);
    }
}
function finishRewardNoMotion() {
    if (!props.open) {
        return;
    }
    applyPremiumRewardAndNotify();
    void nextTick(() => {
        if (props.open) {
            close();
        }
    });
}
function scheduleCelebrationAutoClose() {
    clearCelebrationEndTimers();
    celebrationPostFlyTimer = setTimeout(() => {
        celebrationPostFlyTimer = null;
        celebrationExiting.value = true;
        celebrationCloseTimer = setTimeout(() => {
            celebrationCloseTimer = null;
            close();
        }, CELEBRATION_OVERLAY_FADE_OUT_MS);
    }, POST_FLY_HOLD_MS);
}
function onFlyToBalanceComplete() {
    rewardFlyActive.value = false;
    flyCoins.value = [];
    if (!props.open) {
        return;
    }
    applyPremiumRewardAndNotify();
    scheduleCelebrationAutoClose();
}
async function startRewardFly() {
    await nextTick();
    if (!props.open) {
        return;
    }
    const plan = targetPlan.value;
    if (plan !== 'plus' && plan !== 'pro') {
        return;
    }
    const el = celebrationFlySourceRef.value;
    if (!el) {
        onFlyToBalanceComplete();
        return;
    }
    updateBalanceSpot();
    const tEl = document.getElementById('coinhub-balance-fly-target');
    const pr = el.getBoundingClientRect();
    const scx = pr.left + pr.width / 2;
    const scy = pr.top + pr.height / 2;
    const spot = balanceSpot.value;
    const tr = tEl?.getBoundingClientRect();
    if (!spot && !tr) {
        onFlyToBalanceComplete();
        return;
    }
    const ecx = spot?.cx ?? (tr ? tr.left + tr.width / 2 : scx);
    const ecy = spot?.cy ?? (tr ? tr.top + tr.height / 2 : scy);
    await nextTick();
    flyCoins.value = makeFlyCoins(scx, scy, ecx, ecy, FLY_COIN_COUNT);
    rewardFlyActive.value = true;
    clearFlyTimers();
    flyEndTimer = setTimeout(() => {
        flyEndTimer = null;
        onFlyToBalanceComplete();
    }, FLY_TO_BALANCE_MS);
}
async function onCelebrationLayoutReady() {
    await nextTick();
    await new Promise((r) => {
        requestAnimationFrame(() => r(null));
    });
    clearFlyTimers();
    flyStartTimer = setTimeout(() => {
        flyStartTimer = null;
        if (!props.open) {
            return;
        }
        void startRewardFly();
    }, CELEBRATION_FLY_DELAY_MS);
}
function onPurchaseTimerDone() {
    purchaseEndTimer = null;
    if (!props.open) {
        return;
    }
    fakePhase.value = 'success';
    if (reduceMotion.value) {
        finishRewardNoMotion();
        return;
    }
    updateBalanceSpot();
    clearModalExitTimer();
    modalShellDuringCelebration.value = true;
    uxPhase.value = 'celebration';
    void nextTick(() => {
        updateBalanceSpot();
        requestAnimationFrame(() => {
            updateBalanceSpot();
            void onCelebrationLayoutReady();
        });
    });
    modalExitTimer = setTimeout(() => {
        modalExitTimer = null;
        if (!props.open) {
            return;
        }
        modalShellDuringCelebration.value = false;
    }, MODAL_FADE_OUT_MS);
}
function close() {
    resetFakePurchase();
    emit('update:open', false);
    emit('close');
}
function onBackdropClick() {
    if (blockBackdrop.value) {
        return;
    }
    close();
}
function onDocKey(e) {
    if (e.key === 'Escape' && props.open) {
        e.preventDefault();
        if (blockBackdrop.value) {
            return;
        }
        close();
    }
}
function onBuyFromCard(id) {
    if (id === 'basic') {
        return;
    }
    if (fakePhase.value !== 'idle') {
        return;
    }
    playUiClick();
    targetPlan.value = id;
    fakePhase.value = 'purchasing';
    clearPurchaseEndTimer();
    purchaseEndTimer = setTimeout(onPurchaseTimerDone, FAKE_PURCHASE_MS);
}
function onWindowResize() {
    if (props.open && uxPhase.value === 'celebration') {
        updateBalanceSpot();
    }
}
function onWindowScroll() {
    if (props.open && uxPhase.value === 'celebration') {
        updateBalanceSpot();
    }
}
onMounted(() => {
    document.addEventListener('keydown', onDocKey);
    updateBalanceSpot();
    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true });
});
onUnmounted(() => {
    document.removeEventListener('keydown', onDocKey);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('scroll', onWindowScroll, { capture: true });
});
onBeforeUnmount(() => {
    clearPurchaseEndTimer();
    clearModalExitTimer();
    clearFlyTimers();
    clearCelebrationEndTimers();
    if (document.body.dataset.chPremiumModalPrevOverflow !== undefined) {
        document.body.style.overflow = document.body.dataset.chPremiumModalPrevOverflow ?? '';
        delete document.body.dataset.chPremiumModalPrevOverflow;
    }
});
watch(() => props.open, (o) => {
    if (o) {
        resetFakePurchase();
        const prev = document.body.style.overflow;
        document.body.dataset.chPremiumModalPrevOverflow = prev;
        document.body.style.overflow = 'hidden';
        void nextTick(() => {
            updateBalanceSpot();
        });
    }
    else {
        resetFakePurchase();
        const prev = document.body.dataset.chPremiumModalPrevOverflow;
        document.body.style.overflow = prev ?? '';
        delete document.body.dataset.chPremiumModalPrevOverflow;
    }
});
watch(uxPhase, (p) => {
    if (p === 'celebration') {
        void nextTick(() => {
            updateBalanceSpot();
        });
    }
});
watch(() => [props.open, uxPhase.value], ([o, p]) => {
    premiumCelebrationHeroLift.value = Boolean(o && p === 'celebration');
}, { immediate: true });
const __VLS_defaults = { open: false };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__root--exit']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__root--exit']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal-anim-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__root--exit']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__root--exit']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__title']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__backdrop--dim-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay--fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay--fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__glow']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__sparks']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__content']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay--fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__glow']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay--fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__sparks']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay--fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__content']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay--exit']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__spark']} */ ;
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog--pulse']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "prem-modal-anim",
}));
const __VLS_8 = __VLS_7({
    name: "prem-modal-anim",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prem-modal__root fixed inset-0 z-[10030] flex items-center justify-center p-3 sm:p-5" },
    ...{ class: ([
            __VLS_ctx.fakePhase === 'purchasing' && 'prem-modal__root--purchasing',
            __VLS_ctx.uxPhase === 'celebration' && __VLS_ctx.modalShellDuringCelebration && 'prem-modal__root--exit',
        ]) },
    role: "presentation",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open && __VLS_ctx.showModalLayer) }, null, null);
/** @type {__VLS_StyleScopedClasses['prem-modal__root']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[10030]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ onClick: (__VLS_ctx.onBackdropClick) },
    ...{ class: ([
            'prem-modal__backdrop absolute inset-0',
            (__VLS_ctx.fakePhase === 'purchasing' || __VLS_ctx.fakePhase === 'success' || __VLS_ctx.rewardFlyActive) &&
                'prem-modal__backdrop--dim-extra',
        ]) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['prem-modal__backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: () => { } },
    ...{ class: ([
            'prem-modal__dialog relative z-10 flex w-full max-w-7xl flex-col gap-4 overflow-hidden rounded-[22px] border border-violet-500/20 bg-[#070712]/96 p-4 shadow-[0_0_80px_rgba(60,40,140,0.35)] sm:gap-5 sm:p-6',
            __VLS_ctx.fakePhase === 'purchasing' && 'prem-modal__dialog--pulse',
        ]) },
    role: "dialog",
    'aria-modal': "true",
    'aria-busy': (__VLS_ctx.fakePhase === 'purchasing' ? 'true' : undefined),
    'aria-label': (__VLS_ctx.t('coinHub.premiumModalTitle')),
});
/** @type {__VLS_StyleScopedClasses['prem-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-violet-500/20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[#070712]/96']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[0_0_80px_rgba(60,40,140,0.35)]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:gap-5']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:p-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 sm:gap-5" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:gap-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "prem-modal__title m-0 text-left" },
    id: "premium-plans-heading",
});
/** @type {__VLS_StyleScopedClasses['prem-modal__title']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
(__VLS_ctx.t('coinHub.premiumModalTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.close) },
    type: "button",
    ...{ class: "prem-modal__close ch-ds-text-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg leading-none text-white/80 transition duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white" },
    'aria-label': (__VLS_ctx.t('coinHub.premiumModalClose')),
});
/** @type {__VLS_StyleScopedClasses['prem-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-10']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white/80']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-white/20']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prem-modal__grid" },
    'aria-labelledby': "premium-plans-heading",
});
/** @type {__VLS_StyleScopedClasses['prem-modal__grid']} */ ;
for (const [id] of __VLS_vFor((__VLS_ctx.planOrder))) {
    const __VLS_12 = PricingPlanCard;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ 'onBuy': {} },
        key: (id),
        plan: (id),
        fakePhase: (__VLS_ctx.fakePhase),
        fakeTarget: (__VLS_ctx.targetPlan),
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onBuy': {} },
        key: (id),
        plan: (id),
        fakePhase: (__VLS_ctx.fakePhase),
        fakeTarget: (__VLS_ctx.targetPlan),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_17;
    const __VLS_18 = ({ buy: {} },
        { onBuy: (__VLS_ctx.onBuyFromCard) });
    var __VLS_15;
    var __VLS_16;
    // @ts-ignore
    [fakePhase, fakePhase, fakePhase, fakePhase, fakePhase, fakePhase, uxPhase, modalShellDuringCelebration, open, showModalLayer, onBackdropClick, rewardFlyActive, t, t, t, close, planOrder, targetPlan, onBuyFromCard,];
}
// @ts-ignore
[];
var __VLS_9;
// @ts-ignore
[];
var __VLS_3;
let __VLS_19;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
    to: "body",
}));
const __VLS_21 = __VLS_20({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
const { default: __VLS_24 } = __VLS_22.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prem-upgrade-overlay" },
    ...{ class: ([
            __VLS_ctx.celebrationExiting && 'prem-upgrade-overlay--exit',
            !__VLS_ctx.reduceMotion && 'prem-upgrade-overlay--fade-in',
        ]) },
    role: "status",
    'aria-live': "assertive",
    'aria-label': (__VLS_ctx.celebrationTitle),
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open && __VLS_ctx.uxPhase === 'celebration') }, null, null);
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "prem-upgrade-overlay__glow" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__glow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prem-upgrade-overlay__sparks" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__sparks']} */ ;
for (const [n] of __VLS_vFor((4))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        key: (`spk-${n}`),
        ...{ class: (`prem-upgrade-overlay__spark prem-upgrade-overlay__spark--${(n - 1) % 4}`) },
    });
    // @ts-ignore
    [uxPhase, open, celebrationExiting, reduceMotion, celebrationTitle,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prem-upgrade-overlay__content" },
});
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "prem-upgrade-overlay__title" },
});
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__title']} */ ;
(__VLS_ctx.celebrationTitle);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ref: "celebrationFlySourceRef",
    ...{ class: "prem-upgrade-overlay__reward" },
});
/** @type {__VLS_StyleScopedClasses['prem-upgrade-overlay__reward']} */ ;
(__VLS_ctx.rewardGrantLine);
// @ts-ignore
[celebrationTitle, rewardGrantLine,];
var __VLS_22;
let __VLS_25;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
    to: "body",
}));
const __VLS_27 = __VLS_26({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
const { default: __VLS_30 } = __VLS_28.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prem-modal__fly-layer" },
    'aria-hidden': "true",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open && __VLS_ctx.rewardFlyActive && __VLS_ctx.flyCoins.length > 0) }, null, null);
/** @type {__VLS_StyleScopedClasses['prem-modal__fly-layer']} */ ;
for (const [f] of __VLS_vFor((__VLS_ctx.flyCoins))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (f.id),
        ...{ class: "prem-modal__fly-coin" },
        ...{ style: ({
                left: f.x + 'px',
                top: f.y + 'px',
                animationDuration: f.duration,
                animationDelay: f.delay,
                '--ftx': f.tx + 'px',
                '--fty': f.ty + 'px',
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['prem-modal__fly-coin']} */ ;
    // @ts-ignore
    [open, rewardFlyActive, flyCoins, flyCoins,];
}
// @ts-ignore
[];
var __VLS_28;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
