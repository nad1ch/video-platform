/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, onUnmounted, ref } from 'vue';
// WebP is universally supported on every browser we target. We previously
// imported a PNG twin for every cloud (each ~200 KB) just so the
// `<picture>` fallback `<img>` had a value — those PNGs shipped to
// `dist/assets/` for no runtime benefit. The variable names below keep the
// short non-`Webp` suffix because the `<img :src>` and `<source srcset>`
// inside the `<picture>` now both resolve to the same WebP asset; the
// browser fetches it exactly once.
import cloudRoundedWideOne from '@/assets/landing/clouds/cloud-rounded-wide-1.webp';
import cloudRoundedWideOneWebp from '@/assets/landing/clouds/cloud-rounded-wide-1.webp';
import cloudRoundedWideTwo from '@/assets/landing/clouds/cloud-rounded-wide-2.webp';
import cloudRoundedWideTwoWebp from '@/assets/landing/clouds/cloud-rounded-wide-2.webp';
import cloudTransparentOne from '@/assets/landing/clouds/cloud-transparent-1.webp';
import cloudTransparentOneWebp from '@/assets/landing/clouds/cloud-transparent-1.webp';
import cloudTransparentTwo from '@/assets/landing/clouds/cloud-transparent-2.webp';
import cloudTransparentTwoWebp from '@/assets/landing/clouds/cloud-transparent-2.webp';
import cloudWideVolumetric from '@/assets/landing/clouds/cloud-wide-volumetric.webp';
import cloudWideVolumetric768Webp from '@/assets/landing/clouds/cloud-wide-volumetric-768.webp';
import cloudWideVolumetricWebp from '@/assets/landing/clouds/cloud-wide-volumetric.webp';
import { landingDesignPx as px } from '@/utils/landingDesignPx';
const props = withDefaults(defineProps(), { active: true, variant: 'landing' });
const cloudLayers = Object.freeze([
    Object.freeze({
        id: 'top-left-wide',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(-177),
            top: px(-33),
            width: px(1584),
            height: px(792),
            opacity: '0.41',
            transform: 'scaleX(-1)',
        }),
    }),
    Object.freeze({
        id: 'top-left-transparent',
        src: cloudTransparentOne,
        webpSrc: cloudTransparentOneWebp,
        className: 'landing-cloud-backdrop__cloud--transparent',
        width: 1024,
        height: 471,
        priority: 'secondary',
        style: Object.freeze({
            left: px(260),
            top: px(-472),
            width: px(928),
            height: px(427),
            opacity: '0.8',
            transform: 'rotate(0.21deg)',
        }),
    }),
    Object.freeze({
        id: 'top-right-wide',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(1747),
            top: px(-104),
            width: px(1584),
            height: px(792),
            opacity: '0.41',
        }),
    }),
    Object.freeze({
        id: 'top-right-transparent',
        src: cloudTransparentTwo,
        webpSrc: cloudTransparentTwoWebp,
        className: 'landing-cloud-backdrop__cloud--transparent',
        width: 1024,
        height: 471,
        priority: 'secondary',
        style: Object.freeze({
            left: px(2202),
            top: px(-771),
            width: px(898),
            height: px(412),
            opacity: '0.67',
            transform: 'rotate(173.32deg) scaleY(-1)',
        }),
    }),
    Object.freeze({
        id: 'upper-right-band',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(1191),
            top: px(355),
            width: px(1584),
            height: px(792),
            opacity: '0.41',
            transform: 'scaleX(-1)',
        }),
    }),
    Object.freeze({
        id: 'middle-band',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'critical',
        style: Object.freeze({
            left: px(356),
            top: px(500),
            width: px(1584),
            height: px(792),
            opacity: '0.41',
        }),
    }),
    Object.freeze({
        id: 'lower-left-band',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(-235),
            top: px(908),
            width: px(1709),
            height: px(855),
            opacity: '0.41',
            transform: 'rotate(179.76deg) scaleY(-1)',
        }),
    }),
    Object.freeze({
        id: 'lower-left-deep',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(-508),
            top: px(1277),
            width: px(1709),
            height: px(855),
            opacity: '0.41',
            transform: 'rotate(173.28deg) scaleY(-1)',
        }),
    }),
    Object.freeze({
        id: 'lower-right-rounded',
        src: cloudRoundedWideOne,
        webpSrc: cloudRoundedWideOneWebp,
        className: 'landing-cloud-backdrop__cloud--rounded',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(1500),
            top: px(929),
            width: px(1620),
            height: px(810),
            opacity: '0.27',
        }),
    }),
    Object.freeze({
        id: 'bottom-left-rounded',
        src: cloudRoundedWideTwo,
        webpSrc: cloudRoundedWideTwoWebp,
        className: 'landing-cloud-backdrop__cloud--rounded',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(-261),
            top: px(1980),
            width: px(1774),
            height: px(887),
            opacity: '0.25',
        }),
    }),
    Object.freeze({
        id: 'bottom-right-band',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--wide',
        width: 1024,
        height: 512,
        priority: 'secondary',
        style: Object.freeze({
            left: px(1184),
            top: px(2000),
            width: px(1584),
            height: px(792),
            opacity: '0.41',
            transform: 'scaleX(-1)',
        }),
    }),
]);
function appPx(value) {
    return `calc(var(--app-backdrop-u) * ${value})`;
}
function appBottomAnchoredTopPx(top, height) {
    return `max(${appPx(top)}, calc(100vh - ${appPx(height)}))`;
}
const appCloudLayers = Object.freeze([
    Object.freeze({
        id: 'app-left-rounded',
        src: cloudRoundedWideOne,
        webpSrc: cloudRoundedWideOneWebp,
        className: 'landing-cloud-backdrop__cloud--app-rounded',
        width: 1024,
        height: 512,
        priority: 'critical',
        style: Object.freeze({
            left: appPx(-697),
            top: appPx(-10),
            width: appPx(1384),
            height: appPx(692),
            opacity: '0.32',
        }),
    }),
    Object.freeze({
        id: 'app-bottom-wide',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--app-wide',
        width: 1024,
        height: 512,
        priority: 'critical',
        style: Object.freeze({
            left: appPx(133),
            top: appBottomAnchoredTopPx(536, 416),
            width: appPx(832),
            height: appPx(416),
            opacity: '0.48',
            transform: 'rotate(2.35deg)',
        }),
    }),
    Object.freeze({
        id: 'app-upper-right-wide',
        src: cloudWideVolumetric,
        webpSrc: cloudWideVolumetricWebp,
        className: 'landing-cloud-backdrop__cloud--app-wide',
        width: 1024,
        height: 512,
        priority: 'critical',
        style: Object.freeze({
            left: appPx(916),
            top: appPx(44),
            width: appPx(832),
            height: appPx(416),
            opacity: '0.48',
            transform: 'rotate(173.31deg) scaleY(-1)',
        }),
    }),
]);
const visibleCloudLayers = computed(() => (props.variant === 'app' ? appCloudLayers : cloudLayers));
const isAppBackdrop = computed(() => props.variant === 'app');
const starDotsRaw = [
    [2059, 142, 5, 0.36],
    [1862, 98, 5, 0.36],
    [1658, 157, 5, 0.84],
    [1583, 118, 4, 0.36],
    [1602, 179, 5, 0.36],
    [1083, 164, 4, 0.47],
    [1235, 186, 4, 0.47],
    [1413, 177, 4, 0.88],
    [1477, 104, 4, 0.47],
    [1634, 8, 5, 0.71],
    [1215, 99, 5, 0.47],
    [1188, 625, 5, 0.36],
    [1236, 680, 5, 0.36],
    [1210, 663, 5, 0.36],
    [1437, 640, 5, 0.36],
    [620, 652, 5, 0.47],
    [291, 620, 5, 0.47],
    [353, 711, 5, 0.47],
    [399, 860, 5, 0.47],
    [238, 811, 5, 1],
    [286, 914, 5, 0.47],
    [402, 1006, 5, 1],
    [516, 889, 5, 1],
    [533, 946, 5, 0.47],
    [55, 668, 5, 0.47],
    [121, 595, 5, 1],
    [60, 883, 5, 0.47],
    [159, 947, 5, 0.47],
    [2147, 1095, 5, 0.47],
    [2116, 1192, 5, 1],
    [1603, 1100, 5, 0.47],
    [1497, 1147, 5, 0.47],
    [1404, 1118, 5, 1],
    [1489, 1187, 5, 1],
    [1953, 1011, 5, 1],
    [1350, 1692, 5, 0.47],
    [1088, 1706, 5, 1],
    [1618, 1662, 5, 1],
    [1534, 1761, 5, 1],
    [1840, 1824, 5, 0.47],
    [1896, 1734, 5, 0.47],
    [1965, 1860, 5, 1],
    [1821, 1662, 5, 0.47],
    [2325, 2000, 5, 0.47],
    [2514, 1938, 5, 0.47],
    [2495, 2064, 5, 0.47],
    [2480, 2257, 5, 0.47],
    [1952, 2111, 5, 1],
    [1794, 2122, 5, 0.47],
    [1490, 2058, 5, 0.47],
    [1445, 2151, 5, 0.47],
    [1006, 2091, 5, 0.47],
    [1276, 2127, 5, 1],
    [548, 2120, 5, 0.47],
    [445, 2220, 5, 1],
    [211, 2070, 5, 1],
    [358, 2146, 5, 0.47],
    [445, 2337, 5, 0.47],
];
function appStarJitter(seed) {
    return (((seed * 9301 + 49297) % 233280) / 233280) * 2 - 1;
}
function buildAppStarDotsRaw() {
    const columns = 11;
    const rows = 6;
    return Object.freeze(Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const xJitter = appStarJitter(index * 11 + 3) * 0.34;
        const yJitter = appStarJitter(index * 17 + 7) * 0.3;
        const x = ((column + 0.5 + xJitter) / columns) * 100;
        const y = ((row + 0.5 + yJitter) / rows) * 100;
        const size = index % 3 === 0 ? 5 : 4;
        const alpha = 0.34 + ((index * 19) % 28) / 100;
        return [Number(x.toFixed(2)), Number(y.toFixed(2)), size, Number(alpha.toFixed(2))];
    }));
}
const appStarDotsRaw = buildAppStarDotsRaw();
function starDotsFromRaw(raw, toPx, idPrefix) {
    return Object.freeze(raw.map(([x, y, size, alpha], index) => {
        const duration = 2.8 + ((index * 37) % 240) / 100;
        const delay = -(((index * 611) % 9200) / 1000);
        return Object.freeze({
            id: `${idPrefix}-star-${index}`,
            phase: index % 5,
            style: Object.freeze({
                left: toPx(x),
                top: toPx(y),
                width: toPx(size),
                height: toPx(size),
                borderRadius: toPx(14),
                '--star-alpha': String(alpha),
                '--star-dur': `${duration.toFixed(2)}s`,
                '--star-delay': `${delay.toFixed(2)}s`,
            }),
        });
    }));
}
const starDots = starDotsFromRaw(starDotsRaw, px, 'landing');
const appBackdropViewport = ref({ width: 0, height: 0 });
function syncAppBackdropViewport() {
    if (typeof window === 'undefined') {
        return;
    }
    appBackdropViewport.value = {
        width: window.innerWidth,
        height: window.innerHeight,
    };
}
function appStarClearsClouds(xVw, yVh, size) {
    const { width, height } = appBackdropViewport.value;
    if (width <= 0 || height <= 0) {
        return true;
    }
    const unit = Math.min(width / 1440, height / 748);
    const x = (width * xVw) / 100;
    const y = (height * yVh) / 100;
    const pad = size * unit * 0.5 + Math.max(14, unit * 34);
    const bottomCloudTop = Math.max(unit * 536, height - unit * 416);
    const cloudZones = [
        { left: unit * -697, top: unit * -10, width: unit * 1384, height: unit * 692, cx: 0.24, cy: 0.3, rx: 0.3, ry: 0.34 },
        { left: unit * -697, top: unit * -10, width: unit * 1384, height: unit * 692, cx: 0.46, cy: 0.48, rx: 0.46, ry: 0.42 },
        { left: unit * -697, top: unit * -10, width: unit * 1384, height: unit * 692, cx: 0.66, cy: 0.7, rx: 0.26, ry: 0.22 },
        { left: unit * 133, top: bottomCloudTop, width: unit * 832, height: unit * 416, cx: 0.32, cy: 0.46, rx: 0.38, ry: 0.3 },
        { left: unit * 133, top: bottomCloudTop, width: unit * 832, height: unit * 416, cx: 0.56, cy: 0.66, rx: 0.48, ry: 0.36 },
        { left: unit * 916, top: unit * 44, width: unit * 832, height: unit * 416, cx: 0.36, cy: 0.5, rx: 0.44, ry: 0.42 },
        { left: unit * 916, top: unit * 44, width: unit * 832, height: unit * 416, cx: 0.64, cy: 0.34, rx: 0.34, ry: 0.3 },
    ];
    return cloudZones.every((zone) => {
        const centerX = zone.left + zone.width * zone.cx;
        const centerY = zone.top + zone.height * zone.cy;
        const radiusX = zone.width * zone.rx + pad;
        const radiusY = zone.height * zone.ry + pad;
        const normalizedX = (x - centerX) / radiusX;
        const normalizedY = (y - centerY) / radiusY;
        return normalizedX * normalizedX + normalizedY * normalizedY > 1;
    });
}
const appStarDots = computed(() => Object.freeze(appStarDotsRaw.flatMap(([x, y, size, alpha], index) => {
    if (!appStarClearsClouds(x, y, size)) {
        return [];
    }
    const duration = 2.8 + ((index * 37) % 240) / 100;
    const delay = -(((index * 611) % 9200) / 1000);
    return [
        Object.freeze({
            id: `app-star-${index}`,
            phase: index % 5,
            style: Object.freeze({
                left: `${x}vw`,
                top: `${y}vh`,
                width: appPx(size),
                height: appPx(size),
                borderRadius: appPx(14),
                '--star-alpha': String(alpha),
                '--star-dur': `${duration.toFixed(2)}s`,
                '--star-delay': `${delay.toFixed(2)}s`,
            }),
        }),
    ];
})));
const visibleStarDots = computed(() => (isAppBackdrop.value ? appStarDots.value : starDots));
const pageVisible = ref(true);
const secondaryCloudsReady = ref(false);
const loadedCloudIds = ref(new Set());
const backdropActive = computed(() => props.active && pageVisible.value);
function syncPageVisible() {
    pageVisible.value = typeof document === 'undefined' || document.visibilityState !== 'hidden';
}
function ensureMainCloudPreload() {
    if (typeof document === 'undefined') {
        return;
    }
    if (document.querySelector(`link[rel="preload"][href="${cloudWideVolumetricWebp}"]`)) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = cloudWideVolumetricWebp;
    link.type = 'image/webp';
    link.fetchPriority = 'high';
    document.head.append(link);
}
function shouldLoadCloudLayer(layer) {
    return layer.priority === 'critical' || secondaryCloudsReady.value;
}
ensureMainCloudPreload();
function webpSrcsetForCloudLayer(layer) {
    if (layer.id === 'middle-band') {
        return `${cloudWideVolumetric768Webp} 768w, ${cloudWideVolumetricWebp} 1024w`;
    }
    return layer.webpSrc;
}
function sizesForCloudLayer(layer) {
    if (layer.id === 'middle-band') {
        return '(max-width: 900px) 100vw, 824px';
    }
    return undefined;
}
function isCloudLayerLoaded(id) {
    return loadedCloudIds.value.has(id);
}
function markCloudLayerLoaded(id) {
    if (loadedCloudIds.value.has(id)) {
        return;
    }
    const next = new Set(loadedCloudIds.value);
    next.add(id);
    loadedCloudIds.value = next;
}
onMounted(() => {
    syncPageVisible();
    syncAppBackdropViewport();
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', syncPageVisible);
    }
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', syncAppBackdropViewport);
    }
    window.setTimeout(() => {
        secondaryCloudsReady.value = true;
    }, 350);
});
onUnmounted(() => {
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', syncPageVisible);
    }
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncAppBackdropViewport);
    }
});
const __VLS_defaults = { active: true, variant: 'landing' };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__gradient']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__gradient']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud--loaded']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud--wide']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud--transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud--rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__stars']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__stars']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star--ph1']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star--ph3']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star--ph1']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star--ph3']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--app']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__veil']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__veil']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-cloud-backdrop" },
    ...{ class: ([
            `landing-cloud-backdrop--${__VLS_ctx.variant}`,
            { 'landing-cloud-backdrop--inactive': !__VLS_ctx.backdropActive },
        ]) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop--inactive']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "landing-cloud-backdrop__gradient" },
});
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__gradient']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-cloud-backdrop__stars" },
});
/** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__stars']} */ ;
for (const [star] of __VLS_vFor((__VLS_ctx.visibleStarDots))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        key: (star.id),
        ...{ class: "landing-cloud-backdrop__star" },
        ...{ class: (`landing-cloud-backdrop__star--ph${star.phase}`) },
        ...{ style: (star.style) },
    });
    /** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__star']} */ ;
    // @ts-ignore
    [variant, backdropActive, visibleStarDots,];
}
for (const [layer] of __VLS_vFor((__VLS_ctx.visibleCloudLayers))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.picture, __VLS_intrinsics.picture)({
        key: (layer.id),
        ...{ class: "landing-cloud-backdrop__cloud" },
        ...{ class: ([
                layer.className,
                {
                    'landing-cloud-backdrop__cloud--loaded': __VLS_ctx.isCloudLayerLoaded(layer.id),
                    'landing-cloud-backdrop__cloud--visible': __VLS_ctx.shouldLoadCloudLayer(layer),
                },
            ]) },
        ...{ style: (layer.style) },
    });
    /** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud']} */ ;
    /** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud--loaded']} */ ;
    /** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__cloud--visible']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.source)({
        srcset: (__VLS_ctx.webpSrcsetForCloudLayer(layer)),
        sizes: (__VLS_ctx.sizesForCloudLayer(layer)),
        type: "image/webp",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ onLoad: (...[$event]) => {
                __VLS_ctx.markCloudLayerLoaded(layer.id);
                // @ts-ignore
                [visibleCloudLayers, isCloudLayerLoaded, shouldLoadCloudLayer, webpSrcsetForCloudLayer, sizesForCloudLayer, markCloudLayerLoaded,];
            } },
        src: (layer.src),
        alt: "",
        width: (layer.width),
        height: (layer.height),
        loading: (layer.priority === 'critical' ? 'eager' : 'lazy'),
        fetchpriority: (layer.priority === 'critical' ? 'high' : 'low'),
        draggable: "false",
        decoding: "async",
    });
    // @ts-ignore
    [];
}
if (!__VLS_ctx.isAppBackdrop) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "landing-cloud-backdrop__veil" },
    });
    /** @type {__VLS_StyleScopedClasses['landing-cloud-backdrop__veil']} */ ;
}
// @ts-ignore
[isAppBackdrop,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
