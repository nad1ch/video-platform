/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * EatFirstCallTimerStrip — thin adapter around the shared
 * `<GameTimerOverlay>` countdown chip.
 *
 * Public mount shape from `EatFirstCallPage.vue` is preserved 1:1:
 *   - `view-mode`, `is-eat-first-host`, `speaking-total-sec`,
 *     `timer-started-at`, `timer-paused`, `frozen-remaining-sec`, `game-id`
 *
 * Same adapter pattern as `MafiaOverlay.vue` and `GameTemplateOverlay.vue`:
 * presentational chip lives in `components/game-call/GameTimerOverlay.vue`;
 * this file wires Eat First state into the shared props, supplies EF
 * labels, and translates the shared `start(durationMs)` / `stop` emits
 * into the existing `streamassist:eat-first:timer-action` window
 * CustomEvent that `CallPage.vue` listens for. The event detail shape
 * (`{ action: 'timer-start', durationSec }` / `{ action: 'timer-stop' }`)
 * is preserved verbatim so CallPage's WS-dispatch path is unchanged.
 *
 * Eat First-specific carry-over (preserved 1:1 from the inline form):
 *   - **Pause display**: when the server reports `timerPaused === true`
 *     and `frozenRemainingSec` is finite, the chip shows that frozen
 *     value and does NOT tick. Achieved by passing `paused` and
 *     `frozenRemainingMs` to `GameTimerOverlay`.
 *   - **`gameId`-required disabled gate**: the Start/Stop button is
 *     `:disabled` until a `gameId` is present in the route. Passed via
 *     the shared chip's new `disabled` prop.
 *   - **EF preset list (`30 / 60 / 90 / 120 s`)**: same four values the
 *     shared default already ships; passed explicitly for clarity.
 *   - **EF Ukrainian "Стоп" button text**: passed via the shared chip's
 *     optional `labels.stopButton` (Mafia / Game Template don't supply
 *     it and continue to render the historical literal `'Start'` /
 *     `'Stop'`).
 *
 * The absolute-position frame (`position: absolute; inset: 0;
 * z-index: 42; pointer-events: none;`) is preserved as a wrapping
 * `<div>` so the chip lands at the same DOM stacking context as the
 * `<MafiaOverlay>` / `<GameTemplateOverlay>` frames. The chip itself
 * is positioned at the top center by the shared `GameTimerOverlay`
 * styles.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import GameTimerOverlay from '@/components/game-call/GameTimerOverlay.vue';
import { EAT_FIRST_CALL_TIMER_PRESET_MS } from '@/eat-first/constants/eatFirstCallTimerPresets';
/**
 * Eat First's historical default Start duration (third preset = 90 s),
 * pinned explicitly so the shared chip's "last preset" fallback does
 * not silently shift Eat First's default to 120 s. Matches Mafia's
 * `MAFIA_DEFAULT_TIMER_MS`.
 */
const EAT_FIRST_DEFAULT_TIMER_MS = 90_000;
const EAT_FIRST_TIMER_ACTION_EVENT = 'streamassist:eat-first:timer-action';
const props = withDefaults(defineProps(), {
    timerStartedAt: '',
    gameId: '',
    selectedTimerDurationMs: null,
});
const { t } = useI18n();
/**
 * Map Eat First's wire-format timer state (`{ timerStartedAt: ISO,
 * speakingTotalSec, timerPaused, frozenRemainingSec }`) to the shared
 * chip's `GameTimerState` (`{ startedAt: epochMs, durationMs }`).
 *
 * A non-null value is returned whenever the host has started the timer
 * — including the paused branch. The shared chip's pause-aware logic
 * uses `paused` + `frozenRemainingMs` for display while keeping the
 * `timer` non-null so the Start/Stop button shows "Stop".
 */
