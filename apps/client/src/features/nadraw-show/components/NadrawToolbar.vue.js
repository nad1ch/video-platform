/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import toolbarEraserFrameSrc from '@/assets/nadraw-show/toolbar-eraser-frame.svg';
import toolbarFillSrc from '@/assets/nadraw-show/toolbar-fill.svg';
import toolbarPencilSrc from '@/assets/nadraw-show/toolbar-pencil.svg';
import toolbarRedoSrc from '@/assets/nadraw-show/toolbar-redo.svg';
import toolbarResetSrc from '@/assets/nadraw-show/toolbar-reset.svg';
import toolbarUndoSrc from '@/assets/nadraw-show/toolbar-undo.svg';
import { NADRAW_BRUSH_SIZES, NADRAW_TOOLBAR_COLORS } from './nadrawToolbarConstants';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const colors = NADRAW_TOOLBAR_COLORS;
const sizes = NADRAW_BRUSH_SIZES;
const colorInputRef = useTemplateRef('colorInputRef');
function setColor(c) {
    emit('update:color', c);
    if (props.tool === 'erase') {
        emit('update:tool', 'pencil');
    }
}
function setSize(s) {
    emit('update:brushSize', s);
}
function setTool(tool) {
    emit('update:tool', tool);
}
function onPickerInput(ev) {
    const v = ev.target.value;
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
        emit('update:color', v.toLowerCase());
        if (props.tool === 'erase') {
            emit('update:tool', 'pencil');
        }
    }
}
function openPicker() {
    colorInputRef.value?.click();
}
function normalizeHex6(h) {
    const raw = h.trim().replace(/^#/, '').toLowerCase();
    if (raw.length === 3) {
        return ('#' +
            raw
                .split('')
                .map((ch) => ch + ch)
                .join(''));
    }
    if (raw.length === 6) {
        return `#${raw}`;
    }
    return h.trim().toLowerCase();
}
function colorSelected(c) {
    return normalizeHex6(props.color) === normalizeHex6(c);
}
const customSelected = computed(() => {
    const cur = normalizeHex6(props.color);
    return !colors.some((sw) => normalizeHex6(sw) === cur);
});
const sizeMin = sizes[0];
const sizeMax = sizes[sizes.length - 1];
const sizeProgress = computed(() => {
    const span = sizeMax - sizeMin;
    if (span <= 0) {
        return 0;
    }
    const raw = (props.brushSize - sizeMin) / span;
    return Math.min(1, Math.max(0, raw));
});
const sizeThumbDiameter = computed(() => {
    // Visual preview follows brush size: small on left, larger on right.
    const minPx = 8;
    const maxPx = 20;
    return Math.round(minPx + (maxPx - minPx) * sizeProgress.value);
});
function onSizeInput(ev) {
    const n = Number(ev.target.value);
    if (Number.isFinite(n)) {
        setSize(Math.round(n));
    }
}
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
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tools']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--frame']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--on']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--frame']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--on']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--on']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__range']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__range']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__range']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__range']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__range']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch--on']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__custom-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch--on']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__custom-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-toolbar" },
    role: "toolbar",
    'aria-label': (__VLS_ctx.t('nadrawShow.canvasTitle')),
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.visible) }, null, null);
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-toolbar__tools" },
    role: "group",
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarToolsAria')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tools']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTool('pencil');
            // @ts-ignore
            [t, t, visible, setTool,];
        } },
    type: "button",
    ...{ class: "nadraw-toolbar__tool sa-glass-button" },
    ...{ class: ({ 'nadraw-toolbar__tool--on': __VLS_ctx.tool === 'pencil' }) },
    'aria-label': (__VLS_ctx.t('nadrawShow.toolPencilAria')),
    'aria-pressed': (__VLS_ctx.tool === 'pencil'),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-toolbar__icon nadraw-toolbar__icon--pencil" },
    src: (__VLS_ctx.toolbarPencilSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__icon--pencil']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTool('erase');
            // @ts-ignore
            [t, setTool, tool, tool, toolbarPencilSrc,];
        } },
    type: "button",
    ...{ class: "nadraw-toolbar__tool nadraw-toolbar__tool--frame sa-glass-button" },
    ...{ class: ({ 'nadraw-toolbar__tool--on': __VLS_ctx.tool === 'erase' }) },
    'aria-label': (__VLS_ctx.t('nadrawShow.toolEraseAria')),
    'aria-pressed': (__VLS_ctx.tool === 'erase'),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--frame']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-toolbar__frame-img" },
    src: (__VLS_ctx.toolbarEraserFrameSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTool('fill');
            // @ts-ignore
            [t, setTool, tool, tool, toolbarEraserFrameSrc,];
        } },
    type: "button",
    ...{ class: "nadraw-toolbar__tool sa-glass-button" },
    ...{ class: ({ 'nadraw-toolbar__tool--on': __VLS_ctx.tool === 'fill' }) },
    'aria-label': (__VLS_ctx.t('nadrawShow.toolFillAria')),
    'aria-pressed': (__VLS_ctx.tool === 'fill'),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__tool--on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-toolbar__icon nadraw-toolbar__icon--fill" },
    src: (__VLS_ctx.toolbarFillSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__icon--fill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-toolbar__colors" },
    role: "group",
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarColorsAria')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__colors']} */ ;
for (const [c] of __VLS_vFor((__VLS_ctx.colors))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.setColor(c);
                // @ts-ignore
                [t, t, tool, tool, toolbarFillSrc, colors, setColor,];
            } },
        key: (c),
        type: "button",
        ...{ class: "nadraw-toolbar__swatch" },
        ...{ class: ({ 'nadraw-toolbar__swatch--on': __VLS_ctx.colorSelected(c) }) },
        ...{ style: ({ backgroundColor: c }) },
        title: (c),
        'aria-pressed': (__VLS_ctx.colorSelected(c)),
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch--on']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sr-only" },
    });
    /** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
    (c);
    // @ts-ignore
    [colorSelected, colorSelected,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-toolbar__custom-wrap" },
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__custom-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.onPickerInput) },
    ref: "colorInputRef",
    type: "color",
    ...{ class: "nadraw-toolbar__color-input" },
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarColorPickerAria')),
    value: (__VLS_ctx.color.length === 7 ? __VLS_ctx.color : '#000000'),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__color-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openPicker) },
    type: "button",
    ...{ class: "nadraw-toolbar__swatch nadraw-toolbar__swatch--rainbow" },
    ...{ class: ({ 'nadraw-toolbar__swatch--on': __VLS_ctx.customSelected }) },
    title: (__VLS_ctx.t('nadrawShow.toolbarColorPickerAria')),
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarColorPickerAria')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch--rainbow']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__swatch--on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "sr-only" },
});
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
(__VLS_ctx.t('nadrawShow.toolbarColorPickerAria'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-toolbar__size" },
    role: "group",
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarSizesAria')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "nadraw-toolbar__size-thumb" },
    ...{ style: ({
            '--nadraw-size-progress': `${__VLS_ctx.sizeProgress}`,
            '--nadraw-size-thumb': `${__VLS_ctx.sizeThumbDiameter}px`,
        }) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__size-thumb']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (__VLS_ctx.onSizeInput) },
    ...{ class: "nadraw-toolbar__range" },
    type: "range",
    min: (__VLS_ctx.sizes[0]),
    max: (__VLS_ctx.sizes[__VLS_ctx.sizes.length - 1]),
    value: (__VLS_ctx.brushSize),
    title: (__VLS_ctx.t('nadrawShow.toolbarSizeTitle', { n: __VLS_ctx.brushSize })),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__range']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadraw-toolbar__history" },
    role: "group",
    'aria-label': "Game actions",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('undo');
            // @ts-ignore
            [t, t, t, t, t, t, onPickerInput, color, color, openPicker, customSelected, sizeProgress, sizeThumbDiameter, onSizeInput, sizes, sizes, sizes, brushSize, brushSize, emit,];
        } },
    type: "button",
    ...{ class: "nadraw-toolbar__history-btn sa-glass-button" },
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarUndoAria')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-toolbar__frame-img" },
    src: (__VLS_ctx.toolbarUndoSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('redo');
            // @ts-ignore
            [t, emit, toolbarUndoSrc,];
        } },
    type: "button",
    ...{ class: "nadraw-toolbar__history-btn sa-glass-button" },
    'aria-label': (__VLS_ctx.t('nadrawShow.toolbarRedoAria')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-toolbar__frame-img" },
    src: (__VLS_ctx.toolbarRedoSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('resetGame');
            // @ts-ignore
            [t, emit, toolbarRedoSrc,];
        } },
    type: "button",
    ...{ class: "nadraw-toolbar__history-btn nadraw-toolbar__history-btn--reset sa-glass-button" },
    'aria-label': "Reset game",
    title: "Reset game",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__history-btn--reset']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "nadraw-toolbar__frame-img" },
    src: (__VLS_ctx.toolbarResetSrc),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['nadraw-toolbar__frame-img']} */ ;
// @ts-ignore
[toolbarResetSrc,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
