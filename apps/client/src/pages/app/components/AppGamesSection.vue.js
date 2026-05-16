/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import EconomyComingSoonModal from '@/pages/app/components/EconomyComingSoonModal.vue';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const hasItems = computed(() => props.items.length > 0);
const selectedComingSoonItemId = ref(null);
const allComingSoonItems = computed(() => [...props.items, ...(props.modalItems ?? [])]);
const activeComingSoonItem = computed(() => {
    const item = allComingSoonItems.value.find((candidate) => candidate.id === selectedComingSoonItemId.value);
    return item?.comingSoon ? item : null;
});
watch(() => [props.comingSoonItemId, allComingSoonItems.value], ([itemId]) => {
    if (!itemId)
        return;
    const item = allComingSoonItems.value.find((candidate) => candidate.id === itemId);
    if (item?.comingSoon) {
        selectedComingSoonItemId.value = item.id;
    }
}, { immediate: true });
function toneClass(tone) {
    return `app-game-card--${tone ?? 'violet'}`;
}
function cardClasses(item) {
    return [toneClass(item.tone), `app-game-card--${item.id}`];
}
function prefetchItem(item) {
    item.prefetch?.();
}
function modalId(item, suffix) {
    return `app-game-card-${item.id}-${suffix}`;
}
function openComingSoon(item) {
    selectedComingSoonItemId.value = item.id;
}
function closeComingSoon() {
    selectedComingSoonItemId.value = null;
    emit('comingSoonClose');
}
const economySlotLetters = Object.freeze(['T', 'W', 'I', 'T', 'C', 'H']);
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
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__description']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__description']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog--durak']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__picture']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog--durak']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__image']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon-modal-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__picture']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-slot']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card--checkers']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "app-games" },
    'aria-labelledby': "app-games-title",
});
/** @type {__VLS_StyleScopedClasses['app-games']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-games__panel" },
});
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: "app-games-title",
    ...{ class: "app-games__title" },
});
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
(__VLS_ctx.t('home.sectionGames'));
if (__VLS_ctx.lead) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-games__lead" },
    });
    /** @type {__VLS_StyleScopedClasses['app-games__lead']} */ ;
    (__VLS_ctx.lead);
}
if (__VLS_ctx.hasItems) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-games__grid" },
    });
    /** @type {__VLS_StyleScopedClasses['app-games__grid']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.items))) {
        __VLS_asFunctionalElement(__VLS_intrinsics.template)({
            key: (item.id),
        });
        if (item.comingSoon) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.hasItems))
                            return;
                        if (!(item.comingSoon))
                            return;
                        __VLS_ctx.openComingSoon(item);
                        // @ts-ignore
                        [t, lead, lead, hasItems, items, openComingSoon,];
                    } },
                type: "button",
                ...{ class: "app-game-card" },
                ...{ class: (__VLS_ctx.cardClasses(item)) },
                'aria-label': (item.ariaLabel),
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-game-card__copy" },
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__copy']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-game-card__title" },
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
            (item.title);
            if (item.subtitle) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "app-game-card__subtitle" },
                });
                /** @type {__VLS_StyleScopedClasses['app-game-card__subtitle']} */ ;
                (item.subtitle);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-game-card__visual" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.picture, __VLS_intrinsics.picture)({
                ...{ class: "app-game-card__picture" },
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__picture']} */ ;
            if (item.imageWebp) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.source)({
                    srcset: (item.imageWebp),
                    type: "image/webp",
                });
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                ...{ class: "app-game-card__image" },
                src: (item.image),
                alt: "",
                loading: "lazy",
                decoding: "async",
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__image']} */ ;
        }
        else if (item.to) {
            let __VLS_0;
            /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
            RouterLink;
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
                ...{ 'onMouseenter': {} },
                ...{ 'onFocus': {} },
                ...{ class: "app-game-card" },
                ...{ class: (__VLS_ctx.cardClasses(item)) },
                to: (item.to),
                'aria-label': (item.ariaLabel),
            }));
            const __VLS_2 = __VLS_1({
                ...{ 'onMouseenter': {} },
                ...{ 'onFocus': {} },
                ...{ class: "app-game-card" },
                ...{ class: (__VLS_ctx.cardClasses(item)) },
                to: (item.to),
                'aria-label': (item.ariaLabel),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1));
            let __VLS_5;
            const __VLS_6 = ({ mouseenter: {} },
                { onMouseenter: (...[$event]) => {
                        if (!(__VLS_ctx.hasItems))
                            return;
                        if (!!(item.comingSoon))
                            return;
                        if (!(item.to))
                            return;
                        __VLS_ctx.prefetchItem(item);
                        // @ts-ignore
                        [cardClasses, cardClasses, prefetchItem,];
                    } });
            const __VLS_7 = ({ focus: {} },
                { onFocus: (...[$event]) => {
                        if (!(__VLS_ctx.hasItems))
                            return;
                        if (!!(item.comingSoon))
                            return;
                        if (!(item.to))
                            return;
                        __VLS_ctx.prefetchItem(item);
                        // @ts-ignore
                        [prefetchItem,];
                    } });
            /** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
            const { default: __VLS_8 } = __VLS_3.slots;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-game-card__copy" },
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__copy']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-game-card__title" },
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
            (item.title);
            if (item.subtitle) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "app-game-card__subtitle" },
                });
                /** @type {__VLS_StyleScopedClasses['app-game-card__subtitle']} */ ;
                (item.subtitle);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-game-card__visual" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.picture, __VLS_intrinsics.picture)({
                ...{ class: "app-game-card__picture" },
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__picture']} */ ;
            if (item.imageWebp) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.source)({
                    srcset: (item.imageWebp),
                    type: "image/webp",
                });
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                ...{ class: "app-game-card__image" },
                src: (item.image),
                alt: "",
                loading: "lazy",
                decoding: "async",
            });
            /** @type {__VLS_StyleScopedClasses['app-game-card__image']} */ ;
            // @ts-ignore
            [];
            var __VLS_3;
            var __VLS_4;
        }
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-games__empty" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['app-games__empty']} */ ;
    (__VLS_ctx.t('home.emptyGames'));
}
let __VLS_9;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
    to: "body",
}));
const __VLS_11 = __VLS_10({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
const { default: __VLS_14 } = __VLS_12.slots;
if (__VLS_ctx.activeComingSoonItem?.comingSoon.variant === 'economy') {
    const __VLS_15 = EconomyComingSoonModal;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
        ...{ 'onClose': {} },
        open: (true),
        eyebrow: (__VLS_ctx.activeComingSoonItem.comingSoon.eyebrow),
        title: (__VLS_ctx.activeComingSoonItem.comingSoon.title ?? __VLS_ctx.activeComingSoonItem.title),
        description: (__VLS_ctx.activeComingSoonItem.comingSoon.description),
        closeLabel: (__VLS_ctx.t('home.comingSoonClose')),
    }));
    const __VLS_17 = __VLS_16({
        ...{ 'onClose': {} },
        open: (true),
        eyebrow: (__VLS_ctx.activeComingSoonItem.comingSoon.eyebrow),
        title: (__VLS_ctx.activeComingSoonItem.comingSoon.title ?? __VLS_ctx.activeComingSoonItem.title),
        description: (__VLS_ctx.activeComingSoonItem.comingSoon.description),
        closeLabel: (__VLS_ctx.t('home.comingSoonClose')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    let __VLS_20;
    const __VLS_21 = ({ close: {} },
        { onClose: (__VLS_ctx.closeComingSoon) });
    var __VLS_18;
    var __VLS_19;
}
else {
    let __VLS_22;
    /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
    Transition;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
        name: "app-coming-soon-modal",
    }));
    const __VLS_24 = __VLS_23({
        name: "app-coming-soon-modal",
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    const { default: __VLS_27 } = __VLS_25.slots;
    if (__VLS_ctx.activeComingSoonItem) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onKeydown: (__VLS_ctx.closeComingSoon) },
            ...{ class: "app-coming-soon" },
            role: "presentation",
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeComingSoon) },
            type: "button",
            ...{ class: "app-coming-soon__backdrop" },
            'aria-label': (__VLS_ctx.t('home.comingSoonClose')),
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__backdrop']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "app-coming-soon__dialog" },
            ...{ class: ([
                    `app-coming-soon__dialog--${__VLS_ctx.activeComingSoonItem.comingSoon.variant ?? 'game'}`,
                    `app-coming-soon__dialog--${__VLS_ctx.activeComingSoonItem.id}`,
                ]) },
            role: "dialog",
            'aria-modal': "true",
            'aria-labelledby': (__VLS_ctx.modalId(__VLS_ctx.activeComingSoonItem, 'title')),
            'aria-describedby': (__VLS_ctx.modalId(__VLS_ctx.activeComingSoonItem, 'desc')),
            tabindex: "-1",
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__dialog']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeComingSoon) },
            type: "button",
            ...{ class: "app-coming-soon__close" },
            'aria-label': (__VLS_ctx.t('home.comingSoonClose')),
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__close']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "app-coming-soon__copy" },
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__copy']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "app-coming-soon__eyebrow" },
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__eyebrow']} */ ;
        (__VLS_ctx.activeComingSoonItem.comingSoon.eyebrow);
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            id: (__VLS_ctx.modalId(__VLS_ctx.activeComingSoonItem, 'title')),
            ...{ class: "app-coming-soon__title" },
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__title']} */ ;
        (__VLS_ctx.activeComingSoonItem.comingSoon.title ?? __VLS_ctx.activeComingSoonItem.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            id: (__VLS_ctx.modalId(__VLS_ctx.activeComingSoonItem, 'desc')),
            ...{ class: "app-coming-soon__description" },
        });
        /** @type {__VLS_StyleScopedClasses['app-coming-soon__description']} */ ;
        (__VLS_ctx.activeComingSoonItem.comingSoon.description);
        if (__VLS_ctx.activeComingSoonItem.modalVisual !== 'economy-slot') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.picture, __VLS_intrinsics.picture)({
                ...{ class: "app-coming-soon__picture" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__picture']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                ...{ class: "app-coming-soon__image" },
                src: (__VLS_ctx.activeComingSoonItem.image),
                alt: "",
                decoding: "async",
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__image']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-slot" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-slot']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-jackpot" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-jackpot']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-cells" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-cells']} */ ;
            for (const [letter] of __VLS_vFor((__VLS_ctx.economySlotLetters))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (letter),
                    ...{ class: "app-coming-soon__economy-cell" },
                });
                /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-cell']} */ ;
                (letter);
                // @ts-ignore
                [t, t, t, t, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, activeComingSoonItem, closeComingSoon, closeComingSoon, closeComingSoon, closeComingSoon, modalId, modalId, modalId, modalId, economySlotLetters,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-underbar app-coming-soon__economy-underbar--left" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-underbar']} */ ;
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-underbar--left']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-underbar app-coming-soon__economy-underbar--right" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-underbar']} */ ;
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-underbar--right']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-slot-bar" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-slot-bar']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-handle" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-handle']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "app-coming-soon__economy-handle-stick" },
            });
            /** @type {__VLS_StyleScopedClasses['app-coming-soon__economy-handle-stick']} */ ;
        }
    }
    // @ts-ignore
    [];
    var __VLS_25;
}
// @ts-ignore
[];
var __VLS_12;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
