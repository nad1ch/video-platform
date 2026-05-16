/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import NadrawToolbar from './NadrawToolbar.vue';
import { floodFillImageData, hexToRgb } from './nadrawCanvasOps';
import { NADRAW_BRUSH_SIZES, NADRAW_TOOLBAR_COLORS } from './nadrawToolbarConstants';
const BOARD_FILL = '#ffffff';
const props = defineProps();
const { t } = useI18n();
const emit = defineEmits();
const wrapRef = ref(null);
const canvasRef = ref(null);
let ctx = null;
let activeStrokeId = null;
let localLast = null;
const remoteLast = new Map();
const brushColor = ref(NADRAW_TOOLBAR_COLORS[0]);
const brushSize = ref(NADRAW_BRUSH_SIZES[3]);
const canvasTool = ref('pencil');
const HISTORY_LIMIT = 80;
const historyPast = [];
const historyFuture = [];
const localStrokeIds = new Set();
let shapeSnapshot = null;
let shapeStartNorm = null;
let shapeKind = null;
let localEraseStrokeStyle = null;
const remoteEraseStrokeStyleById = new Map();
const boardCursor = computed(() => {
    if (!props.canDraw) {
        return '';
    }
    if (canvasTool.value === 'fill') {
        return 'cursor-cell';
    }
    return 'cursor-crosshair';
});
function toolMeta(partial) {
    const erase = canvasTool.value === 'erase';
    return {
        color: brushColor.value,
        lineWidth: brushSize.value,
        erase,
        op: partial?.op,
        x2: partial?.x2,
        y2: partial?.y2,
    };
}
function rgbaCssFromBytes(r, g, b, a) {
    return `rgba(${r},${g},${b},${a / 255})`;
}
function boardFillRgbaCss() {
    const rgb = hexToRgb(BOARD_FILL);
    return rgb ? rgbaCssFromBytes(rgb.r, rgb.g, rgb.b, rgb.a) : 'rgba(255,255,255,1)';
}
function sampleStrokeStyleAtCss(cssX, cssY) {
    const canvas = canvasRef.value;
    if (!canvas || !ctx) {
        return boardFillRgbaCss();
    }
    const dpr = window.devicePixelRatio || 1;
    const deviceX = Math.min(canvas.width - 1, Math.max(0, Math.floor(cssX * dpr)));
    const deviceY = Math.min(canvas.height - 1, Math.max(0, Math.floor(cssY * dpr)));
    const id = ctx.getImageData(deviceX, deviceY, 1, 1);
    const tr = id.data[0];
    const tg = id.data[1];
    const tb = id.data[2];
    const ta = id.data[3];
    if (ta === 0) {
        return boardFillRgbaCss();
    }
    return rgbaCssFromBytes(tr, tg, tb, ta);
}
function applyLocalStrokeStyle(m) {
    if (!ctx) {
        return;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (m.erase) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = localEraseStrokeStyle ?? boardFillRgbaCss();
    }
    else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = m.color;
    }
    ctx.lineWidth = m.lineWidth;
}
function resetComposite() {
    if (!ctx) {
        return;
    }
    ctx.globalCompositeOperation = 'source-over';
}
function canvasCssPixelSize() {
    const canvas = canvasRef.value;
    if (!canvas) {
        return null;
    }
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (w < 1 || h < 1) {
        return null;
    }
    return { w, h };
}
function resizeCanvas() {
    const canvas = canvasRef.value;
    if (!canvas || !wrapRef.value) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const r2 = canvas.getBoundingClientRect();
    const w = r2.width;
    const h = r2.height;
    if (w < 1 || h < 1) {
        return;
    }
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BOARD_FILL;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    remoteLast.clear();
    localLast = null;
    shapeSnapshot = null;
    shapeStartNorm = null;
    shapeKind = null;
    resetHistory();
    pushHistorySnapshot();
}
function clamp01(v) {
    return Math.min(1, Math.max(0, v));
}
function normFromEvent(ev) {
    const canvas = canvasRef.value;
    if (!canvas) {
        return null;
    }
    const r = canvas.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
        return null;
    }
    return {
        nx: clamp01((ev.clientX - r.left) / r.width),
        ny: clamp01((ev.clientY - r.top) / r.height),
    };
}
function randomStrokeId() {
    try {
        return crypto.randomUUID();
    }
    catch {
        return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
function saveShapeSnapshot() {
    const canvas = canvasRef.value;
    if (!canvas || !ctx) {
        return;
    }
    shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
}
function restoreShapeSnapshot() {
    if (shapeSnapshot && ctx) {
        ctx.putImageData(shapeSnapshot, 0, 0);
    }
}
function clearShapeGesture() {
    shapeSnapshot = null;
    shapeStartNorm = null;
    shapeKind = null;
}
function canvasImageData() {
    const canvas = canvasRef.value;
    if (!canvas || !ctx) {
        return null;
    }
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
function restoreImageData(frame) {
    if (!ctx) {
        return;
    }
    ctx.putImageData(frame, 0, 0);
}
function resetHistory() {
    historyPast.length = 0;
    historyFuture.length = 0;
}
function pushHistorySnapshot() {
    const frame = canvasImageData();
    if (!frame) {
        return;
    }
    historyPast.push(frame);
    if (historyPast.length > HISTORY_LIMIT) {
        historyPast.shift();
    }
    historyFuture.length = 0;
}
function undoLast() {
    if (historyPast.length < 2) {
        return;
    }
    const current = historyPast.pop();
    if (!current) {
        return;
    }
    historyFuture.push(current);
    const prev = historyPast[historyPast.length - 1];
    if (!prev) {
        return;
    }
    restoreImageData(prev);
}
function redoLast() {
    const next = historyFuture.pop();
    if (!next) {
        return;
    }
    restoreImageData(next);
    historyPast.push(next);
    if (historyPast.length > HISTORY_LIMIT) {
        historyPast.shift();
    }
}
function floodFillAtNormalized(nx, ny, colorHex) {
    const canvas = canvasRef.value;
    if (!canvas || !ctx) {
        return;
    }
    const size = canvasCssPixelSize();
    if (!size) {
        return;
    }
    const rgb = hexToRgb(colorHex);
    if (!rgb) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    const cssX = nx * size.w;
    const cssY = ny * size.h;
    const seedX = Math.min(canvas.width - 1, Math.max(0, Math.floor(cssX * dpr)));
    const seedY = Math.min(canvas.height - 1, Math.max(0, Math.floor(cssY * dpr)));
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    floodFillImageData(imageData.data, canvas.width, canvas.height, seedX, seedY, rgb.r, rgb.g, rgb.b, rgb.a);
    ctx.putImageData(imageData, 0, 0);
}
function strokeShapePreview(kind, n0, n1) {
    const size = canvasCssPixelSize();
    if (!ctx || !size) {
        return;
    }
    restoreShapeSnapshot();
    const x0 = n0.nx * size.w;
    const y0 = n0.ny * size.h;
    const x1 = n1.nx * size.w;
    const y1 = n1.ny * size.h;
    const minX = Math.min(x0, x1);
    const minY = Math.min(y0, y1);
    const rw = Math.max(Math.abs(x1 - x0), 1);
    const rh = Math.max(Math.abs(y1 - y0), 1);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = brushColor.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'rect') {
        ctx.strokeRect(minX, minY, rw, rh);
    }
    else {
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const rx = Math.max(rw / 2, 0.5);
        const ry = Math.max(rh / 2, 0.5);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
function strokeShapeFinal(kind, n0, n1) {
    const size = canvasCssPixelSize();
    if (!ctx || !size) {
        return;
    }
    restoreShapeSnapshot();
    const x0 = n0.nx * size.w;
    const y0 = n0.ny * size.h;
    const x1 = n1.nx * size.w;
    const y1 = n1.ny * size.h;
    const minX = Math.min(x0, x1);
    const minY = Math.min(y0, y1);
    const rw = Math.max(Math.abs(x1 - x0), 1);
    const rh = Math.max(Math.abs(y1 - y0), 1);
    ctx.save();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = brushColor.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'rect') {
        ctx.strokeRect(minX, minY, rw, rh);
    }
    else {
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const rx = Math.max(rw / 2, 0.5);
        const ry = Math.max(rh / 2, 0.5);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
    shapeSnapshot = null;
}
function onPointerDown(ev) {
    const canvas = canvasRef.value;
    if (!props.canDraw || !canvas || !ctx) {
        return;
    }
    const size = canvasCssPixelSize();
    if (!size) {
        return;
    }
    const n = normFromEvent(ev);
    if (!n) {
        return;
    }
    if (canvasTool.value === 'fill') {
        canvas.setPointerCapture(ev.pointerId);
        floodFillAtNormalized(n.nx, n.ny, brushColor.value);
        pushHistorySnapshot();
        const strokeId = randomStrokeId();
        localStrokeIds.add(strokeId);
        emit('drawEnd', strokeId, n.nx, n.ny, toolMeta({ op: 'fill' }));
        try {
            canvas.releasePointerCapture(ev.pointerId);
        }
        catch {
            /* ignore */
        }
        return;
    }
    if (canvasTool.value === 'rect' || canvasTool.value === 'ellipse') {
        canvas.setPointerCapture(ev.pointerId);
        saveShapeSnapshot();
        shapeStartNorm = { nx: n.nx, ny: n.ny };
        shapeKind = canvasTool.value;
        activeStrokeId = randomStrokeId();
        localStrokeIds.add(activeStrokeId);
        return;
    }
    canvas.setPointerCapture(ev.pointerId);
    activeStrokeId = randomStrokeId();
    localStrokeIds.add(activeStrokeId);
    const meta = toolMeta();
    if (meta.erase) {
        localEraseStrokeStyle = sampleStrokeStyleAtCss(n.nx * size.w, n.ny * size.h);
    }
    else {
        localEraseStrokeStyle = null;
    }
    applyLocalStrokeStyle(meta);
    localLast = { x: n.nx * size.w, y: n.ny * size.h };
    emit('drawStart', activeStrokeId, n.nx, n.ny, meta);
}
function onPointerMove(ev) {
    if (!props.canDraw || !ctx) {
        return;
    }
    const size = canvasCssPixelSize();
    if (!size) {
        return;
    }
    const n = normFromEvent(ev);
    if (!n) {
        return;
    }
    if (shapeStartNorm && shapeKind) {
        strokeShapePreview(shapeKind, shapeStartNorm, n);
        return;
    }
    if (!activeStrokeId) {
        return;
    }
    const x = n.nx * size.w;
    const y = n.ny * size.h;
    const meta = toolMeta();
    applyLocalStrokeStyle(meta);
    if (localLast) {
        ctx.beginPath();
        ctx.moveTo(localLast.x, localLast.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    localLast = { x, y };
    emit('drawMove', activeStrokeId, n.nx, n.ny, meta);
}
function onPointerUp(ev) {
    const canvas = canvasRef.value;
    if (!props.canDraw || !canvas) {
        activeStrokeId = null;
        localEraseStrokeStyle = null;
        clearShapeGesture();
        resetComposite();
        return;
    }
    try {
        canvas.releasePointerCapture(ev.pointerId);
    }
    catch {
        /* ignore */
    }
    const size = canvasCssPixelSize();
    const n = normFromEvent(ev);
    if (shapeStartNorm && shapeKind && n && activeStrokeId) {
        const startNx = shapeStartNorm.nx;
        const startNy = shapeStartNorm.ny;
        const kind = shapeKind;
        const sid = activeStrokeId;
        strokeShapeFinal(kind, shapeStartNorm, n);
        pushHistorySnapshot();
        emit('drawEnd', sid, startNx, startNy, toolMeta({ op: kind, x2: n.nx, y2: n.ny }));
        shapeStartNorm = null;
        shapeKind = null;
        activeStrokeId = null;
        resetComposite();
        return;
    }
    if (!activeStrokeId || !ctx || !size || !n || !localLast) {
        activeStrokeId = null;
        localLast = null;
        localEraseStrokeStyle = null;
        clearShapeGesture();
        resetComposite();
        return;
    }
    const x = n.nx * size.w;
    const y = n.ny * size.h;
    const meta = toolMeta();
    applyLocalStrokeStyle(meta);
    ctx.beginPath();
    ctx.moveTo(localLast.x, localLast.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    pushHistorySnapshot();
    emit('drawEnd', activeStrokeId, n.nx, n.ny, meta);
    activeStrokeId = null;
    localLast = null;
    localEraseStrokeStyle = null;
    resetComposite();
}
function clearBoard() {
    resizeCanvas();
}
function prepRemoteStroke(col, lw, erase, eraseStrokeStyle) {
    if (!ctx) {
        return;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (erase) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = eraseStrokeStyle ?? boardFillRgbaCss();
    }
    else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = col;
    }
    ctx.lineWidth = lw;
}
function applyRemote(p) {
    if (localStrokeIds.has(p.strokeId)) {
        if (p.phase === 'end') {
            localStrokeIds.delete(p.strokeId);
        }
        return;
    }
    const canvas = canvasRef.value;
    if (!canvas || !ctx) {
        return;
    }
    const size = canvasCssPixelSize();
    if (!size) {
        return;
    }
    const w = size.w;
    const h = size.h;
    const op = p.op ?? 'stroke';
    if (op === 'fill' && p.phase === 'end' && !p.erase) {
        const col = typeof p.color === 'string' ? p.color : '#000000';
        floodFillAtNormalized(p.x, p.y, col);
        pushHistorySnapshot();
        resetComposite();
        return;
    }
    if ((op === 'rect' || op === 'ellipse') &&
        p.phase === 'end' &&
        typeof p.x2 === 'number' &&
        typeof p.y2 === 'number' &&
        !p.erase) {
        const lw = typeof p.lineWidth === 'number' ? p.lineWidth : 3;
        const col = typeof p.color === 'string' ? p.color : '#111827';
        const n0 = { nx: p.x, ny: p.y };
        const n1 = { nx: p.x2, ny: p.y2 };
        const x0 = n0.nx * w;
        const y0 = n0.ny * h;
        const x1 = n1.nx * w;
        const y1 = n1.ny * h;
        const minX = Math.min(x0, x1);
        const minY = Math.min(y0, y1);
        const rw = Math.max(Math.abs(x1 - x0), 1);
        const rh = Math.max(Math.abs(y1 - y0), 1);
        prepRemoteStroke(col, lw, false);
        ctx.setLineDash([]);
        if (op === 'rect') {
            ctx.strokeRect(minX, minY, rw, rh);
        }
        else {
            const cx = (x0 + x1) / 2;
            const cy = (y0 + y1) / 2;
            const rx = Math.max(rw / 2, 0.5);
            const ry = Math.max(rh / 2, 0.5);
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        pushHistorySnapshot();
        resetComposite();
        return;
    }
    const x = p.x * w;
    const y = p.y * h;
    const lw = typeof p.lineWidth === 'number' ? p.lineWidth : 3;
    const col = typeof p.color === 'string' ? p.color : '#111827';
    const erase = p.erase === true;
    if (p.phase === 'start') {
        if (erase) {
            remoteEraseStrokeStyleById.set(p.strokeId, sampleStrokeStyleAtCss(x, y));
        }
        else {
            remoteEraseStrokeStyleById.delete(p.strokeId);
        }
        prepRemoteStroke(col, lw, erase, remoteEraseStrokeStyleById.get(p.strokeId));
        remoteLast.set(p.strokeId, { x, y });
        resetComposite();
        return;
    }
    const last = remoteLast.get(p.strokeId);
    if (last) {
        prepRemoteStroke(col, lw, erase, remoteEraseStrokeStyleById.get(p.strokeId));
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    remoteLast.set(p.strokeId, { x, y });
    if (p.phase === 'end') {
        remoteLast.delete(p.strokeId);
        remoteEraseStrokeStyleById.delete(p.strokeId);
        pushHistorySnapshot();
    }
    resetComposite();
}
const __VLS_exposed = { clearBoard, applyRemote };
defineExpose(__VLS_exposed);
let ro = null;
function onHistoryHotkeys(ev) {
    const target = ev.target;
    if (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)) {
        return;
    }
    const ctrlOrMeta = ev.ctrlKey || ev.metaKey;
    if (!ctrlOrMeta) {
        return;
    }
    if (ev.code === 'KeyZ' && !ev.shiftKey) {
        ev.preventDefault();
        undoLast();
        return;
    }
    if (ev.code === 'KeyY') {
        ev.preventDefault();
        redoLast();
        return;
    }
    if (ev.code === 'KeyZ' && ev.shiftKey) {
        ev.preventDefault();
        redoLast();
    }
}
onMounted(() => {
    resizeCanvas();
    ro = new ResizeObserver(() => {
        resizeCanvas();
    });
    if (wrapRef.value) {
        ro.observe(wrapRef.value);
    }
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', onHistoryHotkeys);
});
onUnmounted(() => {
    ro?.disconnect();
    ro = null;
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('keydown', onHistoryHotkeys);
});
watch(() => props.canDraw, (v) => {
    if (!v) {
        activeStrokeId = null;
        localLast = null;
        localEraseStrokeStyle = null;
        clearShapeGesture();
        resetComposite();
    }
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
/** @type {__VLS_StyleScopedClasses['nadraw-board-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "wrapRef",
    ...{ class: "nadraw-board-wrap" },
    ...{ class: (__VLS_ctx.boardCursor) },
});
/** @type {__VLS_StyleScopedClasses['nadraw-board-wrap']} */ ;
if (__VLS_ctx.showToolbar) {
    const __VLS_0 = NadrawToolbar;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onUpdate:color': {} },
        ...{ 'onUpdate:brushSize': {} },
        ...{ 'onUpdate:tool': {} },
        ...{ 'onUndo': {} },
        ...{ 'onRedo': {} },
        ...{ 'onResetGame': {} },
        ...{ class: "nadraw-board-toolbar" },
        visible: (true),
        color: (__VLS_ctx.brushColor),
        brushSize: (__VLS_ctx.brushSize),
        tool: (__VLS_ctx.canvasTool),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onUpdate:color': {} },
        ...{ 'onUpdate:brushSize': {} },
        ...{ 'onUpdate:tool': {} },
        ...{ 'onUndo': {} },
        ...{ 'onRedo': {} },
        ...{ 'onResetGame': {} },
        ...{ class: "nadraw-board-toolbar" },
        visible: (true),
        color: (__VLS_ctx.brushColor),
        brushSize: (__VLS_ctx.brushSize),
        tool: (__VLS_ctx.canvasTool),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ 'update:color': {} },
        { 'onUpdate:color': (...[$event]) => {
                if (!(__VLS_ctx.showToolbar))
                    return;
                __VLS_ctx.brushColor = $event;
                // @ts-ignore
                [boardCursor, showToolbar, brushColor, brushColor, brushSize, canvasTool,];
            } });
    const __VLS_7 = ({ 'update:brushSize': {} },
        { 'onUpdate:brushSize': (...[$event]) => {
                if (!(__VLS_ctx.showToolbar))
                    return;
                __VLS_ctx.brushSize = $event;
                // @ts-ignore
                [brushSize,];
            } });
    const __VLS_8 = ({ 'update:tool': {} },
        { 'onUpdate:tool': (...[$event]) => {
                if (!(__VLS_ctx.showToolbar))
                    return;
                __VLS_ctx.canvasTool = $event;
                // @ts-ignore
                [canvasTool,];
            } });
    const __VLS_9 = ({ undo: {} },
        { onUndo: (__VLS_ctx.undoLast) });
    const __VLS_10 = ({ redo: {} },
        { onRedo: (__VLS_ctx.redoLast) });
    const __VLS_11 = ({ resetGame: {} },
        { onResetGame: (...[$event]) => {
                if (!(__VLS_ctx.showToolbar))
                    return;
                __VLS_ctx.emit('resetGame');
                // @ts-ignore
                [undoLast, redoLast, emit,];
            } });
    /** @type {__VLS_StyleScopedClasses['nadraw-board-toolbar']} */ ;
    var __VLS_3;
    var __VLS_4;
}
if (__VLS_ctx.$slots.hud) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadraw-board-hud" },
    });
    /** @type {__VLS_StyleScopedClasses['nadraw-board-hud']} */ ;
    var __VLS_12 = {};
}
__VLS_asFunctionalElement1(__VLS_intrinsics.canvas)({
    ...{ onPointerdown: (__VLS_ctx.onPointerDown) },
    ...{ onPointermove: (__VLS_ctx.onPointerMove) },
    ...{ onPointerup: (__VLS_ctx.onPointerUp) },
    ...{ onPointercancel: (__VLS_ctx.onPointerUp) },
    ref: "canvasRef",
    ...{ class: "nadraw-board-canvas" },
    'aria-label': (__VLS_ctx.t('nadrawShow.canvasTitle')),
});
/** @type {__VLS_StyleScopedClasses['nadraw-board-canvas']} */ ;
// @ts-ignore
var __VLS_13 = __VLS_12;
// @ts-ignore
[$slots, onPointerDown, onPointerMove, onPointerUp, onPointerUp, t,];
const __VLS_base = (await import('vue')).defineComponent({
    setup: () => __VLS_exposed,
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
