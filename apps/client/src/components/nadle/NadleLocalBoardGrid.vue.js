/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
export default {};
const __VLS_export = await (async () => {
    const __VLS_props = defineProps();
    const emit = defineEmits();
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
    /** @type {__VLS_StyleScopedClasses['nadle-page__cell--tile']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__cell--tile']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__cell']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__cell--tile']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__cell--tile']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onPointerdown: (...[$event]) => {
                __VLS_ctx.emit('focusInput');
                // @ts-ignore
                [emit,];
            } },
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.emit('focusInput');
                // @ts-ignore
                [emit,];
            } },
        ...{ class: "nadle-page__guess-board" },
        ...{ style: ({ '--nadle-len': String(__VLS_ctx.wordLength) }) },
        role: "grid",
        'aria-rowcount': (__VLS_ctx.maxAttempts),
        'aria-colcount': (__VLS_ctx.wordLength),
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__guess-board']} */ ;
    for (const [row, ri] of __VLS_vFor((__VLS_ctx.rows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`local-${__VLS_ctx.roundId}-r-${ri}`),
            ...{ class: "nadle-page__row nadle-page__row--tile" },
            role: "row",
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__row']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadle-page__row--tile']} */ ;
        for (const [cell] of __VLS_vFor((row))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (`tile-${__VLS_ctx.roundId}-${cell.rowIndex}-${cell.colIndex}`),
                ...{ class: "nadle-page__cell nadle-page__cell--tile" },
                ...{ class: ({
                        'nadle-page__cell--empty': !cell.locked && !cell.letter,
                        'nadle-page__cell--draft': !cell.locked && Boolean(cell.letter),
                    }) },
                ...{ style: ({ '--nadle-reveal-delay': `${cell.colIndex * 86}ms` }) },
                'data-f': (cell.feedback ?? undefined),
                role: "gridcell",
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__cell']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__cell--tile']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__cell--empty']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__cell--draft']} */ ;
            (cell.letter);
            // @ts-ignore
            [wordLength, wordLength, maxAttempts, rows, roundId, roundId,];
        }
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    return (await import('vue')).defineComponent({
        __typeEmits: {},
        __typeProps: {},
    });
})();
