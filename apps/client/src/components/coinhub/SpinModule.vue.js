/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import CoinHubStripRoll from '@/components/coinhub/CoinHubStripRoll.vue';
import { useAdminMode } from '@/composables/useAdminMode';
import { useCoinHubStore } from '@/stores/coinHub';
import { playCoinCollect, playSpinStart, playStripResolving, playWinByRarity, } from '@/utils/coinHub/coinHubAudioStub';
import '@/styles/coinhub-design-system.css';
import { buildSpinStripCells, getSpinRarity } from '@/utils/coinHub/coinHubStripMath';
import { SPIN_BIG_WIN_MIN_COINS } from '@/utils/coinHub/coinHubSpinReel';
const props = withDefaults(defineProps(), {
    showAvailabilityPulse: false,
    isFocalTarget: false,
    targetPayout: 0,
    spinAvailable: true,
    variant: 'default',
    omitHeroHeading: false,
    sectionDescription: undefined,
});
const { t } = useI18n();
const { isAdmin } = useAdminMode();
const coinHub = useCoinHubStore();
const { spinPayout: spinPayoutFromStore } = storeToRefs(coinHub);
const phase = ref('idle');
const impactHold = ref(false);
const winBurst = ref(false);
const showWinPill = ref(false);
const rewardPop = ref(false);
let winTimers = [];
const DRY_STREAK_KEY = 'coinhub:spin-dry-streak';
function readDryStreak() {
    if (typeof sessionStorage === 'undefined') {
        return 0;
    }
    const raw = sessionStorage.getItem(DRY_STREAK_KEY);
    if (!raw) {
        return 0;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? Math.min(999, n) : 0;
}
function writeDryStreak(n) {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    sessionStorage.setItem(DRY_STREAK_KEY, String(n));
}
const spinsSinceBigWin = ref(0);
function syncDryStreakFromStorage() {
    if (isAdmin.value) {
        spinsSinceBigWin.value = 0;
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(DRY_STREAK_KEY);
        }
        return;
    }
    spinsSinceBigWin.value = readDryStreak();
}
onMounted(() => {
    syncDryStreakFromStorage();
});
watch(isAdmin, () => {
    syncDryStreakFromStorage();
});
const rollCells = ref(['—']);
const rollLand = ref(0);
const SPIN_FLY_COUNT = 16;
const SPIN_FLY_STAGGER_MS = 36;
const SPIN_FLY_TOTAL_MS = 900 + (SPIN_FLY_COUNT - 1) * SPIN_FLY_STAGGER_MS + 200;
function makeSpinFlyCoins(sx, sy, ex, ey, count) {
    const ddx = ex - sx;
    const ddy = ey - sy;
    return Array.from({ length: count }, (_, i) => {
        const jx = (Math.random() - 0.5) * 40;
        const jy = (Math.random() - 0.5) * 40;
        return {
            id: `spin-fly-${i}-${Date.now()}`,
            x: sx + jx,
            y: sy + jy,
            tx: ddx - jx,
            ty: ddy - jy,
            delay: `${i * SPIN_FLY_STAGGER_MS}ms`,
            duration: `${0.78 + Math.random() * 0.2}s`,
        };
    });
}
const spinReelFlySourceRef = ref(null);
const spinFlyActive = ref(false);
const spinFlyCoins = ref([]);
let spinFlyEndTimer = null;
/** API truth from Pinia — avoids stale `props.targetPayout` one frame after `await spin()`. */
const finalPayout = computed(() => spinPayoutFromStore.value);
const wonLineAria = computed(() => t('coinHub.spinWon', { n: finalPayout.value }));
const rewardRarity = computed(() => getSpinRarity(finalPayout.value));
const heroWinFrameClass = computed(() => {
    if (!isHero.value || phase.value !== 'result') {
        return null;
    }
    const r = getSpinRarity(finalPayout.value);
    if (r === 'legendary') {
        return 'slot-machine--win-gold slot-machine--win-gold--intense';
    }
    if (r === 'epic' || r === 'rare') {
        return 'slot-machine--win-gold slot-machine--win-gold--mid';
    }
    return 'slot-machine--win-gold';
});
const spinInteractionLock = ref(false);
const rollCompleteHandled = ref(false);
const stripMeta = ref({
    remainingMainMs: 9999,
    rawU: 0,
    scrollPos: 0,
    preWin: false,
    heartbeat: false,
    inMainPhase: false,
});
const displayAmount = ref(0);
const camSnap = ref(false);
let countAnimRaf = 0;
const useReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cameraIn = computed(() => phase.value === 'rolling' &&
    stripMeta.value.rawU >= 0.38 &&
    stripMeta.value.rawU < 0.999 &&
    stripMeta.value.inMainPhase);
