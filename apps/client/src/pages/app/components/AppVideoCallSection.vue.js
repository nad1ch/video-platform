/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import avatarBeanieBody from '@/assets/landing/video-call/avatar-beanie-body.svg';
import avatarBeanieExpression from '@/assets/landing/video-call/avatar-beanie-expression.svg';
import avatarBeanieGlasses from '@/assets/landing/video-call/avatar-beanie-glasses.svg';
import avatarBeanieHat from '@/assets/landing/video-call/avatar-beanie-hat.svg';
import avatarBeanieHead from '@/assets/landing/video-call/avatar-beanie-head.svg';
import avatarBucketBody from '@/assets/landing/video-call/avatar-bucket-body.svg';
import avatarBucketExpression from '@/assets/landing/video-call/avatar-bucket-expression.svg';
import avatarBucketHalo from '@/assets/landing/video-call/avatar-bucket-halo.svg';
import avatarBucketHat from '@/assets/landing/video-call/avatar-bucket-hat.svg';
import avatarBucketHead from '@/assets/landing/video-call/avatar-bucket-head.svg';
import avatarCap from '@/assets/landing/video-call/avatar-cap.svg';
import avatarGlassesHat from '@/assets/landing/video-call/avatar-glasses-hat.svg';
import avatarHeadbandBody from '@/assets/landing/video-call/avatar-headband-body.svg';
import avatarHeadbandExpression from '@/assets/landing/video-call/avatar-headband-expression.svg';
import avatarHeadbandHair from '@/assets/landing/video-call/avatar-headband-hair.svg';
import avatarHeadbandHalo from '@/assets/landing/video-call/avatar-headband-halo.svg';
import avatarHeadbandHead from '@/assets/landing/video-call/avatar-headband-head.svg';
import avatarHeadbandMarks from '@/assets/landing/video-call/avatar-headband-marks.svg';
import avatarHeadphones from '@/assets/landing/video-call/avatar-headphones.svg';
import avatarHost from '@/assets/landing/video-call/avatar-host.svg';
import avatarSidecapBody from '@/assets/landing/video-call/avatar-sidecap-body.svg';
import avatarSidecapExpression from '@/assets/landing/video-call/avatar-sidecap-expression.svg';
import avatarSidecapHalo from '@/assets/landing/video-call/avatar-sidecap-halo.svg';
import avatarSidecapHat from '@/assets/landing/video-call/avatar-sidecap-hat.svg';
import avatarSidecapHead from '@/assets/landing/video-call/avatar-sidecap-head.svg';
const __VLS_props = defineProps();
const { t } = useI18n();
const previewTiles = [
    {
        id: 'host',
        tone: 'violet',
        layers: [{ src: avatarHost, className: 'app-call__avatar--host' }],
    },
    {
        id: 'headband',
        tone: 'indigo',
        layers: [
            { src: avatarHeadbandHalo, className: 'app-call__avatar--headband-halo' },
            { src: avatarHeadbandBody, className: 'app-call__avatar--headband-body' },
            { src: avatarHeadbandHead, className: 'app-call__avatar--headband-head' },
            { src: avatarHeadbandHair, className: 'app-call__avatar--headband-hair' },
            { src: avatarHeadbandExpression, className: 'app-call__avatar--headband-expression' },
            { src: avatarHeadbandMarks, className: 'app-call__avatar--headband-marks' },
        ],
    },
    {
        id: 'headphones',
        tone: 'brown',
        layers: [{ src: avatarHeadphones, className: 'app-call__avatar--headphones' }],
    },
    {
        id: 'cap',
        tone: 'olive',
        layers: [{ src: avatarCap, className: 'app-call__avatar--cap' }],
    },
    {
        id: 'bucket',
        tone: 'sand',
        layers: [
            { src: avatarBucketHalo, className: 'app-call__avatar--bucket-halo' },
            { src: avatarBucketBody, className: 'app-call__avatar--bucket-body' },
            { src: avatarBucketHead, className: 'app-call__avatar--bucket-head' },
            { src: avatarBucketHat, className: 'app-call__avatar--bucket-hat' },
            { src: avatarBucketExpression, className: 'app-call__avatar--bucket-expression' },
        ],
    },
    {
        id: 'glasses-hat',
        tone: 'pink',
        layers: [{ src: avatarGlassesHat, className: 'app-call__avatar--glasses-hat' }],
    },
    {
        id: 'beanie',
        tone: 'rose',
        layers: [
            { src: avatarBeanieBody, className: 'app-call__avatar--beanie-body' },
            { src: avatarBeanieHead, className: 'app-call__avatar--beanie-head' },
            { src: avatarBeanieHat, className: 'app-call__avatar--beanie-hat' },
            { src: avatarBeanieGlasses, className: 'app-call__avatar--beanie-glasses' },
            { src: avatarBeanieExpression, className: 'app-call__avatar--beanie-expression' },
        ],
    },
    {
        id: 'sidecap',
        tone: 'purple',
        layers: [
            { src: avatarSidecapHalo, className: 'app-call__avatar--sidecap-halo' },
            { src: avatarSidecapBody, className: 'app-call__avatar--sidecap-body' },
            { src: avatarSidecapHead, className: 'app-call__avatar--sidecap-head' },
            { src: avatarSidecapHat, className: 'app-call__avatar--sidecap-hat' },
            { src: avatarSidecapExpression, className: 'app-call__avatar--sidecap-expression' },
        ],
    },
];
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-call__button']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__tile--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--host']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headphones']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--cap']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--glasses-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--host']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headphones']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--cap']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--glasses-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--bucket-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--sidecap-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-body']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-head']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-hair']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--headband-marks']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--bucket-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--bucket-body']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--bucket-head']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--bucket-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--bucket-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--beanie-body']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--beanie-head']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--beanie-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--beanie-glasses']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--beanie-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--sidecap-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--sidecap-body']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--sidecap-head']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--sidecap-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__avatar--sidecap-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__button-title']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__screen']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "app-call app-call__panel" },
    'aria-labelledby': "app-call-title",
});
/** @type {__VLS_StyleScopedClasses['app-call']} */ ;
/** @type {__VLS_StyleScopedClasses['app-call__panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: "app-call-title",
    ...{ class: "app-call__title" },
});
/** @type {__VLS_StyleScopedClasses['app-call__title']} */ ;
(__VLS_ctx.t('home.sectionVideoCall'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "app-call__button-title" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['app-call__button-title']} */ ;
(__VLS_ctx.t('home.sectionVideoCall'));
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "app-call__button" },
    to: (__VLS_ctx.to),
    'aria-label': (__VLS_ctx.authHint),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "app-call__button" },
    to: (__VLS_ctx.to),
    'aria-label': (__VLS_ctx.authHint),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['app-call__button']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "app-call__screen" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['app-call__screen']} */ ;
for (const [tile] of __VLS_vFor((__VLS_ctx.previewTiles))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (tile.id),
        ...{ class: "app-call__tile" },
        ...{ class: ([`app-call__tile--${tile.tone}`, `app-call__tile--${tile.id}`]) },
    });
    /** @type {__VLS_StyleScopedClasses['app-call__tile']} */ ;
    for (const [layer] of __VLS_vFor((tile.layers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            key: (layer.className),
            ...{ class: "app-call__avatar-layer" },
            ...{ class: (layer.className) },
            src: (layer.src),
            alt: "",
            loading: "lazy",
            decoding: "async",
        });
        /** @type {__VLS_StyleScopedClasses['app-call__avatar-layer']} */ ;
        // @ts-ignore
        [t, t, to, authHint, previewTiles,];
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
