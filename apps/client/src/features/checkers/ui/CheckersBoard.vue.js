/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, watch } from 'vue';
import { isSameCheckersPosition } from '../core/checkersEngine';
import CheckersCell from './CheckersCell.vue';
import CheckersPieceView from './CheckersPiece.vue';
const FILE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const RANK_LABELS_DESC = [8, 7, 6, 5, 4, 3, 2, 1];
const props = defineProps();
const emit = defineEmits();
const previousBoard = ref(null);
const pieceAnimation = ref(null);
let animationTimer = null;
const cells = computed(() => props.board.flatMap((rowCells, row) => rowCells.map((piece, col) => {
    const pos = { row, col };
    return {
        key: `${row}-${col}`,
        row,
        col,
        piece,
        selected: props.selected ? isSameCheckersPosition(pos, props.selected) : false,
        validMove: props.validDestinations.some((destination) => isSameCheckersPosition(pos, destination)),
        captureMove: props.captureDestinations.some((destination) => isSameCheckersPosition(pos, destination)),
        winningMove: Boolean(props.winningMove &&
            (isSameCheckersPosition(pos, props.winningMove.from) || isSameCheckersPosition(pos, props.winningMove.to))),
        hidePiece: pieceAnimation.value ? isSameCheckersPosition(pos, pieceAnimation.value.to) : false,
    };
})));
const animationStyle = computed(() => {
    const anim = pieceAnimation.value;
    if (!anim)
        return {};
    return {
        '--from-x': `${anim.from.col * 100}%`,
        '--from-y': `${anim.from.row * 100}%`,
        '--to-x': `${anim.to.col * 100}%`,
        '--to-y': `${anim.to.row * 100}%`,
    };
});
function samePiece(a, b) {
    return Boolean(a && b && a.player === b.player && a.king === b.king);
}
function detectMove(prev, next) {
    const removed = [];
    const added = [];
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const before = prev[row]?.[col] ?? null;
            const after = next[row]?.[col] ?? null;
            if (before && !after)
                removed.push({ pos: { row, col }, piece: before });
            if (!before && after)
                added.push({ pos: { row, col }, piece: after });
        }
    }
    const target = added[0];
    if (!target)
        return null;
    const source = removed.find((entry) => samePiece(entry.piece, target.piece)) ?? removed[0];
    return source ? { piece: target.piece, from: source.pos, to: target.pos } : null;
}
watch(() => props.board, (next) => {
    const prev = previousBoard.value;
    if (prev) {
        const move = detectMove(prev, next);
        if (move) {
            pieceAnimation.value = move;
            if (animationTimer)
                clearTimeout(animationTimer);
            animationTimer = setTimeout(() => {
                pieceAnimation.value = null;
                animationTimer = null;
            }, 220);
        }
    }
    previousBoard.value = next.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}, { immediate: true });
function emitCellClick(pos) {
    emit('cellClick', pos);
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
/** @type {__VLS_StyleScopedClasses['checkers-board-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-rotatable--flipped']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-face']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-glow-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-frame']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-board-frame" },
});
/** @type {__VLS_StyleScopedClasses['checkers-board-frame']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-board-rotatable" },
    ...{ class: ({ 'checkers-board-rotatable--flipped': __VLS_ctx.flipped }) },
});
/** @type {__VLS_StyleScopedClasses['checkers-board-rotatable']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-board-rotatable--flipped']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "checkers-coordinate-corner checkers-coordinate-corner--tl" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner--tl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-coordinates-top" },
    role: "presentation",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinates-top']} */ ;
for (const [file] of __VLS_vFor((__VLS_ctx.FILE_LABELS))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (`tf-${file}`),
        ...{ class: "checkers-coordinates-top__slot" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinates-top__slot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-coordinate-face" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinate-face']} */ ;
    (file);
    // @ts-ignore
    [flipped, FILE_LABELS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "checkers-coordinate-corner checkers-coordinate-corner--tr" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner--tr']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-coordinates-left" },
    role: "presentation",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinates-left']} */ ;
for (const [rank] of __VLS_vFor((__VLS_ctx.RANK_LABELS_DESC))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (`lr-${rank}`),
        ...{ class: "checkers-coordinates-left__slot" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinates-left__slot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-coordinate-face" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinate-face']} */ ;
    (rank);
    // @ts-ignore
    [RANK_LABELS_DESC,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-board-glow-wrap" },
});
/** @type {__VLS_StyleScopedClasses['checkers-board-glow-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-board" },
    role: "grid",
    'aria-label': "Checkers board",
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['checkers-board']} */ ;
for (const [cell] of __VLS_vFor((__VLS_ctx.cells))) {
    const __VLS_0 = CheckersCell;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onSelect': {} },
        key: (cell.key),
        row: (cell.row),
        col: (cell.col),
        piece: (cell.piece),
        selected: (cell.selected),
        validMove: (cell.validMove),
        captureMove: (cell.captureMove),
        winningMove: (cell.winningMove),
        hidePiece: (cell.hidePiece),
        flipped: (__VLS_ctx.flipped),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onSelect': {} },
        key: (cell.key),
        row: (cell.row),
        col: (cell.col),
        piece: (cell.piece),
        selected: (cell.selected),
        validMove: (cell.validMove),
        captureMove: (cell.captureMove),
        winningMove: (cell.winningMove),
        hidePiece: (cell.hidePiece),
        flipped: (__VLS_ctx.flipped),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ select: {} },
        { onSelect: (__VLS_ctx.emitCellClick) });
    var __VLS_3;
    var __VLS_4;
    // @ts-ignore
    [flipped, cells, emitCellClick,];
}
if (__VLS_ctx.pieceAnimation) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-board__moving-piece" },
        ...{ style: (__VLS_ctx.animationStyle) },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-board__moving-piece']} */ ;
    const __VLS_7 = CheckersPieceView;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        piece: (__VLS_ctx.pieceAnimation.piece),
        flipped: (__VLS_ctx.flipped),
    }));
    const __VLS_9 = __VLS_8({
        piece: (__VLS_ctx.pieceAnimation.piece),
        flipped: (__VLS_ctx.flipped),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-coordinates-right" },
    role: "presentation",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinates-right']} */ ;
for (const [rank] of __VLS_vFor((__VLS_ctx.RANK_LABELS_DESC))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (`rr-${rank}`),
        ...{ class: "checkers-coordinates-right__slot" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinates-right__slot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-coordinate-face" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinate-face']} */ ;
    (rank);
    // @ts-ignore
    [flipped, RANK_LABELS_DESC, pieceAnimation, pieceAnimation, animationStyle,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "checkers-coordinate-corner checkers-coordinate-corner--bl" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner--bl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "checkers-coordinates-bottom" },
    role: "presentation",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinates-bottom']} */ ;
for (const [file] of __VLS_vFor((__VLS_ctx.FILE_LABELS))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (`bf-${file}`),
        ...{ class: "checkers-coordinates-bottom__slot" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinates-bottom__slot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "checkers-coordinate-face" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-coordinate-face']} */ ;
    (file);
    // @ts-ignore
    [FILE_LABELS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "checkers-coordinate-corner checkers-coordinate-corner--br" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-coordinate-corner--br']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
