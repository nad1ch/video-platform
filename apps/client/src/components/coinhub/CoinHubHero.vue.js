/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useCoinHubStore } from '@/stores/coinHub';
import HeroSection from '@/components/coinhub/HeroSection.vue';
import '@/styles/coinhub-design-system.css';
const __VLS_props = withDefaults(defineProps(), { isFocalTarget: false, adminDevLabel: undefined });
const { t } = useI18n();
const coinHub = useCoinHubStore();
const { balanceCelebrationPulse, premiumCelebrationHeroLift } = storeToRefs(coinHub);
const heroHeaderRef = ref(null);
const celebrationTeleportReady = ref(false);
const celebrationSpacerH = ref(0);
const celebrationFixedBox = ref(null);
const hasPendingCoins = computed(() => coinHub.pending > 0);
const displayAmount = ref(0);
const balanceFlash = ref(false);
const showGainFloat = ref(false);
const gainKey = ref(0);
const lastClaimAdd = ref(0);
let rafId = 0;
let floatTimer = null;
let balanceFlashTimer = null;
let noPendingToastTimer = null;
let celebrationPulseTimer = null;
let animating = false;
const showNoPendingToast = ref(false);
const balanceCelebrationAnim = ref(false);
const formattedBalance = computed(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(displayAmount.value));
const formattedPending = computed(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(coinHub.pending));
onMounted(() => {
    displayAmount.value = coinHub.balance;
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', onHeroCelebrationResize, { passive: true });
    }
});
onBeforeUnmount(() => {
    if (rafId)
        cancelAnimationFrame(rafId);
    if (floatTimer)
        clearTimeout(floatTimer);
    if (balanceFlashTimer)
        clearTimeout(balanceFlashTimer);
    if (noPendingToastTimer) {
        clearTimeout(noPendingToastTimer);
        noPendingToastTimer = null;
    }
    if (celebrationPulseTimer) {
        clearTimeout(celebrationPulseTimer);
        celebrationPulseTimer = null;
    }
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onHeroCelebrationResize);
    }
    resetHeroCelebrationLift();
});
const teleportCelebrationToBody = computed(() => premiumCelebrationHeroLift.value && celebrationTeleportReady.value);
const heroCelebrationFixedStyle = computed(() => {
    if (!teleportCelebrationToBody.value || !celebrationFixedBox.value) {
        return {};
    }
    const b = celebrationFixedBox.value;
    return {
        position: 'fixed',
        top: `${b.top}px`,
        left: `${b.left}px`,
        width: `${b.width}px`,
        zIndex: '10060',
        pointerEvents: 'auto',
    };
});
function measureHeroForCelebration() {
    const el = heroHeaderRef.value;
    if (!el) {
        return;
    }
    const r = el.getBoundingClientRect();
    celebrationSpacerH.value = r.height;
    celebrationFixedBox.value = { top: r.top, left: r.left, width: r.width };
    celebrationTeleportReady.value = true;
}
function onHeroCelebrationResize() {
    if (!premiumCelebrationHeroLift.value || !celebrationTeleportReady.value) {
        return;
    }
    measureHeroForCelebration();
}
function resetHeroCelebrationLift() {
    celebrationTeleportReady.value = false;
    celebrationSpacerH.value = 0;
    celebrationFixedBox.value = null;
}
watch(premiumCelebrationHeroLift, (lift) => {
    if (!lift) {
        resetHeroCelebrationLift();
        return;
    }
    void nextTick().then(() => {
        requestAnimationFrame(() => {
            measureHeroForCelebration();
        });
    });
}, { flush: 'post' });
watch(balanceCelebrationPulse, () => {
    if (celebrationPulseTimer) {
        clearTimeout(celebrationPulseTimer);
        celebrationPulseTimer = null;
    }
    balanceCelebrationAnim.value = true;
    celebrationPulseTimer = setTimeout(() => {
        balanceCelebrationAnim.value = false;
        celebrationPulseTimer = null;
    }, 620);
});
watch(() => coinHub.balance, (b) => {
    if (animating) {
        return;
    }
    if (coinHub.consumeBalanceSkipForPremiumCountUp()) {
        if (balanceFlashTimer) {
            clearTimeout(balanceFlashTimer);
        }
        balanceFlash.value = true;
        balanceFlashTimer = setTimeout(() => {
            balanceFlash.value = false;
            balanceFlashTimer = null;
        }, 200);
        runCountUp(b, 520);
        return;
    }
    if (displayAmount.value !== b) {
        displayAmount.value = b;
    }
});
function runCountUp(nextTotal, duration = 400) {
    const start = displayAmount.value;
    const delta = nextTotal - start;
    if (delta === 0)
        return;
    const t0 = performance.now();
    animating = true;
    const step = (now) => {
        const u = Math.min(1, (now - t0) / duration);
        const eased = 1 - (1 - u) * (1 - u);
        displayAmount.value = Math.round(start + delta * eased);
        if (u < 1) {
            rafId = requestAnimationFrame(step);
        }
        else {
            displayAmount.value = nextTotal;
            rafId = 0;
            animating = false;
        }
    };
    rafId = requestAnimationFrame(step);
}
async function onClaim() {
    if (animating)
        return;
    const add = Math.max(0, coinHub.pending);
    if (add <= 0) {
        if (noPendingToastTimer) {
            clearTimeout(noPendingToastTimer);
            noPendingToastTimer = null;
        }
        showNoPendingToast.value = true;
        noPendingToastTimer = setTimeout(() => {
            showNoPendingToast.value = false;
            noPendingToastTimer = null;
        }, 3600);
        return;
    }
    animating = true;
    try {
        await coinHub.claimPending();
    }
    catch {
        animating = false;
        return;
    }
    lastClaimAdd.value = add;
    if (balanceFlashTimer)
        clearTimeout(balanceFlashTimer);
    balanceFlash.value = true;
    balanceFlashTimer = setTimeout(() => {
        balanceFlash.value = false;
        balanceFlashTimer = null;
    }, 220);
    if (floatTimer)
        clearTimeout(floatTimer);
    gainKey.value += 1;
    showGainFloat.value = true;
    floatTimer = setTimeout(() => {
        showGainFloat.value = false;
        floatTimer = null;
    }, 520);
    runCountUp(coinHub.balance, 450);
}
const __VLS_defaults = { isFocalTarget: false, adminDevLabel: undefined };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['coinhub-claim-toast']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero-header']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero-header']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero--overlay-focus']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero-header']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero--overlay-focus']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-admin']} */ ;
/** @type {__VLS_StyleScopedClasses['hero__right']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero__right']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero__coin-face']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero__balance-wrap--celebration']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-hero__balance-glow']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
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
if (__VLS_ctx.showNoPendingToast) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-claim-toast" },
        role: "status",
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-claim-toast']} */ ;
    (__VLS_ctx.t('coinHub.claimNoPending'));
}
// @ts-ignore
[showNoPendingToast, t,];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-hero-mount w-full min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero-mount']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-hero-spacer w-full" },
    ...{ style: ({ minHeight: __VLS_ctx.celebrationSpacerH + 'px' }) },
    'aria-hidden': "true",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.celebrationSpacerH > 0) }, null, null);
