/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useI18n } from 'vue-i18n';
import AppButton from '@/components/ui/AppButton.vue';
const __VLS_props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
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
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "call-page__debug" },
    'aria-label': (__VLS_ctx.t('callPage.debugAria')),
});
/** @type {__VLS_StyleScopedClasses['call-page__debug']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "call-page__debug-head" },
});
/** @type {__VLS_StyleScopedClasses['call-page__debug-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "call-page__debug-title" },
});
/** @type {__VLS_StyleScopedClasses['call-page__debug-title']} */ ;
(__VLS_ctx.t('callPage.debugTitle'));
const __VLS_0 = AppButton || AppButton;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.inboundBusy),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    variant: "secondary",
    disabled: (__VLS_ctx.inboundBusy),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.emit('refresh');
            // @ts-ignore
            [t, t, inboundBusy, emit,];
        } });
const { default: __VLS_7 } = __VLS_3.slots;
(__VLS_ctx.inboundBusy ? __VLS_ctx.t('callPage.debugRefreshing') : __VLS_ctx.t('callPage.debugRefresh'));
// @ts-ignore
[t, t, inboundBusy,];
var __VLS_3;
var __VLS_4;
__VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
    ...{ class: "call-page__debug-dl" },
});
/** @type {__VLS_StyleScopedClasses['call-page__debug-dl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugPreset'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.videoQualityPreset);
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugExplicit'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.videoQualityExplicit);
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugPublishTier'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.videoPublishTier);
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugActiveCamerasWire'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.activeCameraPublishersAtWire);
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugPeersWire'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.peerCountAtWire);
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugPublishSimulcast'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.publishSimulcast);
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugActiveSpeaker'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.effectiveActiveSpeakerPeerId ?? '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
(__VLS_ctx.t('callPage.debugServerSpeaker'));
__VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
(__VLS_ctx.snapshot.serverActiveSpeakerPeerId ?? '—');
if (__VLS_ctx.inboundRows.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "call-page__debug-list" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__debug-list']} */ ;
    for (const [row] of __VLS_vFor((__VLS_ctx.inboundRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (row.producerId),
            ...{ class: "call-page__debug-li" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__debug-li']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "call-page__debug-peer" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__debug-peer']} */ ;
        (row.peerId.slice(0, 8));
        (row.frameWidth ?? '?');
        (row.frameHeight ?? '?');
        if (row.framesPerSecond != null) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "call-page__debug-fps" },
            });
            /** @type {__VLS_StyleScopedClasses['call-page__debug-fps']} */ ;
            (row.framesPerSecond.toFixed(1));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "call-page__debug-loss" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__debug-loss']} */ ;
        (row.packetsLost ?? '—');
        // @ts-ignore
        [t, t, t, t, t, t, t, t, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, snapshot, inboundRows, inboundRows,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
