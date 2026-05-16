/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
const __VLS_props = defineProps();
const FORK_VARIANTS = [
    {
        main: 'M50 34 L48.2 42 L52 42 L47.5 52 L50.2 52 L46 64 L49 64 L44.5 76',
        branches: [
            'M47.5 52 L42 57 L40 60.5',
            'M52 42 L56.5 46.5 L58 51',
            'M50.2 52 L54.5 59 L52.5 64',
        ],
    },
    {
        main: 'M49 31 L51 39 L47.5 39 L50.5 49 L48 49 L51 61 L47.5 61 L50 75',
        branches: ['M50.5 49 L55 54 L54 58', 'M47.5 39 L43.5 43.5 L42 47', 'M48 49 L44.5 55 L45.5 59'],
    },
    {
        main: 'M51 33 L48.5 41 L52 41 L47 50 L50.5 50 L45.5 62 L49 62 L44 78',
        branches: ['M47 50 L41.5 54.5 L40 58', 'M52 41 L56.5 46 L58 50', 'M50.5 50 L55 57 L53 61'],
    },
    {
        main: 'M50 36 L49.5 44 L51.8 44 L48.5 54 L50.2 54 L47 66 L50 66 L46.5 80',
        branches: ['M48.5 54 L43 59 L41.5 63', 'M51.8 44 L56.2 49 L57.5 53', 'M50.2 54 L54.5 61 L52.5 65'],
    },
    {
        main: 'M49 35 L50.5 43 L47 43 L52 52 L49.3 52 L53.5 64 L50.3 64 L55 77',
        branches: ['M52 52 L57 57 L58.5 61', 'M47 43 L42.5 47.5 L41 51', 'M49.3 52 L45.5 58 L47 62'],
    },
    {
        main: 'M51 34 L47.8 42 L51.2 42 L46.5 51 L49.8 51 L44.8 63 L48.2 63 L43.2 76',
        branches: ['M46.5 51 L40.8 55.5 L39.2 59', 'M51.2 42 L56.2 47 L57.8 51', 'M49.8 51 L54.5 58 L52.8 62'],
    },
    {
        main: 'M50 32 L48 40 L51.5 40 L46.8 49 L50 49 L45.5 61 L48.5 61 L43.5 74',
        branches: ['M46.8 49 L41.2 53.5 L39.5 57', 'M51.5 40 L56 45 L57.5 49', 'M50 49 L54.5 56 L52.8 60'],
    },
    {
        main: 'M49 37 L51.2 45 L47.8 45 L52 54 L49 54 L54.2 66 L50.8 66 L56 79',
        branches: ['M52 54 L57.5 59 L59 63', 'M47.8 45 L43.5 49.5 L42 53', 'M49 54 L45 60 L46.5 64'],
    },
    {
        main: 'M51 35 L48.5 43 L51.8 43 L47.2 52 L50.5 52 L46 64 L49.5 64 L45 77',
        branches: ['M47.2 52 L41.5 56.5 L40 60', 'M51.8 43 L56.5 48 L58 52', 'M50.5 52 L55 59 L53 63'],
    },
    {
        main: 'M50 33 L49 41 L52.2 41 L48 50 L51 50 L47.5 62 L50 62 L46 76',
        branches: ['M48 50 L42.5 54.5 L41 58', 'M52.2 41 L57 46 L58.5 50', 'M51 50 L55.5 57 L53.5 61'],
    },
];
const BOLT_ANCHOR_X = 50;
const BOLT_ANCHOR_Y = 56;
function createRng(seed) {
    let a = seed >>> 0;
    return () => {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}
function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
    }
}
/**
 * Сітка 6×3 = 18 комірок. `slice` заповнює весь viewport по ширині/висоті (на відміну від `meet`).
 * На широких екранах slice обрізає верх/низ viewBox — тому Y лишаємо в смузі [yMin,yMax], щоб блискавки
 * не зникали; X тягнемо майже на всю ширину (низький горизонтальний відступ).
 */
