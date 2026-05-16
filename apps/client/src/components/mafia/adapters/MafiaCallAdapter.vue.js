/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * MafiaCallAdapter — Mafia-owned wrapper for Mafia call UI composition
 * (Phase 2B extraction from CallPage).
 *
 * Mounted from `MafiaPage.vue` as a sibling of `<CallPage>`, parallel to
 * `<MafiaHostPanel>` and `<MafiaOverlay>`. Owns Mafia UI blocks whose visual
 * position is anchored to the viewport via `position: fixed` and therefore
 * can leave CallPage's main DOM tree without changing layout.
 *
 * Phase 2B scope (this iteration):
 *   - host-only "speaking order" hint toast
 *     (`.call-page__mafia-speak-hint` — `position: fixed; top: 4.75rem; right: 1rem`).
 *
 * What this adapter does NOT own:
 *   - any media / WebRTC state (call-core owns the orchestrator; CallPage
 *     hosts the orchestrator wiring)
 *   - the `.call-page__mafia-view-bottom` strip — its v-if depends on the
 *     orchestrator-local `joining` ref, which is not exposed on the call
 *     session store; preserved in CallPage to avoid weakening the gate
 *     during the joining transition
 *   - the host action bar inside `.call-page__bottom-cluster__center` (DOM
 *     flow-positioned; moving out would change flex ordering)
 *   - the host speaking-queue bar inside `.call-page__bottom-cluster__center`
 *     (same DOM-flow constraint)
 *   - per-tile Mafia chrome (kept inside ParticipantTile until its v-memo
 *     coupling on `mafiaLifeState` is restructured — Phase 3 stop condition)
 *
 * CSS class names preserved 1:1 so the existing stylesheet rules apply
 * unchanged. The Transition wrapper, role, and class set match the original
 * CallPage template byte-for-byte.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute';
import { useMafiaSpeakingHint } from '@/composables/useMafiaSpeakingHint';
const { t } = useI18n();
const route = useRoute();
const { isViewMode } = useMafiaViewMode();
const mafiaGameStore = useMafiaGameStore();
/**
 * The adapter is mounted from `MafiaPage`, which only renders for the
 * `mafia` route — but read the route name here as well so the underlying
 * `useMafiaSpeakingHint` watcher uses an honest gate (matches the inline
 * gate in `useMafiaCallHostUi`'s previous speak-hint watcher).
 */
const isMafiaRoute = computed(() => route.name === 'mafia');
const { mafiaSpeakingOrderHintVisible } = useMafiaSpeakingHint({
    isMafiaRoute,
    mafiaViewUi: isViewMode,
    mafiaGameStore,
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
if (__VLS_ctx.mafiaSpeakingOrderHintVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__toast call-page__toast--join call-page__mafia-speak-hint" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__toast']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__toast--join']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__mafia-speak-hint']} */ ;
    (__VLS_ctx.t('mafiaPage.speakingOrderFloatHint'));
}
// @ts-ignore
[mafiaSpeakingOrderHintVisible, t,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
