/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import eatFirstEn from '@/assets/beta-access-modals/eat-first-en.png';
import eatFirstUk from '@/assets/beta-access-modals/eat-first-uk.png';
import mafiaEn from '@/assets/beta-access-modals/mafia-en.png';
import mafiaUk from '@/assets/beta-access-modals/mafia-uk.png';
import videoCallEn from '@/assets/beta-access-modals/video-call-en.png';
import videoCallUk from '@/assets/beta-access-modals/video-call-uk.png';
const props = defineProps();
const emit = defineEmits();
const { locale } = useI18n();
const closeButtonRef = ref(null);
const modalImages = {
    'video-call': {
        en: videoCallEn,
        uk: videoCallUk,
    },
    mafia: {
        en: mafiaEn,
        uk: mafiaUk,
    },
    'eat-first': {
        en: eatFirstEn,
        uk: eatFirstUk,
    },
};
const modalCopy = {
    'video-call': {
        en: {
            title: 'Video call',
            description: 'Content is available only for beta testing.',
            note: 'Video calls require significant server resources, so for now the feature is available only to streamers.',
        },
        uk: {
            title: 'Відеодзвінок',
            description: 'Контент доступний лише для бета-тесту.',
            note: 'Відеодзвінки потребують численних серверних ресурсів, тому зараз опції відкриті лише для стрімерів.',
        },
    },
    mafia: {
        en: {
            title: 'Mafia',
            description: 'Content is available only for beta testing.',
            note: 'The feature is available only to streamers during beta testing.',
        },
        uk: {
            title: 'Мафія',
            description: 'Контент доступний лише для бета-тесту.',
            note: 'Зараз опції відкриті лише для стрімерів.',
        },
    },
    'eat-first': {
        en: {
            title: 'Who we should eat first',
            description: 'Content is available only for beta testing.',
            note: 'The feature is available only to streamers during beta testing.',
        },
        uk: {
            title: 'Кого зʼїсти першим',
            description: 'Контент доступний лише для бета-тесту.',
            note: 'Зараз опції відкриті лише для стрімерів.',
        },
    },
};
const resolvedLocale = computed(() => String(locale.value).toLowerCase().startsWith('uk') ? 'uk' : 'en');
const modalImage = computed(() => modalImages[props.kind][resolvedLocale.value]);
const copy = computed(() => modalCopy[props.kind][resolvedLocale.value]);
const closeLabel = computed(() => (resolvedLocale.value === 'uk' ? 'Закрити вікно' : 'Close dialog'));
const titleId = computed(() => `beta-access-modal-${props.kind}-title`);
const descriptionId = computed(() => `beta-access-modal-${props.kind}-description`);
function closeModal() {
    emit('close');
}
function handleKeydown(event) {
    if (event.key === 'Escape' && props.open) {
        closeModal();
    }
}
onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    void nextTick(() => {
        closeButtonRef.value?.focus({ preventScroll: true });
    });
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown);
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
/** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-enter-from']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-leave-to']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
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
let __VLS_6;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    name: "beta-access-modal",
}));
const __VLS_8 = __VLS_7({
    name: "beta-access-modal",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "beta-access-modal" },
        role: "presentation",
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        type: "button",
        ...{ class: "beta-access-modal__backdrop" },
        'aria-label': (__VLS_ctx.closeLabel),
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal__backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "beta-access-modal__dialog" },
        ...{ class: (`beta-access-modal__dialog--${__VLS_ctx.kind}`) },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': (__VLS_ctx.titleId),
        'aria-describedby': (__VLS_ctx.descriptionId),
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal__dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        id: (__VLS_ctx.titleId),
        ...{ class: "beta-access-modal__sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal__sr-only']} */ ;
    (__VLS_ctx.copy.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        id: (__VLS_ctx.descriptionId),
        ...{ class: "beta-access-modal__sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal__sr-only']} */ ;
    (__VLS_ctx.copy.description);
    (__VLS_ctx.copy.note);
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "beta-access-modal__image" },
        src: (__VLS_ctx.modalImage),
        alt: "",
        'aria-hidden': "true",
        decoding: "async",
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal__image']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ref: "closeButtonRef",
        type: "button",
        ...{ class: "beta-access-modal__close" },
        'aria-label': (__VLS_ctx.closeLabel),
    });
    /** @type {__VLS_StyleScopedClasses['beta-access-modal__close']} */ ;
}
// @ts-ignore
[open, closeModal, closeModal, closeLabel, closeLabel, kind, titleId, titleId, descriptionId, descriptionId, copy, copy, copy, modalImage,];
var __VLS_9;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
