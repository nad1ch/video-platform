/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { defineAsyncComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
// Premium-plans modal is 24 KB of source — it stays behind the "Upgrade"
// CTA and never renders on first paint, so load it lazily.
const PremiumPlansModal = defineAsyncComponent(() => import('@/components/coinhub/PremiumPlansModal.vue'));
import '@/styles/coinhub-design-system.css';
const __VLS_props = withDefaults(defineProps(), { inlineWithHero: false });
const { t } = useI18n();
const premiumModalOpen = ref(false);
const crownSrc = '/assets/coinhub/crown-premium.png';
function openPremiumModal() {
    premiumModalOpen.value = true;
}
const __VLS_defaults = { inlineWithHero: false };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['upgrade-card']} */ ;
/** @type {__VLS_StyleScopedClasses['upgrade-card__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['upgrade-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-upgrade__icon-shell']} */ ;
if (__VLS_ctx.inlineWithHero) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "upgrade-card min-w-0 md:min-h-0 md:h-full" },
        'aria-label': (__VLS_ctx.t('coinHub.sectionSubscription')),
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:min-h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:h-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "upgrade-card__noise" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__noise']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "upgrade-card__content" },
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__content']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "upgrade-card__row" },
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "upgrade-card__icon" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "upgrade-card__crown" },
        src: (__VLS_ctx.crownSrc),
        alt: "",
        width: "64",
        height: "64",
        loading: "lazy",
        decoding: "async",
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__crown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "upgrade-card__text" },
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "upgrade-card__title" },
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__title']} */ ;
    (__VLS_ctx.t('coinHub.upgradeTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "upgrade-card__desc" },
    });
    /** @type {__VLS_StyleScopedClasses['upgrade-card__desc']} */ ;
    (__VLS_ctx.t('coinHub.upgradeBody'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.openPremiumModal) },
        type: "button",
        ...{ class: "ch-coinhub-gold-cta ch-coinhub-gold-cta--label-light upgrade-card__cta" },
    });
    /** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta--label-light']} */ ;
    /** @type {__VLS_StyleScopedClasses['upgrade-card__cta']} */ ;
    (__VLS_ctx.t('coinHub.upgradeCta'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "coinhub-panel coinhub-panel--premium-upgrade coinhub-panel--tertiary ch-ds-card ch-ds-card--interactive min-w-0 overflow-hidden p-6 sm:p-8" },
        'aria-label': (__VLS_ctx.t('coinHub.sectionSubscription')),
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-panel--premium-upgrade']} */ ;
    /** @type {__VLS_StyleScopedClasses['coinhub-panel--tertiary']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-ds-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-ds-card--interactive']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:p-8']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-upgrade flex flex-col gap-5" },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-upgrade']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:gap-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "coinhub-upgrade__icon-shell flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-upgrade__icon-shell']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "h-16 w-16 object-contain" },
        src: (__VLS_ctx.crownSrc),
        alt: "",
        width: "64",
        height: "64",
        loading: "lazy",
        decoding: "async",
    });
    /** @type {__VLS_StyleScopedClasses['h-16']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-16']} */ ;
    /** @type {__VLS_StyleScopedClasses['object-contain']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0 flex-1" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "ch-ds-text-section text-[24px] sm:text-[28px]" },
    });
    /** @type {__VLS_StyleScopedClasses['ch-ds-text-section']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-[28px]']} */ ;
    (__VLS_ctx.t('coinHub.upgradeTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "ch-ds-text-muted mt-2 text-sm leading-relaxed" },
    });
    /** @type {__VLS_StyleScopedClasses['ch-ds-text-muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
    (__VLS_ctx.t('coinHub.upgradeBody'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.openPremiumModal) },
        type: "button",
        ...{ class: "ch-coinhub-gold-cta w-full max-w-md" },
    });
    /** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
    (__VLS_ctx.t('coinHub.upgradeCta'));
}
if (__VLS_ctx.premiumModalOpen) {
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.PremiumPlansModal} */
    PremiumPlansModal;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        open: (__VLS_ctx.premiumModalOpen),
    }));
    const __VLS_2 = __VLS_1({
        open: (__VLS_ctx.premiumModalOpen),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
// @ts-ignore
[inlineWithHero, t, t, t, t, t, t, t, t, crownSrc, crownSrc, openPremiumModal, openPremiumModal, premiumModalOpen, premiumModalOpen,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
