/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import StreamerBrandLink from '@/eat-first/ui/atoms/StreamerBrandLink.vue';
import ThemeToggleButton from '@/eat-first/ui/atoms/ThemeToggleButton.vue';
import UiMenuSelect from '@/eat-first/ui/molecules/UiMenuSelect.vue';
import AppButton from '@/components/ui/AppButton.vue';
import { useTheme } from '@/eat-first';
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n';
import { STREAMER_NICK } from '@/eat-first/constants/brand.js';
import { normalizeDisplayName } from 'call-core/utils';
import { useAuth } from '@/composables/useAuth';
import { useStreamAuthModal } from '@/composables/useStreamAuthModal';
const props = withDefaults(defineProps(), { showOnboardingGuide: false });
const __VLS_emit = defineEmits();
const { t, locale } = useI18n();
const route = useRoute();
const { theme, toggleTheme } = useTheme();
const { user, isAuthenticated, logout } = useAuth();
const { openStreamAuthModal } = useStreamAuthModal();
const postLoginPath = computed(() => route.fullPath || '/');
const themeIcon = computed(() => (theme.value === 'dark' ? '☀️' : '🌙'));
const themeLabel = computed(() => theme.value === 'dark' ? t('app.themeLight') : t('app.themeDark'));
const localeMenuOptions = LOCALE_OPTIONS.map((o) => ({ value: o.code, label: o.label }));
const twitchChannelAria = computed(() => t('app.twitchAria', { nick: STREAMER_NICK }));
function userAvatarInitial(displayName) {
    const s = normalizeDisplayName(displayName);
    if (!s) {
        return '?';
    }
    const ch = [...s][0];
    return ch ? ch.toUpperCase() : '?';
}
const __VLS_defaults = { showOnboardingGuide: false };
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
/** @type {__VLS_StyleScopedClasses['auth-signup']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-header__end" },
});
/** @type {__VLS_StyleScopedClasses['app-shell-header__end']} */ ;
if (props.showOnboardingGuide) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(props.showOnboardingGuide))
                    return;
                __VLS_ctx.$emit('open-onboarding');
                // @ts-ignore
                [$emit,];
            } },
        type: "button",
        ...{ class: "onb-guide" },
        title: (__VLS_ctx.t('onboarding.openGuide')),
        'aria-label': (__VLS_ctx.t('onboarding.openGuide')),
    });
    /** @type {__VLS_StyleScopedClasses['onb-guide']} */ ;
}
if (__VLS_ctx.isAuthenticated && __VLS_ctx.user) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-user" },
        role: "group",
        'aria-label': (__VLS_ctx.user.displayName),
        title: (__VLS_ctx.user.displayName),
    });
    /** @type {__VLS_StyleScopedClasses['auth-user']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-user__avatar" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['auth-user__avatar']} */ ;
    if (__VLS_ctx.user.avatar) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "auth-user__avatar-img" },
            src: (__VLS_ctx.user.avatar),
            width: "30",
            height: "30",
            alt: "",
            decoding: "async",
        });
        /** @type {__VLS_StyleScopedClasses['auth-user__avatar-img']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "auth-user__avatar-fallback" },
        });
        /** @type {__VLS_StyleScopedClasses['auth-user__avatar-fallback']} */ ;
        (__VLS_ctx.userAvatarInitial(__VLS_ctx.user.displayName));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "auth-user__name" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-user__name']} */ ;
    (__VLS_ctx.user.displayName);
}
if (__VLS_ctx.isAuthenticated && __VLS_ctx.user) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "auth-chip" },
    });
    /** @type {__VLS_StyleScopedClasses['auth-chip']} */ ;
    const __VLS_0 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClick': {} },
        variant: "ghost",
        ...{ class: "auth-chip__out" },
        type: "button",
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClick': {} },
        variant: "ghost",
        ...{ class: "auth-chip__out" },
        type: "button",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.isAuthenticated && __VLS_ctx.user))
                    return;
                __VLS_ctx.logout();
                // @ts-ignore
                [t, t, isAuthenticated, isAuthenticated, user, user, user, user, user, user, user, user, userAvatarInitial, logout,];
            } });
    /** @type {__VLS_StyleScopedClasses['auth-chip__out']} */ ;
    const { default: __VLS_7 } = __VLS_3.slots;
    (__VLS_ctx.t('app.authLogout'));
    // @ts-ignore
    [t,];
    var __VLS_3;
    var __VLS_4;
}
else {
    const __VLS_8 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        ...{ 'onClick': {} },
        variant: "secondary",
        type: "button",
        ...{ class: "auth-signup" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClick': {} },
        variant: "secondary",
        type: "button",
        ...{ class: "auth-signup" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_13;
    const __VLS_14 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isAuthenticated && __VLS_ctx.user))
                    return;
                __VLS_ctx.openStreamAuthModal(__VLS_ctx.postLoginPath);
                // @ts-ignore
                [openStreamAuthModal, postLoginPath,];
            } });
    /** @type {__VLS_StyleScopedClasses['auth-signup']} */ ;
    const { default: __VLS_15 } = __VLS_11.slots;
    (__VLS_ctx.t('app.authSignUp'));
    // @ts-ignore
    [t,];
    var __VLS_11;
    var __VLS_12;
}
const __VLS_16 = UiMenuSelect;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.locale),
    options: (__VLS_ctx.localeMenuOptions),
    ariaLabel: (__VLS_ctx.t('app.langAria')),
    variant: "header",
}));
const __VLS_18 = __VLS_17({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.locale),
    options: (__VLS_ctx.localeMenuOptions),
    ariaLabel: (__VLS_ctx.t('app.langAria')),
    variant: "header",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_21;
const __VLS_22 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (__VLS_ctx.persistLocale) });
var __VLS_19;
var __VLS_20;
const __VLS_23 = ThemeToggleButton;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.themeLabel),
    icon: (__VLS_ctx.themeIcon),
}));
const __VLS_25 = __VLS_24({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.themeLabel),
    icon: (__VLS_ctx.themeIcon),
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
let __VLS_28;
const __VLS_29 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleTheme) });
var __VLS_26;
var __VLS_27;
const __VLS_30 = StreamerBrandLink;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ariaLabel: (__VLS_ctx.twitchChannelAria),
    showNick: (false),
    logoSize: (30),
}));
const __VLS_32 = __VLS_31({
    ariaLabel: (__VLS_ctx.twitchChannelAria),
    showNick: (false),
    logoSize: (30),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
// @ts-ignore
[t, locale, localeMenuOptions, persistLocale, themeLabel, themeIcon, toggleTheme, twitchChannelAria,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
