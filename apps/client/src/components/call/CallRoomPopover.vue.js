/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppButton from '@/components/ui/AppButton.vue';
import { CALL_ROOM_POPOVER_PANEL_ID } from '@/stores/callRoomHeaderJoin';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const displayNameModel = computed({
    get: () => props.displayName,
    set: (value) => emit('update:displayName', value),
});
const roomJoinDraftModel = computed({
    get: () => props.roomJoinDraft,
    set: (value) => emit('update:roomJoinDraft', value),
});
const videoQualityChoiceModel = computed({
    get: () => props.videoQualityChoice,
    set: (value) => emit('update:videoQualityChoice', value),
});
const callDebugOverlayModel = computed({
    get: () => props.callDebugOverlay,
    set: (value) => emit('update:callDebugOverlay', value),
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
    name: "call-page-room-pop",
}));
const __VLS_8 = __VLS_7({
    name: "call-page-room-pop",
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_11 } = __VLS_9.slots;
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        id: (__VLS_ctx.CALL_ROOM_POPOVER_PANEL_ID),
        ...{ class: "call-page__room-pop sa-scrollbar" },
        role: "dialog",
        'aria-label': (__VLS_ctx.t('callPage.roomPopoverAria')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-scrollbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "call-page__room-pop-field call-page__room-pop-field--top" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-field']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-field--top']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('callPage.fieldName'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.displayNameModel),
        type: "text",
        name: "call-display-name",
        autocomplete: "name",
        placeholder: (__VLS_ctx.t('callPage.placeholderName')),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__room-pop-code" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "call-page__room-pop-label" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-label']} */ ;
    (__VLS_ctx.t('callPage.roomCodeLabel'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__room-pop-code-row" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeydown: (...[$event]) => {
                if (!(__VLS_ctx.open))
                    return;
                __VLS_ctx.emit('submit-room');
                // @ts-ignore
                [open, CALL_ROOM_POPOVER_PANEL_ID, t, t, t, t, displayNameModel, emit,];
            } },
        value: (__VLS_ctx.roomJoinDraftModel),
        ...{ class: "call-page__room-pop-code-input" },
        type: "text",
        name: "call-room-code",
        autocomplete: "off",
        placeholder: (__VLS_ctx.t('callPage.roomJoinPlaceholder')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__room-pop-code-tools" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-code-tools']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__room-pop-copy-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-copy-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.open))
                    return;
                __VLS_ctx.emit('copy-room');
                // @ts-ignore
                [t, emit, roomJoinDraftModel,];
            } },
        type: "button",
        ...{ class: "call-page__room-pop-ico-btn" },
        disabled: (__VLS_ctx.joining),
        title: (__VLS_ctx.roomCopyFlash ? __VLS_ctx.t('callPage.roomCodeCopied') : __VLS_ctx.t('callPage.roomCopy')),
        'aria-label': (__VLS_ctx.roomCopyFlash ? __VLS_ctx.t('callPage.roomCodeCopied') : __VLS_ctx.t('callPage.roomCopy')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-ico-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        xmlns: "http://www.w3.org/2000/svg",
        width: "18",
        height: "18",
        fill: "none",
        viewBox: "0 0 24 24",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'aria-hidden': "true",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        width: "14",
        height: "14",
        x: "8",
        y: "8",
        rx: "2",
        ry: "2",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        role: "status",
        'aria-live': "polite",
        ...{ class: "call-page__room-pop-copy-tooltip" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.roomCopyFlash) }, null, null);
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-copy-tooltip']} */ ;
    (__VLS_ctx.t('callPage.roomCodeCopied'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.open))
                    return;
                __VLS_ctx.emit('generate-room');
                // @ts-ignore
                [t, t, t, t, t, emit, joining, roomCopyFlash, roomCopyFlash, roomCopyFlash,];
            } },
        type: "button",
        ...{ class: "call-page__room-pop-ico-btn" },
        disabled: (__VLS_ctx.joining),
        title: (__VLS_ctx.t('callPage.roomGenerateNew')),
        'aria-label': (__VLS_ctx.t('callPage.roomRegenerateAria')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-ico-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        xmlns: "http://www.w3.org/2000/svg",
        width: "18",
        height: "18",
        fill: "none",
        viewBox: "0 0 24 24",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'aria-hidden': "true",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
        width: "16",
        height: "16",
        x: "4",
        y: "4",
        rx: "2.5",
        ry: "2.5",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "9",
        cy: "9",
        r: "1.1",
        fill: "currentColor",
        stroke: "none",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "15",
        cy: "9",
        r: "1.1",
        fill: "currentColor",
        stroke: "none",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "9",
        cy: "15",
        r: "1.1",
        fill: "currentColor",
        stroke: "none",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
        cx: "15",
        cy: "15",
        r: "1.1",
        fill: "currentColor",
        stroke: "none",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__room-pop-join" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__room-pop-join']} */ ;
    const __VLS_12 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ 'onClick': {} },
        variant: "primary",
        disabled: (__VLS_ctx.joining),
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onClick': {} },
        variant: "primary",
        disabled: (__VLS_ctx.joining),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_17;
    const __VLS_18 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.open))
                    return;
                __VLS_ctx.emit('submit-room');
                // @ts-ignore
                [t, t, emit, joining, joining,];
            } });
    const { default: __VLS_19 } = __VLS_15.slots;
    (__VLS_ctx.t('callPage.roomSwitch'));
    // @ts-ignore
    [t,];
    var __VLS_15;
    var __VLS_16;
    if (__VLS_ctx.allowManualVideoQuality) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({
            ...{ class: "call-page__fieldset call-page__fieldset--in-pop" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__fieldset']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__fieldset--in-pop']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({
            ...{ class: "call-page__legend" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__legend']} */ ;
        (__VLS_ctx.t('callPage.qualityPreset'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "call-page__hint--small" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__hint--small']} */ ;
        (__VLS_ctx.t('callPage.qualityAdminHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "call-page__preset-row" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__preset-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "call-page__preset" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__preset']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "radio",
            name: "video-quality-pop",
            value: "auto",
        });
        (__VLS_ctx.videoQualityChoiceModel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.t('callPage.quality.auto'));
        for (const [p] of __VLS_vFor((__VLS_ctx.qualityPresets))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (p),
                ...{ class: "call-page__preset" },
            });
            /** @type {__VLS_StyleScopedClasses['call-page__preset']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "radio",
                name: "video-quality-pop",
                value: (p),
            });
            (__VLS_ctx.videoQualityChoiceModel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.t(`callPage.quality.${p}`));
            // @ts-ignore
            [t, t, t, t, allowManualVideoQuality, videoQualityChoiceModel, videoQualityChoiceModel, qualityPresets,];
        }
    }
    if (__VLS_ctx.showCallDebugControls) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "call-page__check call-page__check--in-pop" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__check']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__check--in-pop']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (__VLS_ctx.callDebugOverlayModel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.t('callPage.debugOverlay'));
    }
    if (__VLS_ctx.isAdmin) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "call-page__meta call-page__meta--in-pop" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__meta']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__meta--in-pop']} */ ;
        (__VLS_ctx.t('callPage.wsStatus', { status: __VLS_ctx.wsStatus }));
    }
}
// @ts-ignore
[t, t, showCallDebugControls, callDebugOverlayModel, isAdmin, wsStatus,];
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