const isHero = computed(() => props.variant === 'hero');
const stripItemW = computed(() => (isHero.value ? 90 : 72));
const stripSize = computed(() => (isHero.value ? 'lg' : 'md'));
const spinStripDurationMs = computed(() => (isHero.value ? 10_000 : 3200));
const rollIsPlaceholder = computed(() => rollCells.value.length === 1 && rollCells.value[0] === '—');
const stripIdleAutoplay = computed(() => isHero.value &&
    phase.value === 'idle' &&
    rollIsPlaceholder.value &&
    !coinHub.spinInFlight);
function clearWinTimers() {
    if (spinFlyEndTimer) {
        clearTimeout(spinFlyEndTimer);
        spinFlyEndTimer = null;
    }
    winTimers.forEach((id) => {
        clearTimeout(id);
    });
    winTimers = [];
}
async function onSpinCta() {
    if (spinInteractionLock.value) {
        return;
    }
    if (!props.spinAvailable) {
        return;
    }
    if (phase.value === 'resolving' || phase.value === 'rolling' || impactHold.value) {
        return;
    }
    if (coinHub.spinInFlight) {
        return;
    }
    spinInteractionLock.value = true;
    rollCompleteHandled.value = false;
    clearWinTimers();
    winBurst.value = false;
    showWinPill.value = false;
    rewardPop.value = false;
    displayAmount.value = 0;
    camSnap.value = false;
    stripMeta.value = {
        remainingMainMs: 9999,
        rawU: 0,
        scrollPos: 0,
        preWin: false,
        heartbeat: false,
        inMainPhase: false,
    };
    playSpinStart();
    playStripResolving();
    phase.value = 'resolving';
    rollCells.value = ['—'];
    rollLand.value = 0;
    await nextTick();
    if (!useReducedMotion) {
        await new Promise((r) => {
            window.setTimeout(r, 100);
        });
    }
    const ok = await coinHub.spin();
    if (!ok) {
        phase.value = 'idle';
        spinInteractionLock.value = false;
        return;
    }
    await nextTick();
    const { cells, landIndex } = buildSpinStripCells(spinPayoutFromStore.value, {
        spinsSinceBigWin: isAdmin.value ? 0 : spinsSinceBigWin.value,
    });
    rollCells.value = cells;
    rollLand.value = landIndex;
    phase.value = 'rolling';
    await nextTick();
    impactHold.value = false;
}
function scheduleWinBurstEnd() {
    const tEndBurst = window.setTimeout(() => {
        winBurst.value = false;
    }, 520);
    winTimers.push(tEndBurst);
}
function presentSpinWinImmediate() {
    phase.value = 'result';
    showWinPill.value = true;
    rewardPop.value = true;
    winBurst.value = true;
    scheduleWinBurstEnd();
    coinHub.requestBalanceCelebrationPulse();
    playCoinCollect();
    spinInteractionLock.value = false;
}
async function presentSpinWinWithFly() {
    await nextTick();
    const el = spinReelFlySourceRef.value;
    const tEl = document.getElementById('coinhub-balance-fly-target');
    if (!el || !tEl) {
        presentSpinWinImmediate();
        return;
    }
    const pr = el.getBoundingClientRect();
    const tr = tEl.getBoundingClientRect();
    const scx = pr.left + pr.width / 2;
    const scy = pr.top + pr.height / 2;
    const ecx = tr.left + tr.width / 2;
    const ecy = tr.top + tr.height / 2;
    spinFlyCoins.value = makeSpinFlyCoins(scx, scy, ecx, ecy, SPIN_FLY_COUNT);
    spinFlyActive.value = true;
    phase.value = 'result';
    showWinPill.value = true;
    rewardPop.value = true;
    winBurst.value = true;
    scheduleWinBurstEnd();
    spinFlyEndTimer = window.setTimeout(() => {
        spinFlyEndTimer = null;
        spinFlyActive.value = false;
        spinFlyCoins.value = [];
        coinHub.requestBalanceCelebrationPulse();
        playCoinCollect();
    }, SPIN_FLY_TOTAL_MS);
    spinInteractionLock.value = false;
}
function onRollComplete() {
    if (phase.value !== 'rolling') {
        return;
    }
    if (rollCompleteHandled.value) {
        return;
    }
    rollCompleteHandled.value = true;
    const payout = finalPayout.value;
    if (payout > 0) {
        playWinByRarity(getSpinRarity(payout));
    }
    if (!isAdmin.value) {
        if (payout >= SPIN_BIG_WIN_MIN_COINS) {
            spinsSinceBigWin.value = 0;
        }
        else {
            spinsSinceBigWin.value += 1;
        }
        writeDryStreak(spinsSinceBigWin.value);
    }
    clearWinTimers();
    impactHold.value = true;
    winBurst.value = false;
    showWinPill.value = false;
    rewardPop.value = false;
    const impactDelayMs = useReducedMotion ? 0 : 300;
    const tImpact = window.setTimeout(() => {
        if (useReducedMotion || !isHero.value || payout <= 0) {
            presentSpinWinImmediate();
            return;
        }
        void presentSpinWinWithFly();
    }, impactDelayMs);
    winTimers.push(tImpact);
    const tReleaseCta = window.setTimeout(() => {
        impactHold.value = false;
    }, useReducedMotion ? 400 : 950);
    winTimers.push(tReleaseCta);
}
function onStripProgress(_scrollPos, meta) {
    stripMeta.value = meta;
}
watch(showWinPill, (show) => {
    if (countAnimRaf) {
        cancelAnimationFrame(countAnimRaf);
        countAnimRaf = 0;
    }
    if (!show) {
        displayAmount.value = 0;
        return;
    }
    const target = finalPayout.value;
    if (useReducedMotion) {
        displayAmount.value = target;
        return;
    }
    const start = performance.now();
    const dur = 780 + Math.random() * 120;
    function tick(now) {
        const u = Math.min(1, (now - start) / dur);
        const e = 1 - (1 - u) ** 3;
        displayAmount.value = Math.round(target * e);
        if (u < 1) {
            countAnimRaf = requestAnimationFrame(tick);
        }
        else {
            displayAmount.value = target;
            countAnimRaf = 0;
        }
    }
    countAnimRaf = requestAnimationFrame(tick);
});
watch(winBurst, (v) => {
    if (v) {
        camSnap.value = true;
        window.setTimeout(() => {
            camSnap.value = false;
        }, 380);
    }
});
onBeforeUnmount(() => {
    clearWinTimers();
    if (countAnimRaf) {
        cancelAnimationFrame(countAnimRaf);
    }
});
const __VLS_defaults = {
    showAvailabilityPulse: false,
    isFocalTarget: false,
    targetPayout: 0,
    spinAvailable: true,
    variant: 'default',
    omitHeroHeading: false,
    sectionDescription: undefined,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['daily-spin__status-text']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-machine']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-machine__cap']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-machine']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-machine__cap--left']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-machine__cap--right']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot__particles']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--rarity-legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--rarity-epic']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--rarity-rare']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window__sweep']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window__spin-motes']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll']} */ ;
