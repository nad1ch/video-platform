/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const props = withDefaults(defineProps(), {
    feedbackHref: '#',
    locale: '',
    localeOptions: () => [],
    mode: 'both',
    tone: 'glass',
    popoverLocaleStick: false,
});
const emit = defineEmits();
const { t } = useI18n();
const showFeedback = computed(() => props.mode === 'both' || props.mode === 'feedback');
const showLocale = computed(() => props.mode === 'both' || props.mode === 'locale');
const activeLocaleLabel = computed(() => props.localeOptions.find((option) => option.value === props.locale)?.label ?? props.localeOptions[0]?.label ?? t('app.localeEnglish'));
const localeDetailsRef = ref(null);
function closeLocaleMenu() {
    localeDetailsRef.value?.removeAttribute('open');
}
function onDocumentPointerDown(event) {
    const details = localeDetailsRef.value;
    const target = event.target;
    if (!details?.open || !(target instanceof Node) || details.contains(target)) {
        return;
    }
    closeLocaleMenu();
}
function onDocumentKeydown(event) {
    if (event.key === 'Escape') {
        closeLocaleMenu();
    }
}
function selectLocale(value, event) {
    emit('update:locale', value);
    const details = event.currentTarget?.closest('details');
    details?.removeAttribute('open');
}
onMounted(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeydown);
});
onUnmounted(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    document.removeEventListener('keydown', onDocumentKeydown);
});
const __VLS_defaults = {
    feedbackHref: '#',
    locale: '',
    localeOptions: () => [],
    mode: 'both',
    tone: 'glass',
    popoverLocaleStick: false,
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
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__feedback']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-list']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option--active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option--active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__feedback']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--light']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--light']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--light']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--light']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__feedback']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--popover-locale-stick']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--popover-locale-stick']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-list']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--both']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__feedback']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--both']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__feedback']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-landing-footer-actions" },
    ...{ class: ([
            `app-landing-footer-actions--${__VLS_ctx.tone}`,
            `app-landing-footer-actions--${__VLS_ctx.mode}`,
            { 'app-landing-footer-actions--popover-locale-stick': __VLS_ctx.popoverLocaleStick },
        ]) },
});
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['app-landing-footer-actions--popover-locale-stick']} */ ;
if (__VLS_ctx.showFeedback) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ class: "app-landing-footer-actions__feedback sa-glass-button" },
        href: (__VLS_ctx.feedbackHref),
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__feedback']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
    (__VLS_ctx.t('app.feedback'));
}
if (__VLS_ctx.showLocale) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ref: "localeDetailsRef",
        ...{ class: "app-landing-footer-actions__locale" },
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "app-landing-footer-actions__locale-trigger sa-glass-button" },
        'aria-label': (__VLS_ctx.t('app.chooseLanguage')),
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-trigger']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.activeLocaleLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-landing-footer-actions__locale-list" },
    });
    /** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-list']} */ ;
    for (const [option] of __VLS_vFor((__VLS_ctx.localeOptions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showLocale))
                        return;
                    __VLS_ctx.selectLocale(option.value, $event);
                    // @ts-ignore
                    [tone, mode, popoverLocaleStick, showFeedback, feedbackHref, t, t, showLocale, activeLocaleLabel, localeOptions, selectLocale,];
                } },
            key: (option.value),
            ...{ class: "app-landing-footer-actions__locale-option" },
            ...{ class: ({ 'app-landing-footer-actions__locale-option--active': option.value === __VLS_ctx.locale }) },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option']} */ ;
        /** @type {__VLS_StyleScopedClasses['app-landing-footer-actions__locale-option--active']} */ ;
        (option.label);
        // @ts-ignore
        [locale,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
