/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { dailySpinReelProgress } from '@/utils/coinHub/coinHubBezierEasing';
import { endTranslateX, mapSlotMachineProgress } from '@/utils/coinHub/coinHubStripMath';
import { getSpinRarityForLabel } from '@/utils/coinHub/coinHubRarity';
import { playStripTickAtSpeed, playWinStop } from '@/utils/coinHub/coinHubAudioStub';
const props = withDefaults(defineProps(), {
    itemWidthPx: 72,
    durationMs: 2800,
    size: 'md',
    enableIdleAutoplay: false,
    idleBaseCells: () => ['5', '8', '12', '20', '25', '50', '100'],
    highlightLandWin: false,
    dailyAnticipationEasing: false,
});
const emit = defineEmits();
const viewportRef = ref(null);
const idleHoverPause = ref(false);
const translateX = ref(0);
const spinT = ref(0);
const rawProgressU = ref(0);
const isReelActive = ref(false);
const rowNudgeX = ref(0);
const viewportW = ref(360);
let raf = 0;
let idleRaf = 0;
let idleRunToken = 0;
const IDLE_PX_PER_SEC = 24;
let runToken = 0;
let lastTickIndex = -1;
let useReducedMotion = false;
if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    useReducedMotion = mq.matches;
}
const isPlaceholderCells = computed(() => props.cells.length === 1 && props.cells[0] === '—');
const loopedIdleCells = computed(() => {
    const b = props.idleBaseCells.length > 0 ? props.idleBaseCells : ['5', '8', '12', '20', '25', '50', '100'];
    return [...b, ...b, ...b, ...b, ...b];
});
const showIdleStrip = computed(() => props.enableIdleAutoplay && isPlaceholderCells.value && !isReelActive.value);
const displayCells = computed(() => (showIdleStrip.value ? loopedIdleCells.value : props.cells));
const activeStripLength = computed(() => displayCells.value.length);
const effectiveLandIndex = computed(() => (showIdleStrip.value ? -1 : props.landIndex));
const rowStyle = computed(() => ({
    transform: `translate3d(${translateX.value + rowNudgeX.value}px,0,0)`,
}));
function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}
function easeInCubic(t) {
    return t * t * t;
}
function cancelRaf() {
    if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
    }
}
function cancelIdleRaf() {
    if (idleRaf) {
        cancelAnimationFrame(idleRaf);
        idleRaf = 0;
    }
}
function tickSpeedFromU(u) {
    if (u < 0.2) {
        return 'fast';
    }
    if (u < 0.5) {
        return 'cruise';
    }
    if (u < 0.85) {
        return 'decel';
    }
    return 'nearStop';
}
function startIdleRaf() {
    cancelIdleRaf();
    if (useReducedMotion) {
        return;
    }
    if (!showIdleStrip.value) {
        return;
    }
    const base = props.idleBaseCells.length > 0
        ? props.idleBaseCells
        : ['5', '8', '12', '20', '25', '50', '100'];
    const periodPx = base.length * props.itemWidthPx;
    if (periodPx < 1) {
        return;
    }
    idleRunToken += 1;
    const my = idleRunToken;
    let last = performance.now();
    function frame(now) {
        if (my !== idleRunToken) {
            return;
        }
        if (!showIdleStrip.value || isReelActive.value) {
            cancelIdleRaf();
            return;
        }
        if (idleHoverPause.value) {
            last = now;
            idleRaf = requestAnimationFrame(frame);
            return;
        }
        const dt = now - last;
        last = now;
        let x = translateX.value - (IDLE_PX_PER_SEC * dt) / 1000;
        while (x <= -periodPx) {
            x += periodPx;
        }
        translateX.value = x;
        idleRaf = requestAnimationFrame(frame);
    }
    idleRaf = requestAnimationFrame(frame);
}
function syncViewportW() {
    const v = viewportRef.value;
    if (v) {
        const w = v.getBoundingClientRect().width;
        if (w >= 8) {
            viewportW.value = w;
        }
    }
}
function cellStyle(i) {
    const w = props.itemWidthPx;
    const tw = translateX.value;
    const vw = viewportW.value;
    const n = activeStripLength.value;
    if (n < 2 || w <= 0 || vw < 8) {
        return {
            transform: 'scale(1) translateZ(0)',
            opacity: '1',
            filter: 'none',
        };
    }
    if (!isReelActive.value) {
        return {
            transform: 'scale(1) translateZ(0)',
            opacity: '1',
            filter: 'none',
        };
    }
    const cellLeft = i * w + tw;
    const center = cellLeft + w * 0.5;
    const dist = Math.abs(center - vw * 0.5);
    const fall = w * 2.1;
    const f = Math.max(0, 1 - Math.min(1, dist / fall));
    const sc = 0.84 + 0.16 * f;
    const op = 0.35 + 0.65 * f;
    const bl = f > 0.92 ? 0 : (1 - f) * 0.32;
    return {
        transform: `scale(${sc}) translateZ(0)`,
        opacity: String(op),
        filter: bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : 'none',
    };
}
function currentCenterIndex(vw, x, w, n) {
    if (n <= 0) {
        return 0;
    }
    const j = Math.floor((vw * 0.5 - x) / w);
    return Math.max(0, Math.min(n - 1, j));
}
function progressEmitDone() {
    emit('progress', 1, {
        remainingMainMs: 0,
        rawU: 1,
        scrollPos: 1,
        preWin: false,
        heartbeat: false,
        inMainPhase: false,
    });
    emit('complete');
}
async function applyStaticCenter() {
    isReelActive.value = false;
    const v = viewportRef.value;
    if (!v || props.cells.length === 0) {
        return;
    }
    if (props.landIndex < 0 || props.landIndex >= props.cells.length) {
        return;
    }
    await nextTick();
    await new Promise((r) => requestAnimationFrame(() => r()));
    syncViewportW();
    let vw = viewportW.value;
    if (vw < 8) {
        await new Promise((r) => requestAnimationFrame(() => r()));
        syncViewportW();
        vw = viewportW.value;
    }
    if (vw < 8) {
        translateX.value = 0;
        return;
    }
    translateX.value = endTranslateX(vw, props.itemWidthPx, props.landIndex);
    spinT.value = 0;
    rawProgressU.value = 0;
    rowNudgeX.value = 0;
}
function runAnimation() {
    cancelRaf();
    const v = viewportRef.value;
    if (!v || props.cells.length < 2) {
        if (props.cells.length === 1) {
            void applyStaticCenter();
        }
        progressEmitDone();
        return;
    }
    if (props.landIndex < 0 || props.landIndex >= props.cells.length) {
        progressEmitDone();
        return;
    }
    const local = ++runToken;
    syncViewportW();
    let vw = viewportW.value;
    if (vw < 8) {
        requestAnimationFrame(() => {
            if (local !== runToken) {
                return;
            }
            syncViewportW();
            const vw2 = viewportW.value;
            if (vw2 < 8) {
                progressEmitDone();
                return;
            }
            startRollAfterMeasure(local, vw2);
        });
        return;
    }
    startRollAfterMeasure(local, vw);
}
function startRollAfterMeasure(local, vw) {
    if (local !== runToken) {
        return;
    }
    cancelIdleRaf();
    idleRunToken += 1;
    const w = props.itemWidthPx;
    const endBase = endTranslateX(vw, w, props.landIndex);
    const jitter = useReducedMotion ? 0 : (Math.random() - 0.5) * 4;
    const end = endBase + jitter;
    const start = 0;
    const baseDur = Math.max(2200, props.durationMs);
    const dur = useReducedMotion
        ? Math.min(700, baseDur)
        : baseDur + (Math.random() - 0.5) * 160;
    isReelActive.value = true;
    lastTickIndex = -1;
    translateX.value = start;
    spinT.value = 0;
    rawProgressU.value = 0;
    rowNudgeX.value = 0;
    const nCells = props.cells.length;
    const t0 = performance.now();
    let lastFrame = t0;
    let virtualElapsed = 0;
    function mainFrame(now) {
        if (local !== runToken) {
            return;
        }
        virtualElapsed += now - lastFrame;
        lastFrame = now;
        const rawU = Math.min(1, virtualElapsed / dur);
        /* One smooth bezier for daily spin — do not compose with piecewise time remap
           (kinks felt like a sudden stop, then a slow “second” motion). */
        const scrollPos = useReducedMotion
            ? rawU
            : props.dailyAnticipationEasing
                ? dailySpinReelProgress(rawU)
                : mapSlotMachineProgress(rawU);
        const baseX = start + (end - start) * scrollPos;
        const tensionDamp = scrollPos < 0.88 ? 1 : 0.35;
        const tension = useReducedMotion || props.dailyAnticipationEasing
            ? 0
            : Math.sin(now * 0.011) * 0.55 * (1 - scrollPos) * 0.45 * tensionDamp;
        rowNudgeX.value =
            useReducedMotion || props.dailyAnticipationEasing
                ? 0
                : Math.sin(now * 0.019 + (local % 5) * 0.1) * 0.3 * (1 - scrollPos);
        translateX.value = baseX + tension;
        spinT.value = scrollPos;
        rawProgressU.value = rawU;
        const remainingMainMs = dur * (1 - rawU);
        const preWin = rawU >= 0.5;
        const heartbeat = !useReducedMotion && rawU < 1 && remainingMainMs <= 500 && remainingMainMs >= 0;
        emit('progress', scrollPos, {
            remainingMainMs,
            rawU,
            scrollPos,
            preWin,
            heartbeat,
            inMainPhase: true,
        });
        if (!useReducedMotion) {
            const j = currentCenterIndex(vw, baseX, w, nCells);
            if (j !== lastTickIndex) {
                lastTickIndex = j;
                playStripTickAtSpeed(tickSpeedFromU(rawU), { preWin: rawU > 0.5 && rawU < 0.88 });
            }
        }
        if (rawU < 1) {
            raf = requestAnimationFrame(mainFrame);
        }
        else {
            translateX.value = end;
            spinT.value = 1;
            rawProgressU.value = 1;
            raf = 0;
            if (useReducedMotion) {
                isReelActive.value = false;
                playWinStop();
                progressEmitDone();
                return;
            }
            emit('progress', 1, {
                remainingMainMs: 0,
                rawU: 1,
                scrollPos: 1,
                preWin: true,
                heartbeat: false,
                inMainPhase: false,
            });
            runBounceOvershoot(local, end, vw, w, nCells);
        }
    }
    raf = requestAnimationFrame(mainFrame);
}
function runBounceOvershoot(local, settle, vw, w, nCells) {
    if (local !== runToken) {
        return;
    }
    const overshoot = useReducedMotion ? 3 : 8 + Math.random() * 7;
    const upMs = useReducedMotion ? 40 : 80;
    const downMs = useReducedMotion ? 50 : 120;
    const tB = performance.now();
    function bounceFrame(now) {
        if (local !== runToken) {
            return;
        }
        const e = now - tB;
        if (e < upMs) {
            const u = e / upMs;
            const k = easeOutQuad(u);
            translateX.value = settle + overshoot * k;
            rowNudgeX.value = 0;
        }
        else if (e < upMs + downMs) {
            const u = (e - upMs) / downMs;
            const k = 1 - easeInCubic(u);
            translateX.value = settle + overshoot * k;
        }
        else {
            translateX.value = settle;
            rowNudgeX.value = 0;
            isReelActive.value = false;
            spinT.value = 0;
            rawProgressU.value = 0;
            playWinStop();
            emit('progress', 1, {
                remainingMainMs: 0,
                rawU: 1,
                scrollPos: 1,
                preWin: false,
                heartbeat: false,
                inMainPhase: false,
            });
            emit('complete');
            raf = 0;
            return;
        }
        if (!useReducedMotion) {
            const j = currentCenterIndex(vw, translateX.value, w, nCells);
            if (e >= upMs && e < upMs + 28 && j !== lastTickIndex) {
                lastTickIndex = j;
                playStripTickAtSpeed('nearStop');
            }
        }
        raf = requestAnimationFrame(bounceFrame);
    }
    raf = requestAnimationFrame(bounceFrame);
}
watch(() => [props.cells, props.landIndex, props.itemWidthPx, props.enableIdleAutoplay], () => {
    runToken += 1;
    cancelRaf();
    if (props.enableIdleAutoplay && isPlaceholderCells.value) {
        isReelActive.value = false;
        translateX.value = 0;
        rowNudgeX.value = 0;
        spinT.value = 0;
        rawProgressU.value = 0;
        void nextTick(() => {
            startIdleRaf();
        });
        return;
    }
    if (props.cells.length <= 1) {
        void applyStaticCenter();
    }
    else {
        runAnimation();
    }
}, { deep: true, immediate: true });
function isSpinStripCell(c) {
    return typeof c === 'object' && c !== null && 'display' in c;
}
function stripCellDisplay(c) {
    return isSpinStripCell(c) ? c.display : c;
}
function stripCellRarity(c) {
    return isSpinStripCell(c) ? c.rarity : getSpinRarityForLabel(c);
}
function cellRarityClass(c) {
    return `coinhub-strip-roll__cell--rarity-${stripCellRarity(c)}`;
}
function cellExtraClass(c) {
    if (!isSpinStripCell(c)) {
        return '';
    }
    const out = [];
    if (c.kind === 'bonus' && c.bonusType) {
        out.push('coinhub-strip-roll__cell--bonus', `coinhub-strip-roll__cell--bonus-${c.bonusType}`);
    }
    if (c.nearMiss) {
        out.push('coinhub-strip-roll__cell--near-miss');
    }
    return out.join(' ');
}
function cellRowKey(c, i) {
    return isSpinStripCell(c) ? c.id : `strip-cell-${i}`;
}
function onWindowResize() {
    syncViewportW();
}
onMounted(() => {
    if (typeof window === 'undefined') {
        return;
    }
    syncViewportW();
    window.addEventListener('resize', onWindowResize, { passive: true });
});
onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onWindowResize);
    }
    runToken += 1;
    cancelRaf();
    cancelIdleRaf();
});
const markerGlow = computed(() => {
    if (!isReelActive.value) {
        return 0.7;
    }
    const u = rawProgressU.value;
    const micro = typeof performance !== 'undefined' ? 0.04 * Math.sin(performance.now() * 0.004) : 0;
    if (u > 0.72) {
        const k = (u - 0.72) / 0.28;
        return Math.min(1.15, 0.48 + 0.62 * k + micro);
    }
    if (u > 0.55) {
        const k = (u - 0.55) / 0.17;
        return 0.38 + 0.28 * k + micro;
    }
    return 0.35 + 0.25 * u + micro;
});
const markerStyle = computed(() => {
    const g = markerGlow.value;
    const rim = 0.55 + 0.38 * g;
    const a = 0.42 + 0.28 * g;
    return {
        boxShadow: `
      0 0 28px rgba(250, 204, 21, 0.88),
      0 0 52px rgba(250, 195, 70, 0.45),
      0 0 0 1px rgba(255, 220, 130, ${rim.toFixed(2)}),
      0 0 ${(6 + 5 * g).toFixed(1)}px 2px rgba(255, 190, 60, ${Math.min(0.72, a).toFixed(2)}),
      inset 0 1px 0 rgba(255, 255, 255, ${(0.28 + 0.2 * g).toFixed(2)})
    `
            .replace(/\s+/g, ' ')
            .trim(),
    };
});
const __VLS_defaults = {
    itemWidthPx: 72,
    durationMs: 2800,
    size: 'md',
    enableIdleAutoplay: false,
    idleBaseCells: () => ['5', '8', '12', '20', '25', '50', '100'],
    highlightLandWin: false,
    dailyAnticipationEasing: false,
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
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll--lg']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--rarity-legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll--lg']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__chip--gold']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--rarity-legendary']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--land']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--near-miss']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell--win-punch']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__marker--near-win']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__marker--settled-win']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__marker-cap--settled-win']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMouseenter: (...[$event]) => {
            __VLS_ctx.idleHoverPause = true;
            // @ts-ignore
            [idleHoverPause,];
        } },
    ...{ onMouseleave: (...[$event]) => {
            __VLS_ctx.idleHoverPause = false;
            // @ts-ignore
            [idleHoverPause,];
        } },
    ref: "viewportRef",
    ...{ class: ([
            'coinhub-strip-roll relative w-full overflow-hidden rounded-md border',
            __VLS_ctx.size === 'lg' ? 'coinhub-strip-roll--lg min-h-[6.75rem] sm:min-h-[7.5rem]' : 'min-h-[5.5rem]',
        ]) },
    ...{ style: ({
            '--ch-spin-t': String(__VLS_ctx.spinT),
            '--ch-raw-u': String(__VLS_ctx.rawProgressU),
            '--ch-marker-glow': String(__VLS_ctx.markerGlow),
        }) },
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-strip-roll__noise pointer-events-none absolute inset-0 z-[25] mix-blend-overlay opacity-[0.035]" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__noise']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[25]']} */ ;
/** @type {__VLS_StyleScopedClasses['mix-blend-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-[0.035]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-strip-roll__toplight pointer-events-none absolute inset-x-0 top-0 z-[1] h-[32%]" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__toplight']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-x-0']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
/** @type {__VLS_StyleScopedClasses['h-[32%]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-strip-roll__depth pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__depth']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-x-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[1]']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1/2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute inset-0 flex items-stretch" },
    role: "presentation",
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-stretch']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (['coinhub-strip-roll__row coinhub-strip-roll__reel-track flex h-full will-change-transform']) },
    ...{ style: (__VLS_ctx.rowStyle) },
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__row']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__reel-track']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['will-change-transform']} */ ;
for (const [c, i] of __VLS_vFor((__VLS_ctx.displayCells))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (__VLS_ctx.cellRowKey(c, i)),
        ...{ class: ([
                'coinhub-strip-roll__cell flex shrink-0 select-none items-center justify-center border-r border-slate-900/50',
                __VLS_ctx.cellRarityClass(c),
                __VLS_ctx.cellExtraClass(c),
                i === __VLS_ctx.effectiveLandIndex
                    ? 'coinhub-strip-roll__cell--land text-amber-100'
                    : 'text-slate-300/95',
                i === __VLS_ctx.effectiveLandIndex && __VLS_ctx.highlightLandWin && !__VLS_ctx.isReelActive && 'coinhub-strip-roll__cell--win-punch',
                __VLS_ctx.size === 'lg' && 'coinhub-strip-roll__cell--lg',
                __VLS_ctx.isReelActive && 'coinhub-strip-roll__cell--parallax',
            ]) },
        ...{ style: ({ width: `${__VLS_ctx.itemWidthPx}px`, ...__VLS_ctx.cellStyle(i) }) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-r']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-900/50']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ([
                'coinhub-strip-roll__chip inline-flex min-w-[2.5rem] justify-center rounded-md px-1.5 py-0.5 text-center font-extrabold tabular-nums',
                __VLS_ctx.size === 'lg' ? 'text-base sm:text-lg' : 'text-sm sm:text-base',
                i === __VLS_ctx.effectiveLandIndex && 'coinhub-strip-roll__chip--gold',
                __VLS_ctx.isSpinStripCell(c) && c.kind === 'bonus' && 'coinhub-strip-roll__chip--bonus',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-[2.5rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-extrabold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    (__VLS_ctx.stripCellDisplay(c));
    // @ts-ignore
    [size, size, size, spinT, rawProgressU, markerGlow, rowStyle, displayCells, cellRowKey, cellRarityClass, cellExtraClass, effectiveLandIndex, effectiveLandIndex, effectiveLandIndex, highlightLandWin, isReelActive, isReelActive, itemWidthPx, cellStyle, isSpinStripCell, stripCellDisplay,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-strip-roll__fog coinhub-strip-roll__fog--l pointer-events-none absolute inset-y-0 left-0 z-[12] w-[18%] max-w-[4.5rem]" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__fog']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__fog--l']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-y-0']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[12]']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[18%]']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[4.5rem]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "coinhub-strip-roll__fog coinhub-strip-roll__fog--r pointer-events-none absolute inset-y-0 right-0 z-[12] w-[18%] max-w-[4.5rem]" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__fog']} */ ;
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__fog--r']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-y-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[12]']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[18%]']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[4.5rem]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: ([
            'coinhub-strip-roll__marker pointer-events-none absolute top-0 z-[18] h-full w-[3px] sm:w-1',
            __VLS_ctx.isReelActive && 'coinhub-strip-roll__marker--live',
            __VLS_ctx.isReelActive && __VLS_ctx.rawProgressU > 0.5 && 'coinhub-strip-roll__marker--anticipate',
            __VLS_ctx.isReelActive && __VLS_ctx.rawProgressU > 0.85 && 'coinhub-strip-roll__marker--near-win',
            __VLS_ctx.highlightLandWin && !__VLS_ctx.isReelActive && 'coinhub-strip-roll__marker--settled-win',
        ]) },
    ...{ style: (__VLS_ctx.markerStyle) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__marker']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[18]']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[3px]']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: ([
            'coinhub-strip-roll__marker-cap pointer-events-none absolute top-0 z-[19] h-2 w-3 -translate-y-px sm:h-2.5 sm:w-3.5',
            __VLS_ctx.isReelActive && 'coinhub-strip-roll__marker-cap--live',
            __VLS_ctx.isReelActive && __VLS_ctx.rawProgressU > 0.5 && 'coinhub-strip-roll__marker-cap--jitter',
            __VLS_ctx.isReelActive && __VLS_ctx.rawProgressU > 0.85 && 'coinhub-strip-roll__marker-cap--near-win',
            __VLS_ctx.highlightLandWin && !__VLS_ctx.isReelActive && 'coinhub-strip-roll__marker-cap--settled-win',
        ]) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['coinhub-strip-roll__marker-cap']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[19]']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-px']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-3.5']} */ ;
// @ts-ignore
[rawProgressU, rawProgressU, rawProgressU, rawProgressU, highlightLandWin, highlightLandWin, isReelActive, isReelActive, isReelActive, isReelActive, isReelActive, isReelActive, isReelActive, isReelActive, markerStyle,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
