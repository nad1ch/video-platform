/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { STREAMER_NICK } from '../../constants/brand.js';
import StreamerBrandLink from '../atoms/StreamerBrandLink.vue';
import ThemeToggleButton from '../atoms/ThemeToggleButton.vue';
import UiMenuSelect from '../molecules/UiMenuSelect.vue';
const __VLS_props = defineProps({
    localeMenuOptions: { type: Array, required: true },
    modelLocale: { type: String, required: true },
    themeIcon: { type: String, required: true },
    themeLabel: { type: String, required: true },
    showOnboardingGuide: { type: Boolean, default: false },
});
const __VLS_emit = defineEmits(['update:locale', 'toggle-theme', 'open-onboarding']);
const { t } = useI18n();
const twitchChannelAria = computed(() => t('app.twitchAria', { nick: STREAMER_NICK }));
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
/** @type {__VLS_StyleScopedClasses['onb-guide']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-header__end" },
});
/** @type {__VLS_StyleScopedClasses['app-shell-header__end']} */ ;
if (__VLS_ctx.showOnboardingGuide) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showOnboardingGuide))
                    return;
                __VLS_ctx.$emit('open-onboarding');
                // @ts-ignore
                [showOnboardingGuide, $emit,];
            } },
        type: "button",
        ...{ class: "onb-guide" },
        title: (__VLS_ctx.t('onboarding.openGuide')),
        'aria-label': (__VLS_ctx.t('onboarding.openGuide')),
    });
    /** @type {__VLS_StyleScopedClasses['onb-guide']} */ ;
}
const __VLS_0 = UiMenuSelect;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.modelLocale),
    options: (__VLS_ctx.localeMenuOptions),
    'aria-label': (__VLS_ctx.t('app.langAria')),
    variant: "header",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.modelLocale),
    options: (__VLS_ctx.localeMenuOptions),
    'aria-label': (__VLS_ctx.t('app.langAria')),
    variant: "header",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.$emit('update:locale', $event);
            // @ts-ignore
            [$emit, t, t, t, modelLocale, localeMenuOptions,];
        } });
var __VLS_3;
var __VLS_4;
const __VLS_7 = ThemeToggleButton;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.themeLabel),
    icon: (__VLS_ctx.themeIcon),
}));
const __VLS_9 = __VLS_8({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.themeLabel),
    icon: (__VLS_ctx.themeIcon),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-theme');
            // @ts-ignore
            [$emit, themeLabel, themeIcon,];
        } });
var __VLS_10;
var __VLS_11;
const __VLS_14 = StreamerBrandLink;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    ariaLabel: (__VLS_ctx.twitchChannelAria),
    showNick: (false),
    logoSize: (30),
}));
const __VLS_16 = __VLS_15({
    ariaLabel: (__VLS_ctx.twitchChannelAria),
    showNick: (false),
    logoSize: (30),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
// @ts-ignore
[twitchChannelAria,];
const __VLS_export = (await import('vue')).defineComponent({
    emits: {},
    props: {
        localeMenuOptions: { type: Array, required: true },
        modelLocale: { type: String, required: true },
        themeIcon: { type: String, required: true },
        themeLabel: { type: String, required: true },
        showOnboardingGuide: { type: Boolean, default: false },
    },
});
export default {};
