/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps({
    open: { type: Boolean, default: false },
    tourKey: { type: String, default: '' },
});
const emit = defineEmits(['update:open', 'complete', 'dismiss-save']);
const { t, tm } = useI18n();
const ONBOARDING_EXPAND = 'eat-first-onboarding-expand';
const PAD = 10;
const CARD_W = 360;
const GAP = 14;
const stepIndex = ref(0);
const saveDismiss = ref(true);
const hole = ref({
    active: false,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
});
const cardStyle = ref({
    top: '50%',
    left: '50%',
    width: 'min(22.5rem, calc(100vw - 2rem))',
    transform: 'translate(-50%, -50%)',
});
const arrowClass = ref('');
const tourTitle = computed(() => {
    const k = props.tourKey;
    if (!k)
        return '';
    return t(`onboarding.tours.${k}.title`);
});
const steps = computed(() => {
    const k = props.tourKey;
    if (!k)
        return [];
    const raw = tm(`onboarding.tours.${k}.steps`);
    if (!Array.isArray(raw))
        return [];
    return raw.map((item, i) => {
        if (item && typeof item === 'object') {
            return {
                title: String(item.title ?? ''),
                text: String(item.text ?? ''),
                target: item.target != null && String(item.target).trim() ? String(item.target).trim() : '',
                expandHost: item.expandHost != null && String(item.expandHost).trim()
                    ? String(item.expandHost).trim()
                    : '',
                key: `${k}-${i}`,
            };
        }
        return { title: '', text: '', target: '', expandHost: '', key: `${k}-${i}` };
    });
});
const total = computed(() => steps.value.length);
const currentStep = computed(() => steps.value[stepIndex.value] ?? null);
const isLast = computed(() => total.value > 0 && stepIndex.value >= total.value - 1);
let raf = 0;
let scrollDoneTimer = null;
function scrollPref() {
    if (typeof matchMedia === 'undefined')
        return 'smooth';
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}
function queryTargetEl(sel) {
    if (!sel || typeof document === 'undefined')
        return null;
    return document.querySelector(`[data-onb="${CSS.escape(sel)}"]`);
}
function layoutCardNearHole() {
    const h = hole.value;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    const w = Math.min(CARD_W, vw - 32);
    if (!h.active) {
        arrowClass.value = '';
        cardStyle.value = {
            top: '50%',
            left: '50%',
            width: `${w}px`,
            maxWidth: 'min(22.5rem, calc(100vw - 2rem))',
            transform: 'translate(-50%, -50%)',
        };
        return;
    }
    const hb = h.top + h.height;
    const estCardH = 280;
    let top = hb + GAP;
    let place = 'below';
    if (top + estCardH > vh - 12) {
        top = h.top - GAP - estCardH;
        place = 'above';
    }
    if (top < 12)
        top = 12;
    let left = h.left + h.width / 2 - w / 2;
    left = Math.min(Math.max(14, left), vw - w - 14);
    arrowClass.value = place === 'below' ? 'coach-card--arrow-up' : 'coach-card--arrow-down';
    cardStyle.value = {
        top: `${top}px`,
        left: `${left}px`,
        width: `${w}px`,
        maxWidth: 'min(22.5rem, calc(100vw - 2rem))',
        transform: 'none',
    };
}
function measureAndPlace() {
    if (typeof window === 'undefined')
        return;
    const step = currentStep.value;
    if (!props.open || !step)
        return;
    if (!step.target) {
        hole.value = { active: false, top: 0, left: 0, width: 0, height: 0 };
        layoutCardNearHole();
        return;
    }
    const el = queryTargetEl(step.target);
    if (!el) {
        hole.value = { active: false, top: 0, left: 0, width: 0, height: 0 };
        layoutCardNearHole();
        return;
    }
    try {
        el.scrollIntoView({ block: 'center', behavior: scrollPref() });
    }
    catch {
        el.scrollIntoView();
    }
    const applyRect = () => {
        const r = el.getBoundingClientRect();
        hole.value = {
            active: true,
            top: r.top - PAD,
            left: r.left - PAD,
            width: r.width + PAD * 2,
            height: r.height + PAD * 2,
        };
        layoutCardNearHole();
    };
    if (scrollDoneTimer)
        clearTimeout(scrollDoneTimer);
    scrollDoneTimer = setTimeout(applyRect, scrollPref() === 'smooth' ? 380 : 0);
    requestAnimationFrame(applyRect);
}
function scheduleMeasure() {
    if (raf)
        cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
        raf = 0;
        measureAndPlace();
    });
}
function dispatchExpandHost() {
    if (typeof window === 'undefined' || !props.open)
        return;
    const ex = currentStep.value?.expandHost;
    if (!ex)
        return;
    window.dispatchEvent(new CustomEvent(ONBOARDING_EXPAND, {
        detail: { hostBlock: ex },
    }));
}
watch(() => props.open, (v) => {
    if (v) {
        stepIndex.value = 0;
        saveDismiss.value = true;
        nextTick(() => {
            dispatchExpandHost();
            scheduleMeasure();
        });
    }
    else {
        hole.value = { active: false, top: 0, left: 0, width: 0, height: 0 };
    }
});
watch(() => props.tourKey, () => {
    stepIndex.value = 0;
    nextTick(scheduleMeasure);
});
watch([stepIndex, () => props.tourKey, () => props.open], () => {
    if (!props.open)
        return;
    nextTick(() => {
        dispatchExpandHost();
        scheduleMeasure();
    });
});
function onWinResizeScroll() {
    if (props.open)
        scheduleMeasure();
}
onMounted(() => {
    window.addEventListener('resize', onWinResizeScroll);
    window.addEventListener('scroll', onWinResizeScroll, true);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onWinResizeScroll);
    window.removeEventListener('scroll', onWinResizeScroll, true);
    if (scrollDoneTimer)
        clearTimeout(scrollDoneTimer);
    if (raf)
        cancelAnimationFrame(raf);
});
function close() {
    emit('complete', { saveDismiss: saveDismiss.value });
    if (saveDismiss.value)
        emit('dismiss-save');
    emit('update:open', false);
}
function finish() {
    close();
}
function next() {
    if (isLast.value) {
        finish();
        return;
    }
    stepIndex.value = Math.min(stepIndex.value + 1, Math.max(0, total.value - 1));
}
function back() {
    stepIndex.value = Math.max(0, stepIndex.value - 1);
}
const scrimTop = computed(() => {
    const h = hole.value;
    if (!h.active)
        return { display: 'none' };
    return { top: 0, left: 0, right: 0, height: `${Math.max(0, h.top)}px` };
});
const scrimLeft = computed(() => {
    const h = hole.value;
    if (!h.active)
        return { display: 'none' };
    return { top: `${h.top}px`, left: 0, width: `${Math.max(0, h.left)}px`, height: `${h.height}px` };
});
const scrimRight = computed(() => {
    const h = hole.value;
    if (!h.active)
        return { display: 'none' };
    return {
        top: `${h.top}px`,
        left: `${h.left + h.width}px`,
        right: 0,
        height: `${h.height}px`,
    };
});
const scrimBottom = computed(() => {
    const h = hole.value;
    if (!h.active)
        return { display: 'none' };
    return {
        top: `${h.top + h.height}px`,
        left: 0,
        right: 0,
        bottom: 0,
    };
});
const ringStyle = computed(() => {
    const h = hole.value;
    if (!h.active)
        return { display: 'none' };
    return {
        top: `${h.top}px`,
        left: `${h.left}px`,
        width: `${h.width}px`,
        height: `${h.height}px`,
    };
});
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
/** @type {__VLS_StyleScopedClasses['coach-card__x']} */ ;
/** @type {__VLS_StyleScopedClasses['coach-card__remember']} */ ;
/** @type {__VLS_StyleScopedClasses['coach-card__btn']} */ ;
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
if (__VLS_ctx.open && __VLS_ctx.tourKey && __VLS_ctx.total > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (__VLS_ctx.close) },
        ...{ class: "coach" },
        role: "presentation",
    });
    /** @type {__VLS_StyleScopedClasses['coach']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coach__scrim-coach" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coach__scrim-coach']} */ ;
    if (__VLS_ctx.hole.active) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coach__band" },
            ...{ style: (__VLS_ctx.scrimTop) },
        });
        /** @type {__VLS_StyleScopedClasses['coach__band']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coach__band" },
            ...{ style: (__VLS_ctx.scrimLeft) },
        });
        /** @type {__VLS_StyleScopedClasses['coach__band']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coach__band" },
            ...{ style: (__VLS_ctx.scrimRight) },
        });
        /** @type {__VLS_StyleScopedClasses['coach__band']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coach__band" },
            ...{ style: (__VLS_ctx.scrimBottom) },
        });
        /** @type {__VLS_StyleScopedClasses['coach__band']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "coach__scrim-full" },
        });
        /** @type {__VLS_StyleScopedClasses['coach__scrim-full']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "coach__ring" },
        ...{ style: (__VLS_ctx.ringStyle) },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coach__ring']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "coach-card" },
        ...{ class: (__VLS_ctx.arrowClass) },
        role: "dialog",
        'aria-modal': "true",
        'aria-label': (__VLS_ctx.tourTitle),
        ...{ style: (__VLS_ctx.cardStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coach-card__chrome" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__chrome']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "coach-card__brand" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__brand']} */ ;
    (__VLS_ctx.tourTitle);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.close) },
        type: "button",
        ...{ class: "coach-card__x" },
        'aria-label': (__VLS_ctx.t('onboarding.close')),
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__x']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "coach-card__progress" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__progress']} */ ;
    (__VLS_ctx.t('onboarding.progress', { n: __VLS_ctx.stepIndex + 1, total: __VLS_ctx.total }));
    if (__VLS_ctx.currentStep) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "coach-card__body" },
        });
        /** @type {__VLS_StyleScopedClasses['coach-card__body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "coach-card__step-title" },
        });
        /** @type {__VLS_StyleScopedClasses['coach-card__step-title']} */ ;
        (__VLS_ctx.currentStep.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "coach-card__step-text" },
        });
        /** @type {__VLS_StyleScopedClasses['coach-card__step-text']} */ ;
        (__VLS_ctx.currentStep.text);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coach-card__dots" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__dots']} */ ;
    for (const [_, i] of __VLS_vFor((__VLS_ctx.total))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            key: (i),
            ...{ class: "coach-card__dot" },
            ...{ class: ({ 'coach-card__dot--on': i === __VLS_ctx.stepIndex }) },
        });
        /** @type {__VLS_StyleScopedClasses['coach-card__dot']} */ ;
        /** @type {__VLS_StyleScopedClasses['coach-card__dot--on']} */ ;
        // @ts-ignore
        [open, tourKey, total, total, total, close, close, hole, scrimTop, scrimLeft, scrimRight, scrimBottom, ringStyle, arrowClass, tourTitle, tourTitle, cardStyle, t, t, stepIndex, stepIndex, currentStep, currentStep, currentStep,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "coach-card__remember" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__remember']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (__VLS_ctx.saveDismiss);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('onboarding.dontShowAgain'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coach-card__actions" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.close) },
        type: "button",
        ...{ class: "coach-card__btn coach-card__btn--ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['coach-card__btn--ghost']} */ ;
    (__VLS_ctx.t('onboarding.close'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coach-card__nav" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__nav']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.back) },
        type: "button",
        ...{ class: "coach-card__btn coach-card__btn--ghost" },
        disabled: (__VLS_ctx.stepIndex <= 0),
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['coach-card__btn--ghost']} */ ;
    (__VLS_ctx.t('onboarding.back'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.next) },
        type: "button",
        ...{ class: "coach-card__btn coach-card__btn--primary" },
    });
    /** @type {__VLS_StyleScopedClasses['coach-card__btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['coach-card__btn--primary']} */ ;
    (__VLS_ctx.isLast ? __VLS_ctx.t('onboarding.done') : __VLS_ctx.t('onboarding.next'));
}
// @ts-ignore
[close, t, t, t, t, t, stepIndex, saveDismiss, back, next, isLast,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    props: {
        open: { type: Boolean, default: false },
        tourKey: { type: String, default: '' },
    },
});
export default {};
