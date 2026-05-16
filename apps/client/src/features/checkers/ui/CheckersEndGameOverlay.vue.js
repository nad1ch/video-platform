/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps();
const emit = defineEmits();
const { locale } = useI18n();
const isUk = computed(() => String(locale.value || '').toLowerCase().startsWith('uk'));
const ui = computed(() => {
    const uk = isUk.value;
    return {
        youWin: uk ? 'Ти переміг' : 'You win',
        youLose: uk ? 'Ти програв' : 'You lose',
        wins: (name) => (uk ? `${name} переміг` : `${name} wins`),
        rematch: uk ? 'Реванш' : 'Rematch',
        playBot: uk ? 'Проти бота' : 'Play vs bot',
        playFriend: uk ? 'З другом' : 'Play with friend',
        playLocal: uk ? 'На одному пристрої' : 'Same device',
    };
});
const title = computed(() => {
    const copy = ui.value;
    if (props.winner === 'you')
        return copy.youWin;
    if (props.winner === 'opponent')
        return copy.youLose;
    if (props.winner === 'player1')
        return copy.wins(props.playerLabels.player1);
    if (props.winner === 'player2')
        return copy.wins(props.playerLabels.player2);
    return '';
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
/** @type {__VLS_StyleScopedClasses['checkers-end-game-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-end-game-button']} */ ;
/** @type {__VLS_StyleScopedClasses['checkers-end-game-confetti']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "checkers-end-game",
}));
const __VLS_2 = __VLS_1({
    name: "checkers-end-game",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.isVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-end-game-overlay" },
        role: "dialog",
        'aria-modal': "true",
        'aria-live': "polite",
        'aria-labelledby': "checkers-end-game-title",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-end-game-confetti" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-confetti']} */ ;
    for (const [n] of __VLS_vFor((22))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            key: (n),
            ...{ style: ({ '--i': n, '--x': `${(n * 37) % 100}%` }) },
        });
        // @ts-ignore
        [isVisible,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-end-game-card" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        id: "checkers-end-game-title",
        ...{ class: "checkers-end-game-title" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-title']} */ ;
    (__VLS_ctx.title);
    var __VLS_6 = {};
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "checkers-end-game-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isVisible))
                    return;
                __VLS_ctx.emit('rematch');
                // @ts-ignore
                [title, emit,];
            } },
        type: "button",
        ...{ class: "checkers-end-game-button checkers-end-game-button--primary" },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button--primary']} */ ;
    (__VLS_ctx.ui.rematch);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isVisible))
                    return;
                __VLS_ctx.emit('playBot');
                // @ts-ignore
                [emit, ui,];
            } },
        type: "button",
        ...{ class: "checkers-end-game-button" },
        ...{ class: ({ 'checkers-end-game-button--active': __VLS_ctx.mode === 'bot' }) },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button--active']} */ ;
    (__VLS_ctx.ui.playBot);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isVisible))
                    return;
                __VLS_ctx.emit('playFriend');
                // @ts-ignore
                [emit, ui, mode,];
            } },
        type: "button",
        ...{ class: "checkers-end-game-button" },
        ...{ class: ({ 'checkers-end-game-button--active': __VLS_ctx.mode === 'friend' }) },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button--active']} */ ;
    (__VLS_ctx.ui.playFriend);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isVisible))
                    return;
                __VLS_ctx.emit('playLocal');
                // @ts-ignore
                [emit, ui, mode,];
            } },
        type: "button",
        ...{ class: "checkers-end-game-button" },
        ...{ class: ({ 'checkers-end-game-button--active': __VLS_ctx.mode === 'local' }) },
    });
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkers-end-game-button--active']} */ ;
    (__VLS_ctx.ui.playLocal);
}
// @ts-ignore
[ui, mode,];
var __VLS_3;
// @ts-ignore
var __VLS_7 = __VLS_6;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