function buildBolts() {
    const COLS = 6;
    const ROWS = 3;
    const CELLS = COLS * ROWS;
    const MARGIN_X = 1.1;
    const yMin = 22;
    const yMax = 78;
    const areaW = 100 - 2 * MARGIN_X;
    const areaH = yMax - yMin;
    const cellW = areaW / COLS;
    const cellH = areaH / ROWS;
    const rngPos = createRng(0xc0dec001);
    const rngAnim = createRng(0x71ee5e02);
    const cellOrder = Array.from({ length: CELLS }, (_, i) => i);
    shuffleInPlace(cellOrder, rngPos);
    const variantPool = [];
    for (let i = 0; i < 4; i++) {
        for (let v = 0; v < 10; v++) {
            variantPool.push(v);
        }
    }
    shuffleInPlace(variantPool, rngAnim);
    const variantForBolt = variantPool.slice(0, CELLS);
    const out = [];
    for (let k = 0; k < CELLS; k++) {
        const cell = cellOrder[k];
        const col = cell % COLS;
        const row = Math.floor(cell / COLS);
        const cellMidX = MARGIN_X + col * cellW + cellW * 0.5;
        const cellMidY = yMin + row * cellH + cellH * 0.5;
        const jitterMaxX = cellW * 0.18;
        const jitterMaxY = cellH * 0.2;
        const jx = (rngPos() - 0.5) * 2 * jitterMaxX;
        const jy = (rngPos() - 0.5) * 2 * jitterMaxY;
        const cx = clamp(cellMidX + jx, 1.5, 98.5);
        const cy = clamp(cellMidY + jy, yMin + 1.5, yMax - 1.5);
        const variantId = variantForBolt[k];
        const shape = FORK_VARIANTS[variantId];
        const rot = clamp(rngAnim() * 124 - 62, -56, 56);
        const scaleMul = 0.8 + rngAnim() * 0.3;
        const baseSc = 0.3 + rngAnim() * 0.08;
        const sc = baseSc * scaleMul;
        const dur = (2.35 + rngAnim() * 3.15) * 1.22;
        const delay = rngAnim() * 14.5;
        const branchLagBase = (0.038 + rngAnim() * 0.055) * 1.16;
        out.push({
            main: shape.main,
            branches: shape.branches,
            cx,
            cy,
            rot,
            sc,
            swMain: 1.38 + rngAnim() * 0.34,
            swBranch: 1.08 + rngAnim() * 0.3,
            swCore: 0.44 + rngAnim() * 0.16,
            dur,
            delay,
            branchLagBase,
            variantId,
        });
    }
    return out;
}
const bolts = buildBolts();
/**
 * Bolt artwork is authored around (50,56). Transform order: move anchor to origin → scale → rotate → translate to (cx,cy).
 * Older `translate(cx-50,…) rotate(…,50,56) scale(s)` scaled around (0,0) and shifted/clipped strokes to the left.
 */
function boltTransform(b) {
    return `translate(${b.cx} ${b.cy}) rotate(${b.rot}) scale(${b.sc}) translate(-${BOLT_ANCHOR_X} -${BOLT_ANCHOR_Y})`;
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--main-core']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--branch-core']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__svg']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--main']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--main-core']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--branch']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--branch-core']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "purple-lightning-backdrop" },
    ...{ class: ({ 'purple-lightning-backdrop--light': __VLS_ctx.light }) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop--light']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    ...{ class: "purple-lightning-backdrop__svg" },
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "xMidYMid slice",
});
/** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__svg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.defs, __VLS_intrinsics.defs)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.linearGradient, __VLS_intrinsics.linearGradient)({
    id: "purple-lightning-grad",
    x1: "0%",
    y1: "0%",
    x2: "0%",
    y2: "100%",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "0%",
    'stop-color': "rgba(252, 248, 255, 0.98)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "32%",
    'stop-color': "rgba(216, 189, 255, 0.95)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "68%",
    'stop-color': "rgba(147, 112, 219, 0.88)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
    offset: "100%",
    'stop-color': "rgba(91, 33, 182, 0.5)",
});
for (const [bolt, i] of __VLS_vFor((__VLS_ctx.bolts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.g, __VLS_intrinsics.g)({
        key: (`lb-${i}-v${bolt.variantId}`),
        transform: (__VLS_ctx.boltTransform(bolt)),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.g, __VLS_intrinsics.g)({
        ...{ class: "purple-lightning-backdrop__bolt" },
        ...{ style: ({
                '--bolt-dur': `${bolt.dur}s`,
                '--bolt-delay': `${bolt.delay}s`,
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__bolt']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        ...{ class: "purple-lightning-backdrop__path purple-lightning-backdrop__path--main" },
        d: (bolt.main),
        pathLength: "1",
        fill: "none",
        stroke: "url(#purple-lightning-grad)",
        'stroke-width': (bolt.swMain),
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'vector-effect': "non-scaling-stroke",
    });
    /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path']} */ ;
    /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--main']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        ...{ class: "purple-lightning-backdrop__path purple-lightning-backdrop__path--main-core" },
        d: (bolt.main),
        pathLength: "1",
        fill: "none",
        stroke: "rgba(255, 255, 255, 0.62)",
        'stroke-width': (bolt.swCore),
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'vector-effect': "non-scaling-stroke",
    });
    /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path']} */ ;
    /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--main-core']} */ ;
    for (const [br, j] of __VLS_vFor((bolt.branches))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            key: (j),
            ...{ class: "purple-lightning-backdrop__path purple-lightning-backdrop__path--branch" },
            ...{ style: ({ '--branch-lag': `${bolt.branchLagBase + j * 0.052}s` }) },
            d: (br),
            pathLength: "1",
            fill: "none",
            stroke: "url(#purple-lightning-grad)",
            'stroke-width': (bolt.swBranch),
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            'vector-effect': "non-scaling-stroke",
        });
        /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path']} */ ;
        /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--branch']} */ ;
        // @ts-ignore
        [light, bolts, boltTransform,];
    }
    for (const [br, j] of __VLS_vFor((bolt.branches))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            key: ('c' + j),
            ...{ class: "purple-lightning-backdrop__path purple-lightning-backdrop__path--branch-core" },
            ...{ style: ({ '--branch-lag': `${bolt.branchLagBase + j * 0.052}s` }) },
            d: (br),
            pathLength: "1",
            fill: "none",
            stroke: "rgba(255, 255, 255, 0.42)",
            'stroke-width': (bolt.swCore * 0.85),
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            'vector-effect': "non-scaling-stroke",
        });
        /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path']} */ ;
        /** @type {__VLS_StyleScopedClasses['purple-lightning-backdrop__path--branch-core']} */ ;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
