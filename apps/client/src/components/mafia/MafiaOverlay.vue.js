/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * MafiaOverlay — Mafia adapter around the shared `<GameTimerOverlay>` chip.
 *
 * Owns the Mafia-specific bits (Phase 5a extraction):
 *   - host identity gate (`isMafiaHost`)
 *   - "old Mafia mode" panel-visibility rule (`!oldMafiaMode || isMafiaHost`)
 *   - the timer store contract (`mafiaGame.startTimer(ms)` / `stopTimer()`)
 *   - `MAFIA_TIMER_PRESET_MS` preset list
 *   - i18n key resolution (`mafiaPage.timer*`)
 *   - the absolute-positioning wrapper that frames the chip on the call stage
 *
 * The chip itself (countdown text, preset chips, Start/Stop button, 1 s tick,
 * compact layout) is now owned by `GameTimerOverlay` in `components/game-call`.
 * That component is store-free and consumed only via this adapter today;
 * future games can mount it directly with their own labels + adapter.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { MAFIA_TIMER_PRESET_MS, useMafiaGameStore } from '@/stores/mafiaGame';
import GameTimerOverlay from '@/components/game-call/GameTimerOverlay.vue';
/**
 * Mafia's historical default Start duration (third preset = 90 s). Pinned
 * explicitly here so adding 120 s to the shared preset list does not silently
 * shift Mafia's default to the new largest value.
 */
const MAFIA_DEFAULT_TIMER_MS = 90_000;
const props = withDefaults(defineProps(), { streamView: false, viewMode: undefined });
const isViewLayout = computed(() => Boolean(props.viewMode ?? props.streamView));
const { t } = useI18n();
const mafiaGame = useMafiaGameStore();
const { isMafiaHost, mafiaTimer, mafiaSelectedTimerDurationMs, oldMafiaMode } = storeToRefs(mafiaGame);
const showTimerPanel = computed(() => !oldMafiaMode.value || isMafiaHost.value);
const showTimerControls = computed(() => isMafiaHost.value && !isViewLayout.value);
const useCompactTimer = computed(() => !showTimerControls.value);
/**
 * Map the Mafia store's `MafiaTimerState` (`{ startedAt, duration, isRunning }`)
 * to the shared component's `GameTimerState` (`{ startedAt, durationMs }`).
 * The shared component derives `isRunning` from the remaining ms — pass `null`
 * whenever the Mafia store says it isn't running, so the shared component
 * never inspects the store-specific `isRunning` flag.
 */
const sharedTimer = computed(() => {
    const t = mafiaTimer.value;
    if (t == null || !t.isRunning)
        return null;
    return { startedAt: t.startedAt, durationMs: t.duration };
});
const timerLabels = computed(() => ({
    countdown: (time) => t('mafiaPage.timerCountdown', { time }),
    durationSec: (n) => t('mafiaPage.timerSecTitle', { n }),
    start: t('mafiaPage.timerStartButton'),
    stop: t('mafiaPage.timerStopButton'),
    controlsAria: t('mafiaPage.timerControlsAria'),
    durationsAria: t('mafiaPage.timerDurationsAria'),
}));
function onStart(durationMs) {
    mafiaGame.startTimer(durationMs);
}
function onStop() {
    mafiaGame.stopTimer();
}
function onSelectDuration(durationMs) {
    mafiaGame.selectTimerPreset(durationMs);
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
    ...{ class: "mafia-overlay" },
    role: "presentation",
});
/** @type {__VLS_StyleScopedClasses['mafia-overlay']} */ ;
if (__VLS_ctx.showTimerPanel) {
    const __VLS_0 = GameTimerOverlay;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onStart': {} },
        ...{ 'onStop': {} },
        ...{ 'onSelectDuration': {} },
        timer: (__VLS_ctx.sharedTimer),
        isHost: (__VLS_ctx.isMafiaHost),
        streamView: (__VLS_ctx.isViewLayout),
        compact: (__VLS_ctx.useCompactTimer),
        presetMsList: (__VLS_ctx.MAFIA_TIMER_PRESET_MS),
        defaultDurationMs: (__VLS_ctx.MAFIA_DEFAULT_TIMER_MS),
        selectedDurationMs: (__VLS_ctx.mafiaSelectedTimerDurationMs),
        labels: (__VLS_ctx.timerLabels),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onStart': {} },
        ...{ 'onStop': {} },
        ...{ 'onSelectDuration': {} },
        timer: (__VLS_ctx.sharedTimer),
        isHost: (__VLS_ctx.isMafiaHost),
        streamView: (__VLS_ctx.isViewLayout),
        compact: (__VLS_ctx.useCompactTimer),
        presetMsList: (__VLS_ctx.MAFIA_TIMER_PRESET_MS),
        defaultDurationMs: (__VLS_ctx.MAFIA_DEFAULT_TIMER_MS),
        selectedDurationMs: (__VLS_ctx.mafiaSelectedTimerDurationMs),
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
}
// @ts-ignore
[showTimerPanel, sharedTimer, isMafiaHost, isViewLayout, useCompactTimer, MAFIA_TIMER_PRESET_MS, MAFIA_DEFAULT_TIMER_MS, mafiaSelectedTimerDurationMs, timerLabels, onStart, onStop, onSelectDuration,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
