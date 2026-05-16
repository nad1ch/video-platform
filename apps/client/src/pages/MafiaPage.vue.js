/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useCallSessionStore } from 'call-core';
import CallPage from '@/components/call/CallPage.vue';
import GameRoomPageShell from '@/components/game-room/GameRoomPageShell.vue';
import MafiaCallAdapter from '@/components/mafia/adapters/MafiaCallAdapter.vue';
import MafiaHostPanel from '@/components/mafia/MafiaHostPanel.vue';
import MafiaOverlay from '@/components/mafia/MafiaOverlay.vue';
import { useMafiaViewMode } from '@/composables/mafiaStreamViewRoute';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { isViewMode } = useMafiaViewMode();
const mafiaGame = useMafiaGameStore();
const { isMafiaHost, oldMafiaMode } = storeToRefs(mafiaGame);
const showHostTools = computed(() => !isViewMode.value && isMafiaHost.value);
const showMafiaOverlay = computed(() => !oldMafiaMode.value || isMafiaHost.value);
const { user } = useAuth();
const callSession = useCallSessionStore();
const { inCall, signalingAuthUserId } = storeToRefs(callSession);
const showSignalingSessionWarning = computed(() => !isViewMode.value &&
    inCall.value &&
    user.value != null &&
    signalingAuthUserId.value === null &&
    !isMafiaHost.value);
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
    routeClass: "mafia-page",
    isViewMode: (__VLS_ctx.isViewMode),
    signalingWarningVisible: (__VLS_ctx.showSignalingSessionWarning),
    signalingWarningText: (__VLS_ctx.t('mafiaPage.signalingSessionMissing')),
}));
const __VLS_2 = __VLS_1({
    routeClass: "mafia-page",
    isViewMode: (__VLS_ctx.isViewMode),
    signalingWarningVisible: (__VLS_ctx.showSignalingSessionWarning),
    signalingWarningText: (__VLS_ctx.t('mafiaPage.signalingSessionMissing')),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
{
    const { stage: __VLS_7 } = __VLS_3.slots;
    const __VLS_8 = CallPage;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        mafiaStreamView: (__VLS_ctx.isViewMode),
    }));
    const __VLS_10 = __VLS_9({
        mafiaStreamView: (__VLS_ctx.isViewMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    // @ts-ignore
    [isViewMode, isViewMode, showSignalingSessionWarning, t,];
}
{
    const { adapters: __VLS_13 } = __VLS_3.slots;
    const __VLS_14 = MafiaCallAdapter;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({}));
    const __VLS_16 = __VLS_15({}, ...__VLS_functionalComponentArgsRest(__VLS_15));
    // @ts-ignore
    [];
}
{
    const { 'host-panel': __VLS_19 } = __VLS_3.slots;
    if (__VLS_ctx.showHostTools) {
        const __VLS_20 = MafiaHostPanel;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({}));
        const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    // @ts-ignore
    [showHostTools,];
}
{
    const { overlays: __VLS_25 } = __VLS_3.slots;
    if (__VLS_ctx.showMafiaOverlay) {
        const __VLS_26 = MafiaOverlay;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
            viewMode: (__VLS_ctx.isViewMode),
        }));
        const __VLS_28 = __VLS_27({
            viewMode: (__VLS_ctx.isViewMode),
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    }
    // @ts-ignore
    [isViewMode, showMafiaOverlay,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
