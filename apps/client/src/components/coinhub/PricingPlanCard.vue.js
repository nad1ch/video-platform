/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import '@/styles/coinhub-design-system.css';
const props = withDefaults(defineProps(), {
    fakePhase: 'idle',
    fakeTarget: null,
});
const emit = defineEmits();
const { t, tm } = useI18n();
const featureKey = computed(() => {
    if (props.plan === 'basic')
        return 'coinHub.premiumPlanBasicFeatures';
    if (props.plan === 'plus')
        return 'coinHub.premiumPlanPlusFeatures';
    return 'coinHub.premiumPlanProFeatures';
});
const features = computed(() => {
    const base = normalizeFeatures(tm(featureKey.value));
    if (props.plan === 'plus') {
        return [
            { text: t('coinHub.premiumPlanIncludesBasic'), kind: 'includes' },
            ...base,
        ];
    }
    if (props.plan === 'pro') {
        return [
            { text: t('coinHub.premiumPlanIncludesPlus'), kind: 'includes' },
            ...base,
        ];
    }
    return base;
});
const title = computed(() => {
    if (props.plan === 'basic')
        return t('coinHub.planBasic');
    if (props.plan === 'plus')
        return t('coinHub.planPlus');
    return t('coinHub.planPro');
});
const price = computed(() => {
    if (props.plan === 'basic')
        return t('coinHub.premiumPriceBasic');
    if (props.plan === 'plus')
        return t('coinHub.premiumPricePlus');
    return t('coinHub.premiumPricePro');
});
const chatLine = computed(() => {
    if (props.plan === 'basic')
        return t('coinHub.premiumCardChatLineBasic');
    if (props.plan === 'plus')
        return t('coinHub.premiumCardChatLinePlus');
    return t('coinHub.premiumCardChatLinePro');
});
const badgeLabel = computed(() => {
    if (props.plan === 'plus')
        return t('coinHub.premiumBadgePopular');
    if (props.plan === 'pro')
        return t('coinHub.premiumBadgeBest');
    return '';
});
const proCtaGlowClass = computed(() => 'ch-coinhub-gold-cta--glow-pro ch-coinhub-gold-cta--glow-pro-cta');
const isCurrentPlan = computed(() => props.plan === 'basic');
const isFakeThisCard = computed(() => props.fakeTarget === props.plan && (props.plan === 'plus' || props.plan === 'pro'));
const ctaLabel = computed(() => {
    if (props.plan === 'basic') {
        return t('coinHub.premiumCtaCurrentPlan');
    }
    if (isFakeThisCard.value && props.fakePhase === 'success') {
        return t('coinHub.premiumCtaActivated');
    }
    if (props.plan === 'plus') {
        return t('coinHub.premiumCtaUpgradePlus');
    }
    return t('coinHub.premiumCtaGoPro');
});
const isFakePurchaseBlocking = computed(() => props.fakePhase === 'purchasing' || props.fakePhase === 'success');
const isCtaDisabled = computed(() => props.plan !== 'basic' && isFakePurchaseBlocking.value);
const ctaFakeClass = computed(() => {
    if (!isFakeThisCard.value) {
        return null;
    }
    if (props.fakePhase === 'purchasing') {
        return 'ppc__cta--fake-purchasing';
    }
    if (props.fakePhase === 'success') {
        return 'ppc__cta--fake-success';
    }
    return null;
});
function normalizeFeatures(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((item) => {
        if (typeof item === 'string')
            return { text: item };
        if (item && typeof item === 'object' && 'text' in item) {
            return { text: String(item.text) };
        }
        return { text: String(item) };
    });
}
function onCta() {
    if (isCurrentPlan.value) {
        return;
    }
    if (props.plan !== 'basic' && isFakePurchaseBlocking.value) {
        return;
    }
    emit('buy', props.plan);
}
const __VLS_defaults = {
    fakePhase: 'idle',
    fakeTarget: null,
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
/** @type {__VLS_StyleScopedClasses['ppc']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__pro-ring']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__pro-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__pro-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__pro-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__pro-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__badge--best']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--plus--highlight']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--plus--highlight']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__title']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__title']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__title']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__price']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__price']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-lead--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-lead--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__feat-text']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--sized']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-current']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--fake-purchasing']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--fake-purchasing']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--fake-success']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--fake-success']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
/** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--fake-success']} */ ;
/** @type {__VLS_StyleScopedClasses['ppc__cta--fake-purchasing']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: ([
            'ppc',
            __VLS_ctx.plan === 'basic' && 'ppc--basic',
            __VLS_ctx.plan === 'plus' && 'ppc--plus ppc--plus--highlight',
            __VLS_ctx.plan === 'pro' && 'ppc--pro',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['ppc']} */ ;
if (__VLS_ctx.plan === 'plus' || __VLS_ctx.plan === 'pro') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__badge" },
        ...{ class: (__VLS_ctx.plan === 'pro' ? 'ppc__badge--best' : 'ppc__badge--pop') },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__badge']} */ ;
    (__VLS_ctx.badgeLabel);
}
if (__VLS_ctx.plan === 'pro') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__pro-ring" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__pro-ring']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__pro-surface" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__pro-surface']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__inner" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__inner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "ppc__title" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__title']} */ ;
    (__VLS_ctx.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "ppc__price" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__price']} */ ;
    (__VLS_ctx.price);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__chat" },
        ...{ class: ('ppc__chat--pro') },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['ppc__chat']} */ ;
    /** @type {__VLS_StyleScopedClasses['ppc__chat--pro']} */ ;
    (__VLS_ctx.chatLine);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "ppc__feats" },
        role: "list",
    });
    /** @type {__VLS_StyleScopedClasses['ppc__feats']} */ ;
    for (const [row, i] of __VLS_vFor((__VLS_ctx.features))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`f-${i}`),
            ...{ class: "ppc__feat" },
            ...{ class: (`ppc__feat--${__VLS_ctx.plan}`) },
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ppc__feat-lead ppc__feat-lead--pro" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat-lead']} */ ;
        /** @type {__VLS_StyleScopedClasses['ppc__feat-lead--pro']} */ ;
        if (row.kind === 'includes') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ppc__feat-check ppc__feat-check--pro" },
            });
            /** @type {__VLS_StyleScopedClasses['ppc__feat-check']} */ ;
            /** @type {__VLS_StyleScopedClasses['ppc__feat-check--pro']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ppc__feat-crown" },
            });
            /** @type {__VLS_StyleScopedClasses['ppc__feat-crown']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ppc__feat-body" },
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ppc__feat-text" },
            ...{ class: (row.kind === 'includes' && 'ppc__feat-text--includes') },
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat-text']} */ ;
        (row.text);
        // @ts-ignore
        [plan, plan, plan, plan, plan, plan, plan, plan, badgeLabel, title, price, chatLine, features,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onCta) },
        type: "button",
        ...{ class: "ch-coinhub-gold-cta ch-coinhub-gold-cta--label-light ppc__buy ppc__cta--sized" },
        ...{ class: ([__VLS_ctx.proCtaGlowClass, __VLS_ctx.ctaFakeClass]) },
        disabled: (__VLS_ctx.isCtaDisabled),
    });
    /** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta']} */ ;
    /** @type {__VLS_StyleScopedClasses['ch-coinhub-gold-cta--label-light']} */ ;
    /** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
    /** @type {__VLS_StyleScopedClasses['ppc__cta--sized']} */ ;
    (__VLS_ctx.ctaLabel);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__shell" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__shell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__inner" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__inner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "ppc__title" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__title']} */ ;
    (__VLS_ctx.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "ppc__price" },
    });
    /** @type {__VLS_StyleScopedClasses['ppc__price']} */ ;
    (__VLS_ctx.price);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ppc__chat" },
        ...{ class: (__VLS_ctx.plan === 'basic' ? 'ppc__chat--basic' : 'ppc__chat--plus') },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['ppc__chat']} */ ;
    (__VLS_ctx.chatLine);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "ppc__feats" },
        role: "list",
    });
    /** @type {__VLS_StyleScopedClasses['ppc__feats']} */ ;
    for (const [row, i] of __VLS_vFor((__VLS_ctx.features))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`f-${i}`),
            ...{ class: "ppc__feat" },
            ...{ class: (`ppc__feat--${__VLS_ctx.plan}`) },
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ppc__feat-lead" },
            ...{ class: (`ppc__feat-lead--${__VLS_ctx.plan}`) },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat-lead']} */ ;
        if (row.kind === 'includes') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ppc__feat-check ppc__feat-check--plus" },
            });
            /** @type {__VLS_StyleScopedClasses['ppc__feat-check']} */ ;
            /** @type {__VLS_StyleScopedClasses['ppc__feat-check--plus']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "ppc__feat-dot" },
            });
            /** @type {__VLS_StyleScopedClasses['ppc__feat-dot']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ppc__feat-body" },
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ppc__feat-text" },
            ...{ class: (row.kind === 'includes' && 'ppc__feat-text--includes') },
        });
        /** @type {__VLS_StyleScopedClasses['ppc__feat-text']} */ ;
        (row.text);
        // @ts-ignore
        [plan, plan, plan, title, price, chatLine, features, onCta, proCtaGlowClass, ctaFakeClass, isCtaDisabled, ctaLabel,];
    }
    if (!__VLS_ctx.isCurrentPlan) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.onCta) },
            type: "button",
            ...{ class: "ppc__buy ppc__cta-plus ppc__cta--sized" },
            ...{ class: ([__VLS_ctx.ctaFakeClass]) },
            disabled: (__VLS_ctx.isCtaDisabled),
        });
        /** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
        /** @type {__VLS_StyleScopedClasses['ppc__cta-plus']} */ ;
        /** @type {__VLS_StyleScopedClasses['ppc__cta--sized']} */ ;
        (__VLS_ctx.ctaLabel);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            type: "button",
            ...{ class: "ppc__buy ppc__cta-current ppc__cta--sized" },
            disabled: true,
        });
        /** @type {__VLS_StyleScopedClasses['ppc__buy']} */ ;
        /** @type {__VLS_StyleScopedClasses['ppc__cta-current']} */ ;
        /** @type {__VLS_StyleScopedClasses['ppc__cta--sized']} */ ;
        (__VLS_ctx.ctaLabel);
    }
}
// @ts-ignore
[onCta, ctaFakeClass, isCtaDisabled, ctaLabel, ctaLabel, isCurrentPlan,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
