/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTemplateOverlay — Phase 3C.
 *
 * Switched off the Mafia stack. Now reads timer + host identity from the
 * generic `useGameTemplateGameStore`. The old/new Mafia mode gate
 * (`!oldMafiaMode || isMafiaHost`) is REMOVED — the generic protocol has
 * no mode toggle, so the timer chip is always visible (the chip itself is
 * a no-op when no timer is running and the user is not a host with
 * controls).
 *
 * Chip rendering remains the shared `<GameTimerOverlay>` from
 * `components/game-call/`; the change here is the data source and the
 * gate.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { GAME_ROOM_TIMER_PRESET_MS, useGameTemplateGameStore, } from '@/stores/gameTemplateGame';
import GameTimerOverlay from '@/components/game-call/GameTimerOverlay.vue';
const GAME_TEMPLATE_DEFAULT_TIMER_MS = 90_000;
const props = withDefaults(defineProps(), { streamView: false, viewMode: undefined });
const isViewLayout = computed(() => Boolean(props.viewMode ?? props.streamView));
const { t } = useI18n();
const gameStore = useGameTemplateGameStore();
const { isGameRoomHost, timer, selectedTimerDurationMs } = storeToRefs(gameStore);
const showTimerControls = computed(() => isGameRoomHost.value && !isViewLayout.value);
const useCompactTimer = computed(() => !showTimerControls.value);
const sharedTimer = computed(() => {
    const t = timer.value;
    if (t == null || !t.isRunning)
        return null;
    return { startedAt: t.startedAt, durationMs: t.duration };
});
const timerLabels = computed(() => ({
    countdown: (time) => t('gameRoom.timerCountdown', { time }),
    durationSec: (n) => t('gameRoom.timerSecTitle', { n }),
    start: t('gameRoom.timerStartButton'),
    stop: t('gameRoom.timerStopButton'),
    controlsAria: t('gameRoom.timerControlsAria'),
    durationsAria: t('gameRoom.timerDurationsAria'),
}));
function onStart(durationMs) {
    gameStore.startTimer(durationMs);
}
function onStop() {
    gameStore.stopTimer();
}
function onSelectDuration(durationMs) {
    gameStore.selectTimerPreset(durationMs);
}
const __VLS_defaults = { streamView: false, viewMode: undefined };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "game-template-overlay" },
    role: "presentation",
});
/** @type {__VLS_StyleScopedClasses['game-template-overlay']} */ ;
const __VLS_0 = GameTimerOverlay;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onStart': {} },
    ...{ 'onStop': {} },
    ...{ 'onSelectDuration': {} },
    timer: (__VLS_ctx.sharedTimer),
    isHost: (__VLS_ctx.isGameRoomHost),
    streamView: (__VLS_ctx.isViewLayout),
    compact: (__VLS_ctx.useCompactTimer),
    presetMsList: (__VLS_ctx.GAME_ROOM_TIMER_PRESET_MS),
    defaultDurationMs: (__VLS_ctx.GAME_TEMPLATE_DEFAULT_TIMER_MS),
    selectedDurationMs: (__VLS_ctx.selectedTimerDurationMs),
    labels: (__VLS_ctx.timerLabels),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onStart': {} },
    ...{ 'onStop': {} },
    ...{ 'onSelectDuration': {} },
    timer: (__VLS_ctx.sharedTimer),
    isHost: (__VLS_ctx.isGameRoomHost),
    streamView: (__VLS_ctx.isViewLayout),
    compact: (__VLS_ctx.useCompactTimer),
    presetMsList: (__VLS_ctx.GAME_ROOM_TIMER_PRESET_MS),
    defaultDurationMs: (__VLS_ctx.GAME_TEMPLATE_DEFAULT_TIMER_MS),
    selectedDurationMs: (__VLS_ctx.selectedTimerDurationMs),
    labels: (__VLS_ctx.timerLabels),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ start: {} },
    { onStart: (__VLS_ctx.onStart) });
const __VLS_7 = ({ stop: {} },
    { onStop: (__VLS_ctx.onStop) });
const __VLS_8 = ({ selectDuration: {} },
    { onSelectDuration: (__VLS_ctx.onSelectDuration) });
var __VLS_3;
var __VLS_4;
// @ts-ignore
[sharedTimer, isGameRoomHost, isViewLayout, useCompactTimer, GAME_ROOM_TIMER_PRESET_MS, GAME_TEMPLATE_DEFAULT_TIMER_MS, selectedTimerDurationMs, timerLabels, onStart, onStop, onSelectDuration,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