/** @type {__VLS_StyleScopedClasses['coinhub-hero-spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    to: "body",
    disabled: (!__VLS_ctx.teleportCelebrationToBody),
}));
const __VLS_8 = __VLS_7({
    to: "body",
    disabled: (!__VLS_ctx.teleportCelebrationToBody),
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    id: "coinhub-hero-root",
    ref: "heroHeaderRef",
    ...{ class: "coinhub-hero-header w-full min-w-0 max-w-none" },
    ...{ class: (__VLS_ctx.premiumCelebrationHeroLift && 'coinhub-hero--overlay-focus') },
    ...{ style: (__VLS_ctx.heroCelebrationFixedStyle) },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero-header']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-none']} */ ;
const __VLS_12 = HeroSection || HeroSection;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
const { default: __VLS_17 } = __VLS_15.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-hero__slot relative flex h-full min-h-0 w-full flex-col" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero__slot']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
if (__VLS_ctx.adminDevLabel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hero-admin" },
    });
    /** @type {__VLS_StyleScopedClasses['hero-admin']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        role: "status",
        'aria-live': "polite",
    });
    (__VLS_ctx.adminDevLabel);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "coinhub-hero__main flex min-h-0 w-full min-w-0 flex-1 items-center justify-between gap-4" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero__main']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hero__left ch-hero-balance flex min-w-0 flex-col justify-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['hero__left']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-hero-balance']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[#9CA3AF]']} */ ;
