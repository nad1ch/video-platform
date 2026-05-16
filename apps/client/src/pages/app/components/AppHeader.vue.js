/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import coinIcon from '@/assets/landing/coin-streamassist.png';
const props = withDefaults(defineProps(), {
    title: '',
    authLoading: false,
    isAuthenticated: false,
    userName: '',
    userAvatar: '',
    profileTo: undefined,
    accountTo: undefined,
    showHelpButton: false,
    helpLabel: '',
    compact: false,
    mafiaMode: false,
    roomCenterMode: false,
    showCoin: true,
    showAuth: true,
    mafiaObsMinimalChrome: false,
    isProActive: false,
    proLinkTo: undefined,
    proLabel: '',
});
const emit = defineEmits();
const hasUserAvatar = computed(() => props.userAvatar.trim().length > 0);
const { t } = useI18n();
const userInitial = computed(() => {
    const s = props.userName.trim();
    return (s[0] ?? 'S').toUpperCase();
});
const displayName = computed(() => props.userName.trim());
const displayTitle = computed(() => props.title.trim() || props.brandName);
const userAvatarSrc = computed(() => avatarSizedUrl(props.userAvatar, 96));
const resolvedHelpLabel = computed(() => props.helpLabel.trim() || t('onboarding.openGuide'));
const profileMenuLabel = computed(() => displayName.value ? t('app.openProfileMenuFor', { name: displayName.value }) : t('app.openProfileMenu'));
const profileActionLabel = computed(() => profileMenuLabel.value);
const headerWrapper = ref(null);
const headerInner = ref(null);
const profileMenuRoot = ref(null);
const profileMenuOpen = ref(false);
const profileMenuId = 'app-landing-profile-menu';
let headerResizeObserver;
let headerResizeFrame = 0;
function syncHeaderHeight() {
    if (!headerWrapper.value || !headerInner.value) {
        return;
    }
    headerWrapper.value.style.height = `${headerInner.value.offsetHeight}px`;
}
function scheduleHeaderHeightSync() {
    if (typeof window === 'undefined') {
        syncHeaderHeight();
        return;
    }
    if (headerResizeFrame) {
        window.cancelAnimationFrame(headerResizeFrame);
    }
    headerResizeFrame = window.requestAnimationFrame(() => {
        headerResizeFrame = 0;
        syncHeaderHeight();
    });
}
onMounted(() => {
    void nextTick(() => {
        syncHeaderHeight();
        if (typeof ResizeObserver === 'undefined' || !headerInner.value) {
            return;
        }
        headerResizeObserver = new ResizeObserver(scheduleHeaderHeightSync);
        headerResizeObserver.observe(headerInner.value);
    });
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown, true);
});
onUnmounted(() => {
    headerResizeObserver?.disconnect();
    if (headerResizeFrame && typeof window !== 'undefined') {
        window.cancelAnimationFrame(headerResizeFrame);
    }
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown, true);
});
watch(() => props.isAuthenticated, (authenticated) => {
    if (!authenticated) {
        closeProfileMenu();
    }
});
function closeProfileMenu() {
    profileMenuOpen.value = false;
}
function toggleProfileMenu() {
    profileMenuOpen.value = !profileMenuOpen.value;
}
function onDocumentClick(event) {
    if (!profileMenuOpen.value) {
        return;
    }
    const target = event.target;
    if (target instanceof Node && profileMenuRoot.value?.contains(target)) {
        return;
    }
    closeProfileMenu();
}
function onDocumentKeydown(event) {
    if (event.key === 'Escape') {
        closeProfileMenu();
    }
}
function onProfileLogout() {
    closeProfileMenu();
    emit('logout');
}
function avatarSizedUrl(rawUrl, size) {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.includes('googleusercontent.com')) {
        if (/=s\d+(?:-[a-z]+)?$/i.test(trimmed)) {
            return trimmed.replace(/=s\d+(?:-[a-z]+)?$/i, `=s${size}-c`);
        }
        return `${trimmed}${trimmed.includes('?') ? '&' : '?'}sz=${size}`;
    }
    if (trimmed.includes('static-cdn.jtvnw.net')) {
        return trimmed.replace(/-\d+x\d+(\.[a-z0-9]+(?:\?.*)?)$/i, `-${size}x${size}$1`);
    }
    return trimmed;
}
const __VLS_defaults = {
    title: '',
    authLoading: false,
    isAuthenticated: false,
    userName: '',
    userAvatar: '',
    profileTo: undefined,
    accountTo: undefined,
    showHelpButton: false,
    helpLabel: '',
    compact: false,
    mafiaMode: false,
    roomCenterMode: false,
    showCoin: true,
    showAuth: true,
    mafiaObsMinimalChrome: false,
    isProActive: false,
    proLinkTo: undefined,
    proLabel: '',
};
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
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia-obs']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia-obs']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia-obs']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__logo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header-title-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__help']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__help']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__coin']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__help']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__coin']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__logo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__coin']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__coin-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user-name']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--room-center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__logo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand-extra']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__help']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__coin']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__coin-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth-link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user-name']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__auth--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ref: "headerWrapper",
    ...{ class: "app-landing-header" },
    ...{ class: ({
            'app-landing-header--compact': __VLS_ctx.compact,
            'app-landing-header--mafia': __VLS_ctx.mafiaMode,
            'app-landing-header--room-center': __VLS_ctx.roomCenterMode,
            'app-landing-header--mafia-obs': __VLS_ctx.mafiaObsMinimalChrome,
        }) },
    'aria-label': (__VLS_ctx.t('app.headerAria')),
});
/** @type {__VLS_StyleScopedClasses['app-landing-header']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--room-center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-header--mafia-obs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "headerInner",
    ...{ class: "app-landing-header__inner" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-landing-header__bar" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__bar']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "app-landing-header__brand" },
    to: ({ name: 'home' }),
    'aria-label': (__VLS_ctx.brandName),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "app-landing-header__brand" },
    to: ({ name: 'home' }),
    'aria-label': (__VLS_ctx.brandName),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['app-landing-header__brand']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "app-landing-header__logo" },
    src: (__VLS_ctx.logoSrc),
    alt: "",
    width: "42",
    height: "42",
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__logo']} */ ;
// @ts-ignore
[compact, mafiaMode, roomCenterMode, mafiaObsMinimalChrome, t, brandName, logoSrc,];
var __VLS_3;
if (__VLS_ctx.$slots['brand-extra']) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-landing-header__brand-extra" },
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__brand-extra']} */ ;
    var __VLS_6 = {};
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-landing-header__center" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__center']} */ ;
let __VLS_8;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
    ...{ class: "app-landing-header__title" },
    to: ({ name: 'home' }),
}));
const __VLS_10 = __VLS_9({
    ...{ class: "app-landing-header__title" },
    to: ({ name: 'home' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
/** @type {__VLS_StyleScopedClasses['app-landing-header__title']} */ ;
const { default: __VLS_13 } = __VLS_11.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "app-landing-header__title-frame" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__title-frame']} */ ;
let __VLS_14;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    name: "app-landing-header-title",
    mode: "out-in",
}));
const __VLS_16 = __VLS_15({
    name: "app-landing-header-title",
    mode: "out-in",
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
const { default: __VLS_19 } = __VLS_17.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    key: (__VLS_ctx.displayTitle),
    ...{ class: "app-landing-header__title-text" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__title-text']} */ ;
(__VLS_ctx.displayTitle);
// @ts-ignore
[$slots, displayTitle, displayTitle,];
var __VLS_17;
// @ts-ignore
[];
var __VLS_11;
if (__VLS_ctx.$slots.center) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-landing-header__center-extra" },
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__center-extra']} */ ;
    var __VLS_20 = {};
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-landing-header__actions" },
});
/** @type {__VLS_StyleScopedClasses['app-landing-header__actions']} */ ;
var __VLS_22 = {};
if (__VLS_ctx.showHelpButton) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showHelpButton))
                    return;
                __VLS_ctx.$emit('openHelp');
                // @ts-ignore
                [$slots, showHelpButton, $emit,];
            } },
        type: "button",
        ...{ class: "app-landing-header__help" },
        title: (__VLS_ctx.resolvedHelpLabel),
        'aria-label': (__VLS_ctx.resolvedHelpLabel),
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__help']} */ ;
}
if (__VLS_ctx.isProActive && __VLS_ctx.proLinkTo) {
    let __VLS_24;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
        to: (__VLS_ctx.proLinkTo),
        ...{ class: "app-landing-header__pro" },
        title: (__VLS_ctx.proLabel || 'StreamAssist Pro'),
        'aria-label': (__VLS_ctx.proLabel || 'StreamAssist Pro'),
    }));
    const __VLS_26 = __VLS_25({
        to: (__VLS_ctx.proLinkTo),
        ...{ class: "app-landing-header__pro" },
        title: (__VLS_ctx.proLabel || 'StreamAssist Pro'),
        'aria-label': (__VLS_ctx.proLabel || 'StreamAssist Pro'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    /** @type {__VLS_StyleScopedClasses['app-landing-header__pro']} */ ;
    const { default: __VLS_29 } = __VLS_27.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-landing-header__pro-crown" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__pro-crown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-landing-header__pro-label" },
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__pro-label']} */ ;
    // @ts-ignore
    [resolvedHelpLabel, resolvedHelpLabel, isProActive, proLinkTo, proLinkTo, proLabel, proLabel,];
    var __VLS_27;
}
if (__VLS_ctx.showCoin) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCoin))
                    return;
                __VLS_ctx.$emit('coinClick');
                // @ts-ignore
                [$emit, showCoin,];
            } },
        type: "button",
        ...{ class: "app-landing-header__coin" },
        'aria-label': (__VLS_ctx.t('app.openCoinHub')),
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__coin']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-landing-header__coin-label" },
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__coin-label']} */ ;
    (__VLS_ctx.coinBalanceLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "app-landing-header__coin-icon" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__coin-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "app-landing-header__coin-img" },
        src: (__VLS_ctx.coinIcon),
        alt: "",
        width: "44",
        height: "44",
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__coin-img']} */ ;
}
if (__VLS_ctx.showAuth) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-landing-header__auth sa-glass-button" },
        ...{ class: ({ 'app-landing-header__auth--profile': __VLS_ctx.isAuthenticated }) },
        'aria-busy': (__VLS_ctx.authLoading),
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-header__auth']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['app-landing-header__auth--profile']} */ ;
    if (__VLS_ctx.authLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "app-landing-header__auth-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__auth-loading']} */ ;
        (__VLS_ctx.t('app.loading'));
    }
    else if (__VLS_ctx.isAuthenticated) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "profileMenuRoot",
            ...{ class: "app-landing-header__profile" },
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__profile']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.toggleProfileMenu) },
            type: "button",
            ...{ class: "app-landing-header__user" },
            'aria-controls': (__VLS_ctx.profileMenuId),
            'aria-expanded': (__VLS_ctx.profileMenuOpen),
            'aria-haspopup': "menu",
            'aria-label': (__VLS_ctx.profileActionLabel),
            title: (__VLS_ctx.displayName || undefined),
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__user']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "app-landing-header__avatar" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__avatar']} */ ;
        if (__VLS_ctx.hasUserAvatar) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                ...{ class: "app-landing-header__avatar-img" },
                src: (__VLS_ctx.userAvatarSrc),
                alt: "",
                width: "28",
                height: "28",
                loading: "lazy",
                decoding: "async",
                fetchpriority: "low",
            });
            /** @type {__VLS_StyleScopedClasses['app-landing-header__avatar-img']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.userInitial);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "app-landing-header__user-name" },
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__user-name']} */ ;
        (__VLS_ctx.displayName || __VLS_ctx.userInitial);
        if (__VLS_ctx.profileMenuOpen) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                id: (__VLS_ctx.profileMenuId),
                ...{ class: "app-landing-header__profile-menu" },
                role: "menu",
            });
            /** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu']} */ ;
            if (__VLS_ctx.accountTo) {
                let __VLS_30;
                /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
                RouterLink;
                // @ts-ignore
                const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
                    ...{ 'onClick': {} },
                    ...{ class: "app-landing-header__profile-menu-item" },
                    to: (__VLS_ctx.accountTo),
                    role: "menuitem",
                }));
                const __VLS_32 = __VLS_31({
                    ...{ 'onClick': {} },
                    ...{ class: "app-landing-header__profile-menu-item" },
                    to: (__VLS_ctx.accountTo),
                    role: "menuitem",
                }, ...__VLS_functionalComponentArgsRest(__VLS_31));
                let __VLS_35;
                const __VLS_36 = ({ click: {} },
                    { onClick: (__VLS_ctx.closeProfileMenu) });
                /** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu-item']} */ ;
                const { default: __VLS_37 } = __VLS_33.slots;
                (__VLS_ctx.t('app.openAccount'));
                // @ts-ignore
                [t, t, t, coinBalanceLabel, coinIcon, showAuth, isAuthenticated, isAuthenticated, authLoading, authLoading, toggleProfileMenu, profileMenuId, profileMenuId, profileMenuOpen, profileMenuOpen, profileActionLabel, displayName, displayName, hasUserAvatar, userAvatarSrc, userInitial, userInitial, accountTo, accountTo, closeProfileMenu,];
                var __VLS_33;
                var __VLS_34;
            }
            if (__VLS_ctx.profileTo) {
                let __VLS_38;
                /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
                RouterLink;
                // @ts-ignore
                const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
                    ...{ 'onClick': {} },
                    ...{ class: "app-landing-header__profile-menu-item" },
                    to: (__VLS_ctx.profileTo),
                    role: "menuitem",
                }));
                const __VLS_40 = __VLS_39({
                    ...{ 'onClick': {} },
                    ...{ class: "app-landing-header__profile-menu-item" },
                    to: (__VLS_ctx.profileTo),
                    role: "menuitem",
                }, ...__VLS_functionalComponentArgsRest(__VLS_39));
                let __VLS_43;
                const __VLS_44 = ({ click: {} },
                    { onClick: (__VLS_ctx.closeProfileMenu) });
                /** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu-item']} */ ;
                const { default: __VLS_45 } = __VLS_41.slots;
                (__VLS_ctx.t('app.openAdminPanel'));
                // @ts-ignore
                [t, closeProfileMenu, profileTo, profileTo,];
                var __VLS_41;
                var __VLS_42;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.onProfileLogout) },
                type: "button",
                ...{ class: "app-landing-header__profile-menu-item" },
                role: "menuitem",
            });
            /** @type {__VLS_StyleScopedClasses['app-landing-header__profile-menu-item']} */ ;
            (__VLS_ctx.t('app.authLogout'));
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "app-landing-header__auth-buttons" },
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__auth-buttons']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showAuth))
                        return;
                    if (!!(__VLS_ctx.authLoading))
                        return;
                    if (!!(__VLS_ctx.isAuthenticated))
                        return;
                    __VLS_ctx.$emit('login');
                    // @ts-ignore
                    [t, $emit, onProfileLogout,];
                } },
            type: "button",
            ...{ class: "app-landing-header__auth-link" },
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-header__auth-link']} */ ;
        (__VLS_ctx.t('app.logIn'));
    }
}
// @ts-ignore
var __VLS_7 = __VLS_6, __VLS_21 = __VLS_20, __VLS_23 = __VLS_22;
// @ts-ignore
[t,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
