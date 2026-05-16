/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
import setupClipboardSrc from '@/assets/nadraw-show/setup-clipboard.svg';
import setupClockSrc from '@/assets/nadraw-show/setup-clock.svg';
import setupRoundSrc from '@/assets/nadraw-show/setup-round.svg';
const wordSource = defineModel('wordSource', { required: true });
const roundDurationSec = defineModel('roundDurationSec', { required: true });
const roundCount = defineModel('roundCount', { required: true });
const __VLS_props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const durationChoices = [30, 60, 90, 120, 240, 360];
const roundCountChoices = [5, 10, 20, 30, 50, 100];
let __VLS_modelEmit;
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
/** @type {__VLS_StyleScopedClasses['nadraw-setup']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "nadraw-setup sa-glass-panel" },
    'aria-label': (__VLS_ctx.t('nadrawShow.roundSetupTitle')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-setup__block nadraw-setup__block--mode" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block--mode']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "nadraw-setup__title" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-setup__track nadraw-setup__track--mode sa-glass-panel" },
    role: "group",
    'aria-label': (__VLS_ctx.t('nadrawShow.wordSource')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--mode']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nadraw-setup__icon nadraw-setup__icon--clipboard" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon--clipboard']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    src: (__VLS_ctx.setupClipboardSrc),
    alt: "",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.wordSource = 'global';
            // @ts-ignore
            [t, t, setupClipboardSrc, wordSource,];
        } },
    type: "button",
    ...{ class: "nadraw-setup__mode sa-glass-button" },
    ...{ class: ({ 'nadraw-setup__choice--on': __VLS_ctx.wordSource !== 'manual' }) },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__choice--on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.wordSource = 'manual';
            // @ts-ignore
            [wordSource, wordSource,];
        } },
    type: "button",
    ...{ class: "nadraw-setup__mode sa-glass-button" },
    ...{ class: ({ 'nadraw-setup__choice--on': __VLS_ctx.wordSource === 'manual' }) },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__mode']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__choice--on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-setup__block nadraw-setup__block--timer" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block--timer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "nadraw-setup__title" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-setup__track nadraw-setup__track--chips sa-glass-panel" },
    role: "group",
    'aria-label': (__VLS_ctx.t('nadrawShow.roundDurationLabel')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nadraw-setup__icon nadraw-setup__icon--clock" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon--clock']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    src: (__VLS_ctx.setupClockSrc),
    alt: "",
    'aria-hidden': "true",
});
for (const [sec] of __VLS_vFor((__VLS_ctx.durationChoices))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.roundDurationSec = sec;
                // @ts-ignore
                [t, wordSource, setupClockSrc, durationChoices, roundDurationSec,];
            } },
        key: (sec),
        type: "button",
        ...{ class: "nadraw-setup__chip sa-glass-button" },
        ...{ class: ({ 'nadraw-setup__choice--on': __VLS_ctx.roundDurationSec === sec }) },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-setup__choice--on']} */ ;
    (sec);
    // @ts-ignore
    [roundDurationSec,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-setup__block nadraw-setup__block--round" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__block--round']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "nadraw-setup__title" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-setup__track nadraw-setup__track--chips sa-glass-panel" },
    role: "group",
    'aria-label': (__VLS_ctx.t('nadrawShow.roundCountLabel')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__track--chips']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "nadraw-setup__icon nadraw-setup__icon--round" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-setup__icon--round']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    src: (__VLS_ctx.setupRoundSrc),
    alt: "",
    'aria-hidden': "true",
});
for (const [n] of __VLS_vFor((__VLS_ctx.roundCountChoices))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.roundCount = n;
                // @ts-ignore
                [t, setupRoundSrc, roundCountChoices, roundCount,];
            } },
        key: (n),
        type: "button",
        ...{ class: "nadraw-setup__chip sa-glass-button" },
        ...{ class: ({ 'nadraw-setup__choice--on': __VLS_ctx.roundCount === n }) },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-setup__chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-setup__choice--on']} */ ;
    (n);
    // @ts-ignore
    [roundCount,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('start');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "nadraw-setup__start sa-glass-button" },
    disabled: (__VLS_ctx.startDisabled),
});
/** @type {__VLS_StyleScopedClasses['nadraw-setup__start']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
// @ts-ignore
[startDisabled,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