/** @type {__VLS_StyleScopedClasses['slot-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-spin__cta']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-spin__cta']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-machine--hero']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-machine__cap']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-float--reveal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-locked']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--interactive']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-locked']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-locked']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-daily--focal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-cta--arcade']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-cta--arcade']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-ds-btn-purple']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-cta--arcade']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-slot-heart--on']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-slot-cam--in']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-win-particle']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-spin--ready']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--live']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--live']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-spin__status-dot--pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__amount--rarity-legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window__sweep']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window__spin-motes']} */ ;
/** @type {__VLS_StyleScopedClasses['reel-window__spin-motes']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--live']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot--result']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-reward-float--reveal']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-spin-win__amount--hero-gold']} */ ;
if (__VLS_ctx.isHero) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: ([
                'coinhub-spin daily-spin flex w-full min-w-0 flex-col',
                __VLS_ctx.isFocalTarget && 'daily-spin--focal',
                __VLS_ctx.spinAvailable && 'daily-spin--ready',
                !__VLS_ctx.spinAvailable && 'daily-spin--locked',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-spin']} */ ;
    /** @type {__VLS_StyleScopedClasses['daily-spin']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "daily-spin__header" },
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "daily-spin__subtitle" },
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__subtitle']} */ ;
    (__VLS_ctx.tagLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "daily-spin__title" },
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__title']} */ ;
    (__VLS_ctx.title);
    if (__VLS_ctx.sectionDescription) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "daily-spin__desc" },
        });
        /** @type {__VLS_StyleScopedClasses['daily-spin__desc']} */ ;
        (__VLS_ctx.sectionDescription);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "daily-spin__status" },
        ...{ class: (!__VLS_ctx.spinAvailable && 'daily-spin__status--off') },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__status']} */ ;
    if (__VLS_ctx.showAvailabilityPulse) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "daily-spin__status-dot daily-spin__status-dot--pulse" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['daily-spin__status-dot']} */ ;
        /** @type {__VLS_StyleScopedClasses['daily-spin__status-dot--pulse']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "daily-spin__status-dot" },
            ...{ class: (__VLS_ctx.spinAvailable && 'daily-spin__status-dot--live') },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['daily-spin__status-dot']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "daily-spin__status-text" },
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__status-text']} */ ;
    (__VLS_ctx.spinAvailable ? __VLS_ctx.stateLabelAvailable : (__VLS_ctx.spinCooldownHint || __VLS_ctx.t('coinHub.stateLocked')));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "daily-spin__machine" },
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__machine']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'slot-machine',
                __VLS_ctx.spinAvailable && 'slot-machine--live',
                (__VLS_ctx.phase === 'rolling' || __VLS_ctx.phase === 'resolving' || __VLS_ctx.impactHold) && 'slot-machine--rolling',
                __VLS_ctx.heroWinFrameClass,
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['slot-machine']} */ ;
    if (__VLS_ctx.isHero && __VLS_ctx.phase === 'result' && __VLS_ctx.rewardRarity === 'legendary') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "slot-machine__legendary-flash pointer-events-none" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['slot-machine__legendary-flash']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "slot-machine__cap slot-machine__cap--left" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['slot-machine__cap']} */ ;
    /** @type {__VLS_StyleScopedClasses['slot-machine__cap--left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "slot-machine__cap slot-machine__cap--right" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['slot-machine__cap']} */ ;
    /** @type {__VLS_StyleScopedClasses['slot-machine__cap--right']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'slot daily-slot',
                __VLS_ctx.spinAvailable && 'daily-slot--live',
                (__VLS_ctx.phase === 'result' || __VLS_ctx.winBurst) && 'daily-slot--result',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['slot']} */ ;
    /** @type {__VLS_StyleScopedClasses['daily-slot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "daily-slot__particles" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['daily-slot__particles']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "slot-machine__reel-assembly relative w-full min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['slot-machine__reel-assembly']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "slot-pointer" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['slot-pointer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (['coinhub-spin-stage daily-slot__stage relative w-full min-w-0', __VLS_ctx.phase === 'rolling' && 'daily-slot__stage--rolling']) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-stage']} */ ;
    /** @type {__VLS_StyleScopedClasses['daily-slot__stage']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    if (__VLS_ctx.winBurst || __VLS_ctx.phase === 'result') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coinhub-win-vignette pointer-events-none absolute inset-[-4%] z-[25] rounded-[1.1rem] md:rounded-[1.25rem]" },
            ...{ class: (__VLS_ctx.winBurst && 'coinhub-win-vignette--hot') },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-vignette']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-[-4%]']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[25]']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[1.1rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:rounded-[1.25rem]']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-slot-bezel daily-slot__bezel relative z-[2] flex min-h-[120px] w-full min-w-0 items-stretch transition-[transform] duration-[220ms] ease-out will-change-transform',
                'rounded-[20px] p-0',
                __VLS_ctx.spinAvailable && 'coinhub-slot-bezel--live',
                __VLS_ctx.cameraIn && 'coinhub-slot-cam--in',
                __VLS_ctx.camSnap && 'coinhub-slot-cam--snap',
            ]) },
        role: "status",
        'aria-live': (__VLS_ctx.phase === 'rolling' || __VLS_ctx.impactHold ? 'polite' : 'off'),
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-bezel']} */ ;
    /** @type {__VLS_StyleScopedClasses['daily-slot__bezel']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[2]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[120px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-stretch']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-[transform]']} */ ;
    /** @type {__VLS_StyleScopedClasses['duration-[220ms]']} */ ;
    /** @type {__VLS_StyleScopedClasses['ease-out']} */ ;
    /** @type {__VLS_StyleScopedClasses['will-change-transform']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'reel-window coinhub-slot-window coinhub-slot-window--fg relative z-[3] m-0 h-full min-h-[120px] w-full min-w-0 overflow-hidden rounded-2xl',
                __VLS_ctx.impactHold && 'coinhub-spin-surface--impact',
                (__VLS_ctx.phase === 'result' || __VLS_ctx.winBurst) && 'coinhub-spin-surface--won',
                __VLS_ctx.winBurst && 'coinhub-spin-surface--win-burst',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['reel-window']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-window']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-window--fg']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[3]']} */ ;
    /** @type {__VLS_StyleScopedClasses['m-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[120px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "reel-focus" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['reel-focus']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "reel-window__sweep" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['reel-window__sweep']} */ ;
    if (__VLS_ctx.phase === 'rolling') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "reel-window__spin-motes" },
            ...{ class: (__VLS_ctx.stripMeta.heartbeat && 'reel-window__spin-motes--hot') },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['reel-window__spin-motes']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-slot-heart relative z-[1] h-full min-h-[120px] w-full will-change-transform',
                __VLS_ctx.stripMeta.heartbeat && 'coinhub-slot-heart--on',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-heart']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[120px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['will-change-transform']} */ ;
    if (__VLS_ctx.winBurst) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coinhub-win-burst pointer-events-none absolute inset-0 z-[20]" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-burst']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[20]']} */ ;
    }
    if (__VLS_ctx.winBurst) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coinhub-win-flash pointer-events-none absolute inset-0 z-[21] mix-blend-screen" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-flash']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[21]']} */ ;
        /** @type {__VLS_StyleScopedClasses['mix-blend-screen']} */ ;
    }
    if (__VLS_ctx.winBurst) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "coinhub-win-particles pointer-events-none absolute inset-0 z-[19]" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-particles']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[19]']} */ ;
        for (const [n] of __VLS_vFor((9))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                key: (n),
                ...{ class: "coinhub-win-particle" },
                ...{ style: ({ '--ch-pa': `${n * 40}deg`, '--ch-pd': `${0.38 + (n % 4) * 0.1}` }) },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-win-particle']} */ ;
            // @ts-ignore
            [isHero, isHero, isFocalTarget, spinAvailable, spinAvailable, spinAvailable, spinAvailable, spinAvailable, spinAvailable, spinAvailable, spinAvailable, tagLabel, title, sectionDescription, sectionDescription, showAvailabilityPulse, stateLabelAvailable, spinCooldownHint, t, phase, phase, phase, phase, phase, phase, phase, phase, phase, impactHold, impactHold, impactHold, heroWinFrameClass, rewardRarity, winBurst, winBurst, winBurst, winBurst, winBurst, winBurst, winBurst, winBurst, cameraIn, camSnap, stripMeta, stripMeta,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "spinReelFlySourceRef",
        ...{ class: "relative min-h-0 w-full" },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    const __VLS_0 = CoinHubStripRoll;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onProgress': {} },
        ...{ 'onComplete': {} },
        ...{ class: "daily-slot__strip" },
        cells: (__VLS_ctx.rollCells),
        landIndex: (__VLS_ctx.rollLand),
        itemWidthPx: (__VLS_ctx.stripItemW),
        size: (__VLS_ctx.stripSize),
        durationMs: (__VLS_ctx.spinStripDurationMs),
        enableIdleAutoplay: (__VLS_ctx.stripIdleAutoplay),
        highlightLandWin: (__VLS_ctx.phase === 'result'),
        dailyAnticipationEasing: true,
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onProgress': {} },
        ...{ 'onComplete': {} },
        ...{ class: "daily-slot__strip" },
        cells: (__VLS_ctx.rollCells),
        landIndex: (__VLS_ctx.rollLand),
        itemWidthPx: (__VLS_ctx.stripItemW),
        size: (__VLS_ctx.stripSize),
        durationMs: (__VLS_ctx.spinStripDurationMs),
        enableIdleAutoplay: (__VLS_ctx.stripIdleAutoplay),
        highlightLandWin: (__VLS_ctx.phase === 'result'),
        dailyAnticipationEasing: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ progress: {} },
        { onProgress: (__VLS_ctx.onStripProgress) });
    const __VLS_7 = ({ complete: {} },
        { onComplete: (__VLS_ctx.onRollComplete) });
    /** @type {__VLS_StyleScopedClasses['daily-slot__strip']} */ ;
    var __VLS_3;
    var __VLS_4;
    if (__VLS_ctx.showWinPill) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: ([
                    'coinhub-spin-win relative z-[40] flex flex-col items-center',
                    __VLS_ctx.isHero ? 'mt-5 coinhub-spin-win--hero' : 'mt-3',
                ]) },
            role: "status",
            'aria-label': (__VLS_ctx.wonLineAria),
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-win']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[40]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: ([
                    'coinhub-reward-float group relative flex flex-col items-center gap-1.5 px-2',
                    __VLS_ctx.rewardPop && 'coinhub-reward-float--reveal',
                ]) },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-reward-float']} */ ;
        /** @type {__VLS_StyleScopedClasses['group']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: ([
                    'coinhub-spin-win__eyebrow text-center font-extrabold uppercase text-amber-200/90',
                    __VLS_ctx.isHero ? 'text-[0.75rem] tracking-[0.32em] sm:text-[0.8rem]' : 'text-[0.7rem] tracking-[0.28em]',
                ]) },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__eyebrow']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-extrabold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-200/90']} */ ;
        (__VLS_ctx.t('coinHub.spinWinBadge'));
        if (__VLS_ctx.isHero) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: ([
                        'coinhub-reward-amount coinhub-spin-win__amount coinhub-spin-win__amount--hero-gold flex flex-col items-center tabular-nums',
                        `coinhub-spin-win__amount--intensity-${__VLS_ctx.rewardRarity}`,
                    ]) },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-reward-amount']} */ ;
            /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__amount']} */ ;
            /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__amount--hero-gold']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "coinhub-spin-win__hero-amount flex items-baseline justify-center gap-0.5" },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-amount']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-baseline']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
            if (__VLS_ctx.finalPayout > 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "coinhub-spin-win__hero-plus select-none" },
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-plus']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "coinhub-reward-number coinhub-spin-win__hero-number" },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
            /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-number']} */ ;
            (__VLS_ctx.displayAmount);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "coinhub-spin-win__hero-suffix font-semibold text-amber-200/95" },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__hero-suffix']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-200/95']} */ ;
            (__VLS_ctx.t('coinHub.coinUnit'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: ([
                        'coinhub-reward-amount coinhub-spin-win__amount flex items-baseline justify-center gap-1.5 tabular-nums',
                        `coinhub-spin-win__amount--rarity-${__VLS_ctx.rewardRarity}`,
                    ]) },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-reward-amount']} */ ;
            /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__amount']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-baseline']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "coinhub-reward-number text-3xl font-black text-amber-50 sm:text-4xl" },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-50']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:text-4xl']} */ ;
            (__VLS_ctx.displayAmount);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "coinhub-reward-suffix text-sm font-semibold text-amber-200/90 sm:text-base" },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-reward-suffix']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-200/90']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:text-base']} */ ;
            (__VLS_ctx.t('coinHub.coinUnit'));
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "relative mt-6 min-h-[3.5rem] w-full md:mt-7" },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[3.5rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:mt-7']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onSpinCta) },
        type: "button",
        disabled: (!__VLS_ctx.spinAvailable || __VLS_ctx.coinHub.spinInFlight || __VLS_ctx.phase === 'resolving' || __VLS_ctx.phase === 'rolling' || __VLS_ctx.impactHold),
        ...{ class: ([
                'daily-spin__cta coinhub-spin-cta coinhub-spin-cta--arcade relative h-14 w-full cursor-pointer rounded-[14px] text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg',
                __VLS_ctx.coinHub.spinInFlight && 'coinhub-cta--busy',
                __VLS_ctx.spinAvailable && 'ch-ds-btn-purple coinhub-spin-cta--primary',
                !__VLS_ctx.spinAvailable && 'bg-violet-950/80 text-slate-500',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['daily-spin__cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-cta--arcade']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-14']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[14px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-offset-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-violet-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-lg']} */ ;
    if (__VLS_ctx.phase === 'resolving' || __VLS_ctx.coinHub.spinInFlight || __VLS_ctx.phase === 'rolling' || __VLS_ctx.impactHold) {
        (__VLS_ctx.t('coinHub.spinningShort'));
    }
    else if (__VLS_ctx.phase === 'result') {
        (__VLS_ctx.t('coinHub.spinAgain'));
    }
    else {
        (__VLS_ctx.actionLabel);
    }
    if (__VLS_ctx.coinHub.spinInFlight) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pointer-events-none absolute inset-0 flex items-center justify-center" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "coinhub-spin-btn-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white/90" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-btn-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/25']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-t-white/90']} */ ;
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: ([
                'coinhub-spin flex w-full min-w-0 flex-col',
                'coinhub-daily coinhub-daily--spin-article rounded-xl border border-violet-500/25 border-l-4 border-l-violet-500 bg-gradient-to-b from-slate-900/80 to-slate-950/95 p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]',
                __VLS_ctx.isFocalTarget ? 'coinhub-daily--focal' : 'coinhub-daily--interactive',
                __VLS_ctx.spinAvailable && 'coinhub-daily--spin-ready',
                !__VLS_ctx.spinAvailable && 'coinhub-daily--spin-locked',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-spin']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-daily']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-daily--spin-article']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-violet-500/25']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-l-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-l-violet-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-gradient-to-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['from-slate-900/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['to-slate-950/95']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]']} */ ;
    if (!__VLS_ctx.omitHeroHeading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "ch-ds-text-label text-[0.65rem] font-semibold uppercase tracking-wider" },
        });
        /** @type {__VLS_StyleScopedClasses['ch-ds-text-label']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[0.65rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
        (__VLS_ctx.tagLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "mt-3 text-lg font-semibold leading-snug text-[#FFFFFF]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-snug']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[#FFFFFF]']} */ ;
        (__VLS_ctx.title);
    }
    if (__VLS_ctx.sectionDescription) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 text-sm text-violet-200/80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-violet-200/80']} */ ;
        (__VLS_ctx.sectionDescription);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (['flex flex-col gap-0.5', __VLS_ctx.omitHeroHeading ? 'mt-0' : 'mt-2']) },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.showAvailabilityPulse) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "coinhub-daily-pulse-dot coinhub-daily-pulse-dot--violet" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-daily-pulse-dot']} */ ;
        /** @type {__VLS_StyleScopedClasses['coinhub-daily-pulse-dot--violet']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: (['text-sm', __VLS_ctx.isFocalTarget ? 'text-violet-200/90' : 'text-violet-400/85']) },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.stateLabelAvailable);
    if (__VLS_ctx.spinCooldownHint) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "coinhub-spin-cd-timer text-xs font-semibold tabular-nums" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-cd-timer']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        (__VLS_ctx.spinCooldownHint);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-spin-machine mt-5 w-full" },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-machine']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-spin-stage relative w-full" },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-stage']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    if (__VLS_ctx.winBurst || __VLS_ctx.phase === 'result') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coinhub-win-vignette pointer-events-none absolute inset-[-6%] z-[25] rounded-[1.25rem]" },
            ...{ class: (__VLS_ctx.winBurst && 'coinhub-win-vignette--hot') },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-vignette']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-[-6%]']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[25]']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[1.25rem]']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-slot-bezel relative z-[2] rounded-xl p-1.5 transition-[transform] duration-[220ms] ease-out will-change-transform',
                __VLS_ctx.spinAvailable && 'coinhub-slot-bezel--live',
                __VLS_ctx.cameraIn && 'coinhub-slot-cam--in',
                __VLS_ctx.camSnap && 'coinhub-slot-cam--snap',
            ]) },
        role: "status",
        'aria-live': (__VLS_ctx.phase === 'rolling' || __VLS_ctx.impactHold ? 'polite' : 'off'),
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-bezel']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[2]']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-[transform]']} */ ;
    /** @type {__VLS_StyleScopedClasses['duration-[220ms]']} */ ;
    /** @type {__VLS_StyleScopedClasses['ease-out']} */ ;
    /** @type {__VLS_StyleScopedClasses['will-change-transform']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-slot-window coinhub-slot-window--fg relative z-[3] overflow-hidden rounded-lg',
                __VLS_ctx.impactHold && 'coinhub-spin-surface--impact',
                (__VLS_ctx.phase === 'result' || __VLS_ctx.winBurst) && 'coinhub-spin-surface--won',
                __VLS_ctx.winBurst && 'coinhub-spin-surface--win-burst',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-window']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-window--fg']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[3]']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: ([
                'coinhub-slot-heart relative h-full w-full will-change-transform',
                __VLS_ctx.stripMeta.heartbeat && 'coinhub-slot-heart--on',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-slot-heart']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['will-change-transform']} */ ;
    if (__VLS_ctx.winBurst) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coinhub-win-burst pointer-events-none absolute inset-0 z-[20]" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-burst']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[20]']} */ ;
    }
    if (__VLS_ctx.winBurst) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coinhub-win-flash pointer-events-none absolute inset-0 z-[21] mix-blend-screen" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-flash']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[21]']} */ ;
        /** @type {__VLS_StyleScopedClasses['mix-blend-screen']} */ ;
    }
    if (__VLS_ctx.winBurst) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "coinhub-win-particles pointer-events-none absolute inset-0 z-[19]" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-win-particles']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[19]']} */ ;
        for (const [n] of __VLS_vFor((9))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                key: (n),
                ...{ class: "coinhub-win-particle" },
                ...{ style: ({ '--ch-pa': `${n * 40}deg`, '--ch-pd': `${0.38 + (n % 4) * 0.1}` }) },
            });
            /** @type {__VLS_StyleScopedClasses['coinhub-win-particle']} */ ;
            // @ts-ignore
            [isHero, isHero, isHero, isFocalTarget, isFocalTarget, spinAvailable, spinAvailable, spinAvailable, spinAvailable, spinAvailable, spinAvailable, tagLabel, title, sectionDescription, sectionDescription, showAvailabilityPulse, stateLabelAvailable, spinCooldownHint, spinCooldownHint, t, t, t, t, t, phase, phase, phase, phase, phase, phase, phase, phase, phase, impactHold, impactHold, impactHold, impactHold, rewardRarity, rewardRarity, winBurst, winBurst, winBurst, winBurst, winBurst, winBurst, winBurst, cameraIn, camSnap, stripMeta, rollCells, rollLand, stripItemW, stripSize, spinStripDurationMs, stripIdleAutoplay, onStripProgress, onRollComplete, showWinPill, wonLineAria, rewardPop, finalPayout, displayAmount, displayAmount, onSpinCta, coinHub, coinHub, coinHub, coinHub, actionLabel, omitHeroHeading, omitHeroHeading,];
        }
    }
    const __VLS_8 = CoinHubStripRoll;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        ...{ 'onProgress': {} },
        ...{ 'onComplete': {} },
        cells: (__VLS_ctx.rollCells),
        landIndex: (__VLS_ctx.rollLand),
        itemWidthPx: (__VLS_ctx.stripItemW),
        size: (__VLS_ctx.stripSize),
        durationMs: (__VLS_ctx.spinStripDurationMs),
        highlightLandWin: (__VLS_ctx.phase === 'result'),
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onProgress': {} },
        ...{ 'onComplete': {} },
        cells: (__VLS_ctx.rollCells),
        landIndex: (__VLS_ctx.rollLand),
        itemWidthPx: (__VLS_ctx.stripItemW),
        size: (__VLS_ctx.stripSize),
        durationMs: (__VLS_ctx.spinStripDurationMs),
        highlightLandWin: (__VLS_ctx.phase === 'result'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_13;
    const __VLS_14 = ({ progress: {} },
        { onProgress: (__VLS_ctx.onStripProgress) });
    const __VLS_15 = ({ complete: {} },
        { onComplete: (__VLS_ctx.onRollComplete) });
    var __VLS_11;
    var __VLS_12;
    if (__VLS_ctx.showWinPill) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "coinhub-spin-win relative z-[40] mt-3 flex flex-col items-center" },
            role: "status",
            'aria-label': (__VLS_ctx.wonLineAria),
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-win']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[40]']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: ([
                    'coinhub-reward-float group relative flex flex-col items-center gap-1.5 px-1',
                    __VLS_ctx.rewardPop && 'coinhub-reward-float--reveal',
                ]) },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-reward-float']} */ ;
        /** @type {__VLS_StyleScopedClasses['group']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "coinhub-spin-win__eyebrow text-center text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-amber-200/90" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__eyebrow']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[0.7rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-extrabold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.28em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-200/90']} */ ;
        (__VLS_ctx.t('coinHub.spinWinBadge'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: ([
                    'coinhub-reward-amount coinhub-spin-win__amount flex items-baseline justify-center gap-1.5 tabular-nums',
                    `coinhub-spin-win__amount--rarity-${__VLS_ctx.rewardRarity}`,
                ]) },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-reward-amount']} */ ;
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-win__amount']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-baseline']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "coinhub-reward-number text-xl font-black text-amber-50 sm:text-2xl" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-reward-number']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-50']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:text-2xl']} */ ;
        (__VLS_ctx.displayAmount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "coinhub-reward-suffix text-sm font-semibold text-amber-200/90 sm:text-base" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-reward-suffix']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-200/90']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:text-base']} */ ;
        (__VLS_ctx.t('coinHub.coinUnit'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "relative mt-5 min-h-[2.75rem] w-full" },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[2.75rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onSpinCta) },
        type: "button",
        disabled: (!__VLS_ctx.spinAvailable || __VLS_ctx.coinHub.spinInFlight || __VLS_ctx.phase === 'resolving' || __VLS_ctx.phase === 'rolling' || __VLS_ctx.impactHold),
        ...{ class: ([
                'coinhub-spin-cta coinhub-spin-cta--arcade relative w-full cursor-pointer rounded-xl py-3.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50',
                __VLS_ctx.coinHub.spinInFlight && 'coinhub-cta--busy',
                __VLS_ctx.spinAvailable && 'ch-ds-btn-purple coinhub-spin-cta--primary',
                !__VLS_ctx.spinAvailable && 'bg-violet-950/80 text-slate-500',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-spin-cta--arcade']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-offset-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['focus-visible:outline-violet-300']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    if (__VLS_ctx.phase === 'resolving' || __VLS_ctx.coinHub.spinInFlight || __VLS_ctx.phase === 'rolling' || __VLS_ctx.impactHold) {
        (__VLS_ctx.t('coinHub.spinningShort'));
    }
    else if (__VLS_ctx.phase === 'result') {
        (__VLS_ctx.t('coinHub.spinAgain'));
    }
    else {
        (__VLS_ctx.actionLabel);
    }
    if (__VLS_ctx.coinHub.spinInFlight) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pointer-events-none absolute inset-0 flex items-center justify-center" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "coinhub-spin-btn-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white/90" },
        });
        /** @type {__VLS_StyleScopedClasses['coinhub-spin-btn-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/25']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-t-white/90']} */ ;
    }
}
let __VLS_16;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    to: "body",
}));
const __VLS_18 = __VLS_17({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const { default: __VLS_21 } = __VLS_19.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "spin-win-fly-layer" },
    'aria-hidden': "true",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.isHero && __VLS_ctx.spinFlyActive && __VLS_ctx.spinFlyCoins.length > 0) }, null, null);
/** @type {__VLS_StyleScopedClasses['spin-win-fly-layer']} */ ;
for (const [f] of __VLS_vFor((__VLS_ctx.spinFlyCoins))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (f.id),
        ...{ class: "spin-win-fly-coin" },
        ...{ style: ({
                left: f.x + 'px',
                top: f.y + 'px',
                animationDuration: f.duration,
                animationDelay: f.delay,
                '--ftx': f.tx + 'px',
                '--fty': f.ty + 'px',
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['spin-win-fly-coin']} */ ;
    // @ts-ignore
    [isHero, spinAvailable, spinAvailable, spinAvailable, t, t, t, t, phase, phase, phase, phase, phase, phase, impactHold, impactHold, rewardRarity, rollCells, rollLand, stripItemW, stripSize, spinStripDurationMs, onStripProgress, onRollComplete, showWinPill, wonLineAria, rewardPop, displayAmount, onSpinCta, coinHub, coinHub, coinHub, coinHub, actionLabel, spinFlyActive, spinFlyCoins, spinFlyCoins,];
}
// @ts-ignore
[];
var __VLS_19;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
