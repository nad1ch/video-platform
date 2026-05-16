/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTemplateCallAdapter — Phase 3C.
 *
 * Mounted from `GameTemplatePage.vue` as a sibling of
 * `<GameTemplateCallPage>`. Renders the host-only "speaking order" hint
 * toast.
 *
 * Now consumes the generic GameRoom layer:
 *   - `useGameRoomViewMode` for `?mode=view` detection
 *   - `useGameTemplateGameStore` for host identity + interaction mode
 *   - `useGameRoomSpeakingHint` for the toast state machine
 *
 * CSS class names remain `.call-page__*` because `components/call/CallPage.css`
 * carries those selectors and is shared with the GameTemplate fork.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import { useGameRoomViewMode } from '@/composables/gameRoomStreamViewRoute';
import { useGameRoomSpeakingHint } from '@/composables/useGameRoomSpeakingHint';
const { t } = useI18n();
const route = useRoute();
const { isViewMode } = useGameRoomViewMode();
const gameStore = useGameTemplateGameStore();
const isGameRoomRoute = computed(() => route.name === 'game-template');
const { speakingOrderHintVisible } = useGameRoomSpeakingHint({
    isGameRoomRoute,
    viewUi: isViewMode,
    gameStore,
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "call-toast",
    appear: true,
}));
const __VLS_2 = __VLS_1({
    name: "call-toast",
    appear: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.speakingOrderHintVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__toast call-page__toast--join call-page__mafia-speak-hint" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__toast']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__toast--join']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__mafia-speak-hint']} */ ;
    (__VLS_ctx.t('gameRoom.speakingOrderFloatHint'));
}
// @ts-ignore
[speakingOrderHintVisible, t,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