const sharedTimer = computed(() => {
    const startedAtStr = props.timerStartedAt.trim();
    if (startedAtStr.length < 1)
        return null;
    const startedAt = Date.parse(startedAtStr);
    if (!Number.isFinite(startedAt))
        return null;
    const total = Math.max(1, Math.floor(Number(props.speakingTotalSec) || 0));
    return { startedAt, durationMs: total * 1000 };
});
const frozenRemainingMs = computed(() => {
    const sec = props.frozenRemainingSec;
    if (typeof sec !== 'number' || !Number.isFinite(sec))
        return null;
    return Math.max(0, Math.floor(sec * 1000));
});
const isHost = computed(() => props.isEatFirstHost);
const disabled = computed(() => typeof props.gameId !== 'string' || props.gameId.trim().length < 1);
const timerLabels = computed(() => ({
    countdown: (time) => t('eatFirstCall.timerCountdownAria', { time }),
    durationSec: (n) => t('eatFirstCall.timerPresetSecTitle', { n }),
    // Start/Stop button title + ARIA — distinct strings (`timerStartHint` /
    // `timerStopHint`) preserved verbatim from the previous inline strip.
    start: t('eatFirstCall.timerStartHint'),
    stop: t('eatFirstCall.timerStopHint'),
    controlsAria: t('eatFirstCall.timerControlsAria'),
    durationsAria: t('eatFirstCall.timerDurationsAria'),
    // The pill text — `timerStartLabel` / `timerStopLabel` — overrides the
    // shared chip's hard-coded `'Start'` / `'Stop'` literal so Eat First
    // keeps its Ukrainian "Стоп" button.
    startButton: t('eatFirstCall.timerStartLabel'),
    stopButton: t('eatFirstCall.timerStopLabel'),
}));
function dispatchEatFirstTimerAction(detail) {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(EAT_FIRST_TIMER_ACTION_EVENT, { detail }));
}
function onStart(durationMs) {
    if (!isHost.value || props.viewMode)
        return;
    if (disabled.value)
        return;
    const durationSec = Math.max(5, Math.floor(durationMs / 1000));
    dispatchEatFirstTimerAction({ action: 'timer-start', durationSec });
}
function onStop() {
    if (!isHost.value || props.viewMode)
        return;
    if (disabled.value)
        return;
    dispatchEatFirstTimerAction({ action: 'timer-stop' });
}
function onSelectDuration(durationMs) {
    if (!isHost.value || props.viewMode)
        return;
    if (disabled.value)
        return;
    const durationSec = Math.max(5, Math.floor(durationMs / 1000));
    dispatchEatFirstTimerAction({ action: 'timer-preset-select', durationSec });
}
const __VLS_defaults = {
    timerStartedAt: '',
    gameId: '',
    selectedTimerDurationMs: null,
};
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
    ...{ class: "eat-first-call-timer" },
    role: "presentation",
});
/** @type {__VLS_StyleScopedClasses['eat-first-call-timer']} */ ;
const __VLS_0 = GameTimerOverlay;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onStart': {} },
    ...{ 'onStop': {} },
    ...{ 'onSelectDuration': {} },
    timer: (__VLS_ctx.sharedTimer),
    isHost: (__VLS_ctx.isHost),
    streamView: (__VLS_ctx.viewMode),
    paused: (__VLS_ctx.timerPaused),
    frozenRemainingMs: (__VLS_ctx.frozenRemainingMs),
    disabled: (__VLS_ctx.disabled),
    presetMsList: (__VLS_ctx.EAT_FIRST_CALL_TIMER_PRESET_MS),
    defaultDurationMs: (__VLS_ctx.EAT_FIRST_DEFAULT_TIMER_MS),
    selectedDurationMs: (__VLS_ctx.selectedTimerDurationMs),
    labels: (__VLS_ctx.timerLabels),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onStart': {} },
    ...{ 'onStop': {} },
    ...{ 'onSelectDuration': {} },
    timer: (__VLS_ctx.sharedTimer),
    isHost: (__VLS_ctx.isHost),
    streamView: (__VLS_ctx.viewMode),
    paused: (__VLS_ctx.timerPaused),
    frozenRemainingMs: (__VLS_ctx.frozenRemainingMs),
    disabled: (__VLS_ctx.disabled),
    presetMsList: (__VLS_ctx.EAT_FIRST_CALL_TIMER_PRESET_MS),
    defaultDurationMs: (__VLS_ctx.EAT_FIRST_DEFAULT_TIMER_MS),
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
[sharedTimer, isHost, viewMode, timerPaused, frozenRemainingMs, disabled, EAT_FIRST_CALL_TIMER_PRESET_MS, EAT_FIRST_DEFAULT_TIMER_MS, selectedTimerDurationMs, timerLabels, onStart, onStop, onSelectDuration,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
