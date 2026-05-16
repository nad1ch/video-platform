/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTemplatePage — route component for `/app/game-template`.
 *
 * Runs on the generic GameRoom client layer end-to-end:
 *   - `<GameTemplateCallPage>` — fork of CallPage wired to
 *     `gameroom:*` WS, `useGameRoomHostSignaling`,
 *     `useGameRoomAudioMixSignaling`, `useGameRoomCallHostUi`, and
 *     `useGameTemplateGameStore` / `useGameTemplatePlayersStore`.
 *   - `<GameTemplateCallAdapter>` — speaking-hint state via
 *     `useGameRoomSpeakingHint`.
 *   - `<GameTemplateOverlay>` — timer chip via the generic store.
 *
 * Intentionally NOT mounted: a host panel. The Mafia host panel was a
 * role + night-action grid; the generic protocol has no roles or night
 * actions. Host actions (mute-all, reshuffle, swap-mode toggle) and the
 * speaking-queue HUD live in the CallPage fork's bottom-cluster.
 *
 * View-mode detection is `useGameRoomViewMode`, gated on
 * `route.name === 'game-template'`.
 *
 * Layout / signaling-warning banner / hover-elevation `:deep()` rule
 * are owned by `<GameRoomPageShell>`, shared with `/app/mafia`.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useCallSessionStore } from 'call-core';
import GameRoomPageShell from '@/components/game-room/GameRoomPageShell.vue';
import GameTemplateCallPage from '@/components/game-template/GameTemplateCallPage.vue';
import GameTemplateCallAdapter from '@/components/game-template/GameTemplateCallAdapter.vue';
import GameTemplateOverlay from '@/components/game-template/GameTemplateOverlay.vue';
import { useGameRoomViewMode } from '@/composables/gameRoomStreamViewRoute';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { isViewMode } = useGameRoomViewMode();
const gameStore = useGameTemplateGameStore();
const { isGameRoomHost } = storeToRefs(gameStore);
/**
 * Generic timer overlay is always visible — there's no old/new Mafia
 * mode equivalent to gate it on. View-mode tabs still see the chip.
 */
const showGameOverlay = computed(() => true);
const { user } = useAuth();
const callSession = useCallSessionStore();
const { inCall, signalingAuthUserId } = storeToRefs(callSession);
const showSignalingSessionWarning = computed(() => !isViewMode.value &&
    inCall.value &&
    user.value != null &&
    signalingAuthUserId.value === null &&
    !isGameRoomHost.value);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = GameRoomPageShell || GameRoomPageShell;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    routeClass: "game-template-page",
    isViewMode: (__VLS_ctx.isViewMode),
    signalingWarningVisible: (__VLS_ctx.showSignalingSessionWarning),
    signalingWarningText: (__VLS_ctx.t('mafiaPage.signalingSessionMissing')),
}));
const __VLS_2 = __VLS_1({
    routeClass: "game-template-page",
    isViewMode: (__VLS_ctx.isViewMode),
    signalingWarningVisible: (__VLS_ctx.showSignalingSessionWarning),
    signalingWarningText: (__VLS_ctx.t('mafiaPage.signalingSessionMissing')),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
{
    const { stage: __VLS_7 } = __VLS_3.slots;
    const __VLS_8 = GameTemplateCallPage;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        gameRoomStreamView: (__VLS_ctx.isViewMode),
    }));
    const __VLS_10 = __VLS_9({
        gameRoomStreamView: (__VLS_ctx.isViewMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    // @ts-ignore
    [isViewMode, isViewMode, showSignalingSessionWarning, t,];
}
{
    const { adapters: __VLS_13 } = __VLS_3.slots;
    const __VLS_14 = GameTemplateCallAdapter;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({}));
    const __VLS_16 = __VLS_15({}, ...__VLS_functionalComponentArgsRest(__VLS_15));
    // @ts-ignore
    [];
}
{
    const { overlays: __VLS_19 } = __VLS_3.slots;
    if (__VLS_ctx.showGameOverlay) {
        const __VLS_20 = GameTemplateOverlay;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            viewMode: (__VLS_ctx.isViewMode),
        }));
        const __VLS_22 = __VLS_21({
            viewMode: (__VLS_ctx.isViewMode),
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    // @ts-ignore
    [isViewMode, showGameOverlay,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
