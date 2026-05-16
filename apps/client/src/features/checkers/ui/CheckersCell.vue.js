/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import CheckersPiece from './CheckersPiece.vue';
const props = defineProps();
const emit = defineEmits();
function selectCell() {
    emit('select', { row: props.row, col: props.col });
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
/** @type {__VLS_StyleScopedClasses['checkers-cell--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--valid']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--capture']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--valid']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--capture']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--capture']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell__winning-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-piece']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.selectCell) },
    ...{ class: "checkers-cell" },
    ...{ class: ({
            'checkers-cell--dark': (props.row + props.col) % 2 === 1,
            'checkers-cell--light': (props.row + props.col) % 2 === 0,
            'checkers-cell--selected': props.selected,
            'checkers-cell--valid': props.validMove,
            'checkers-cell--capture': props.captureMove,
            'checkers-cell--winning': props.winningMove,
        }) },
    type: "button",
    role: "gridcell",
    'aria-label': (`Row ${props.row + 1}, column ${props.col + 1}`),
    'aria-selected': (props.selected),
});
/** @type {__VLS_StyleScopedClasses['checkers-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--dark']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--light']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--selected']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--valid']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--capture']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-cell--winning']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "checkers-cell__grain" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-cell__grain']} */ ;
if (props.winningMove) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "checkers-cell__winning-overlay" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-cell__winning-overlay']} */ ;
}
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    enterActiveClass: "transition-all duration-150 ease-out",
    enterFromClass: "opacity-0 scale-75",
    enterToClass: "opacity-100 scale-100",
    leaveActiveClass: "transition-all duration-150 ease-in",
    leaveFromClass: "opacity-100 scale-100",
    leaveToClass: "opacity-0 scale-75",
}));
const __VLS_2 = __VLS_1({
    enterActiveClass: "transition-all duration-150 ease-out",
    enterFromClass: "opacity-0 scale-75",
    enterToClass: "opacity-100 scale-100",
    leaveActiveClass: "transition-all duration-150 ease-in",
    leaveFromClass: "opacity-100 scale-100",
    leaveToClass: "opacity-0 scale-75",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (props.piece && !props.hidePiece) {
    const __VLS_6 = CheckersPiece;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        piece: (props.piece),
        selected: (props.selected),
        flipped: (props.flipped),
    }));
    const __VLS_8 = __VLS_7({
        piece: (props.piece),
        selected: (props.selected),
        flipped: (props.flipped),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
}
// @ts-ignore
[selectCell,];
var __VLS_3;
if (!props.piece && props.validMove) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "checkers-cell__move-dot" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-cell__move-dot']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
