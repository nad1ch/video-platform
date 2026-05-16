/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { BRAND_LOGO_DARK_SVG, BRAND_LOGO_LIGHT_SVG } from '@/eat-first/constants/brand.js';
const __VLS_props = defineProps();
function kingBrandSrc(player) {
    return player === 'player1' ? BRAND_LOGO_DARK_SVG : BRAND_LOGO_LIGHT_SVG;
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
/** @type {__VLS_StyleScopedClasses['checkers-piece--flipped-visual']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--flipped-visual']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--light']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--dark']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--light']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--dark']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--light']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--king']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--king']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--light']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "checkers-piece" },
    ...{ class: ({
            'checkers-piece--light': __VLS_ctx.piece.player === 'player1',
            'checkers-piece--dark': __VLS_ctx.piece.player === 'player2',
            'checkers-piece--king': __VLS_ctx.piece.king,
            'checkers-piece--selected': __VLS_ctx.selected,
            'checkers-piece--flipped-visual': __VLS_ctx.flipped,
        }) },
    'aria-label': (__VLS_ctx.piece.king ? `${__VLS_ctx.piece.player} king` : __VLS_ctx.piece.player),
    role: "img",
});
/** @type {__VLS_StyleScopedClasses['checkers-piece']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--light']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--dark']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--king']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--flipped-visual']} */ ;
if (__VLS_ctx.piece.king) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-piece__king" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-piece__king']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "checkers-piece__brand-mark" },
        ...{ class: (__VLS_ctx.piece.player === 'player1' ? 'checkers-piece__brand-mark--on-light' : 'checkers-piece__brand-mark--on-dark') },
        src: (__VLS_ctx.kingBrandSrc(__VLS_ctx.piece.player)),
        alt: "",
        width: "40",
        height: "40",
        decoding: "async",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-piece__brand-mark']} */ ;
}
// @ts-ignore
[piece, piece, piece, piece, piece, piece, piece, piece, piece, selected, flipped, kingBrandSrc,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