(__VLS_ctx.balanceLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: ([
            'coinhub-hero__balance-wrap relative mt-1 inline-flex max-w-full items-baseline gap-2',
            __VLS_ctx.balanceCelebrationAnim && 'coinhub-hero__balance-wrap--celebration',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero__balance-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-baseline']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-hero__balance-glow pointer-events-none absolute -inset-4 -z-10 rounded-3xl opacity-90" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero__balance-glow']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['-inset-4']} */ ;
/** @type {__VLS_StyleScopedClasses['-z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-90']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "ch-hero-balance-digits tabular-nums" },
    ...{ class: ([__VLS_ctx.balanceFlash && 'coinhub-hero-balance-digits--flash']) },
});
/** @type {__VLS_StyleScopedClasses['ch-hero-balance-digits']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.formattedBalance);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    id: "coinhub-balance-fly-target",
    ...{ class: "coinhub-hero__coin-ico mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero__coin-ico']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:h-10']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-10']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "coinhub-hero__coin-face" },
});
/** @type {__VLS_StyleScopedClasses['coinhub-hero__coin-face']} */ ;
if (__VLS_ctx.showGainFloat) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (__VLS_ctx.gainKey),
        ...{ class: "coinhub-gain-float pointer-events-none absolute -right-0.5 top-0 text-sm font-semibold tabular-nums text-amber-200 sm:-right-1" },
        'aria-hidden': (true),
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-gain-float']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['-right-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:-right-1']} */ ;
    (__VLS_ctx.lastClaimAdd);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-2 text-sm leading-snug text-[#6B7280]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-snug']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[#6B7280]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.pendingLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ms-1 font-semibold tabular-nums" },
    ...{ class: (__VLS_ctx.hasPendingCoins ? 'text-[#FEF3C7]' : 'text-[#6B7280]') },
});
/** @type {__VLS_StyleScopedClasses['ms-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
(__VLS_ctx.formattedPending);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hero__right" },
    ...{ class: ([__VLS_ctx.coinHub.claimInFlight && 'coinhub-hero-claim--loading']) },
});
/** @type {__VLS_StyleScopedClasses['hero__right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.onClaim) },
    type: "button",
    ...{ class: "hero-cta" },
    ...{ class: ([__VLS_ctx.isFocalTarget && 'hero-cta--focal']) },
    disabled: (__VLS_ctx.animating || __VLS_ctx.coinHub.claimInFlight),
});
/** @type {__VLS_StyleScopedClasses['hero-cta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.coinHub.claimInFlight && 'opacity-60') },
});
(__VLS_ctx.claimLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "hero-cta__icon hero-cta__icon--crown" },
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['hero-cta__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-cta__icon--crown']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294L11.562 3.266Z",
    stroke: "currentColor",
    'stroke-width': "1.5",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M5 21h14",
    stroke: "currentColor",
    'stroke-width': "1.5",
    'stroke-linecap': "round",
});
if (__VLS_ctx.coinHub.claimInFlight) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "hero-cta__spinner-wrap" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['hero-cta__spinner-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "coinhub-inline-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white" },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-inline-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white/25']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t-white']} */ ;
}
// @ts-ignore
[celebrationSpacerH, celebrationSpacerH, teleportCelebrationToBody, premiumCelebrationHeroLift, heroCelebrationFixedStyle, adminDevLabel, adminDevLabel, balanceLabel, balanceCelebrationAnim, balanceFlash, formattedBalance, showGainFloat, gainKey, lastClaimAdd, pendingLabel, hasPendingCoins, formattedPending, coinHub, coinHub, coinHub, coinHub, onClaim, isFocalTarget, animating, claimLabel,];
var __VLS_15;
// @ts-ignore
[];
var __VLS_9;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
