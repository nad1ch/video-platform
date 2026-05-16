/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import economyComingEn from '@/assets/economy-coming-modal/economy-coming-en.png';
import economyComingUk from '@/assets/economy-coming-modal/economy-coming-uk.png';
const props = withDefaults(defineProps(), {
    eyebrow: 'coming soon...',
    title: 'Interaction Economy',
    description: '',
    closeLabel: 'Close',
});
const emit = defineEmits();
const { locale } = useI18n();
const modalImage = computed(() => String(locale.value).toLowerCase().startsWith('uk') ? economyComingUk : economyComingEn);
const descriptionText = computed(() => props.description
    .split('\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join(' '));
const closeModal = () => {
    emit('close');
};
const __VLS_defaults = {
    eyebrow: 'coming soon...',
    title: 'Interaction Economy',
    description: '',
    closeLabel: 'Close',
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
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-coming-modal__dialog']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "economy-coming-modal",
}));
const __VLS_2 = __VLS_1({
    name: "economy-coming-modal",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (props.open) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (__VLS_ctx.closeModal) },
        ...{ class: "economy-coming-modal" },
        role: "presentation",
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        type: "button",
        ...{ class: "economy-coming-modal__backdrop" },
        'aria-label': (__VLS_ctx.closeLabel),
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal__backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "economy-coming-modal__dialog" },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': "economy-coming-modal-title",
        'aria-describedby': "economy-coming-modal-desc",
        tabindex: "-1",
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal__dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        id: "economy-coming-modal-title",
        ...{ class: "economy-coming-modal__sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal__sr-only']} */ ;
    (__VLS_ctx.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        id: "economy-coming-modal-desc",
        ...{ class: "economy-coming-modal__sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal__sr-only']} */ ;
    (__VLS_ctx.eyebrow);
    (__VLS_ctx.descriptionText);
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "economy-coming-modal__image" },
        src: (__VLS_ctx.modalImage),
        alt: "",
        'aria-hidden': "true",
        draggable: "false",
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal__image']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        type: "button",
        ...{ class: "economy-coming-modal__close" },
        'aria-label': (__VLS_ctx.closeLabel),
    });
    /** @type {__VLS_StyleScopedClasses['economy-coming-modal__close']} */ ;
}
// @ts-ignore
[closeModal, closeModal, closeModal, closeLabel, closeLabel, title, eyebrow, descriptionText, modalImage,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
