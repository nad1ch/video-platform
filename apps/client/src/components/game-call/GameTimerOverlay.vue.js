/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTimerOverlay — shared presentational countdown chip for game-call pages.
 *
 * Extracted from `MafiaOverlay.vue` in Phase 5a so production Mafia and the
 * reusable Game Template can share one timer surface. Production Mafia keeps
 * owning the timer protocol (start/stop go through `mafiaGameStore`); this
 * component renders the chip and emits `start(durationMs)` / `stop()` — the
 * mounting adapter decides what to do with them.
 *
 * Hard isolation: NO imports from any production Mafia store, composable,
 * signaling, or i18n keys. All locale strings arrive via the `labels` prop so
 * the same component can be mounted by:
 *   - `MafiaOverlay.vue`         → Mafia adapter (labels from `mafiaPage.*`)
 *   - future game pages          → game-specific adapter
 *
 * Visual scope preserved 1:1 from the original `MafiaOverlay` header chip:
 *   - stopwatch icon (left), monospaced m:ss text, optional host controls
 *   - host controls: N preset chips + Start/Stop pill (preset list injectable)
 *   - compact layout (`compact={true}` → 112px wide, no controls grid column)
 *   - `call-floating-surface` glass pill background (shared utility CSS)
 *   - 1 s tick runs only while the timer is running (no idle wakes)
 *
 * Class names are renamed `game-timer-overlay__*` (was `mafia-overlay__*`)
 * because the previous class set existed only inside one file. Renaming is
 * a no-op for any external selector (`grep` confirmed zero external refs).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { GAME_TIMER_PRESET_MS } from '@/utils/gameTimerPresets';
import { computeTimerIsActive, computeTimerIsTicking, computeTimerRemainingMs, formatTimerMmss, pickInitialTimerPreset, } from '@/utils/gameTimerCompute';
import mafiaTimerClock from '@/assets/game-call/timer-clock.svg';
const props = withDefaults(defineProps(), {
    isHost: false,
    streamView: false,
    compact: false,
    defaultDurationMs: undefined,
    paused: false,
    frozenRemainingMs: null,
    disabled: false,
    selectedDurationMs: null,
    // `withDefaults` hoists this factory above setup() — but importing a
    // module-scope `const` is fine; the compiler-sfc rule only forbids
    // referencing setup-scope locals. `GAME_TIMER_PRESET_MS` is a module
    // import, so this is safe.
    presetMsList: () => GAME_TIMER_PRESET_MS,
});
const emit = defineEmits();
const nowMs = ref(Date.now());
let tickInterval = null;
function startTickIfNeeded() {
    if (tickInterval != null)
        return;
    nowMs.value = Date.now();
    tickInterval = setInterval(() => {
        nowMs.value = Date.now();
    }, 1000);
}
function stopTick() {
    if (tickInterval != null) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
}
const remainingMs = computed(() => 
// Pause path (Eat First only — Mafia / Game Template default `paused`
// to `false` so this branch never fires). Display the frozen remaining
// time without consulting `nowMs`, so the tick interval can stay off.
computeTimerRemainingMs({
    timer: props.timer,
    nowMs: nowMs.value,
    paused: props.paused,
    frozenRemainingMs: props.frozenRemainingMs,
}));
/**
 * "The timer is active": running OR paused with a finite frozen-remaining
 * value. Drives the button label, title, ARIA, and `timerDisplay`
 * fallback. For Mafia / Game Template (where `paused === false` and
 * `frozenRemainingMs == null`), this is byte-equivalent to the previous
 * `isRunning = timer != null && remainingMs > 0`.
 */
const isActive = computed(() => computeTimerIsActive({
    timer: props.timer,
    remainingMs: remainingMs.value,
    paused: props.paused,
    frozenRemainingMs: props.frozenRemainingMs,
}));
/**
 * "The timer needs the 1 s tick": active AND not paused. Drives the
 * tick-interval start/stop watcher. Idle rooms (Mafia / Game Template /
 * Eat First) all stay quiet; paused EF rooms also stay quiet because
 * the display is frozen and does not need a tick.
 */
const isTicking = computed(() => computeTimerIsTicking({ isActive: isActive.value, paused: props.paused }));
const showHostControls = computed(() => props.isHost && !props.streamView);
/**
 * The 1 s tick previously ran for the whole life of `MafiaPage` even when no
 * timer was running, idly waking the JS loop every second. We start/stop it
 * strictly around the `isTicking` transition so an idle room — and a paused
 * EF room — is fully quiet.
 */
watch(isTicking, (ticking) => {
    if (ticking) {
        startTickIfNeeded();
    }
    else {
        stopTick();
    }
}, { immediate: true });
onBeforeUnmount(() => stopTick());
/**
 * Host-selected preset for the next Start press. Mirrors `selectedDurationMs`
 * in the original `MafiaOverlay`: defaults to `defaultDurationMs` if it is a
 * member of the preset list, otherwise the last preset. Persists across
 * Start/Stop cycles so the host doesn't need to re-pick it.
 */
const selectedDurationMs = ref(pickInitialTimerPreset(props.defaultDurationMs, props.presetMsList));
// Keep selectedDurationMs valid if the host swaps the preset list mid-life
// (rare; defensive).
watch(() => props.presetMsList, (list) => {
    if (!list.includes(selectedDurationMs.value)) {
        selectedDurationMs.value = pickInitialTimerPreset(props.defaultDurationMs, list);
    }
});
/**
 * The selected preset actually used for the idle display, the active-chip
 * highlight, and the next `start(durationMs)` emit. If the controlled
 * `props.selectedDurationMs` is provided AND is a member of the current
 * preset list, it wins; otherwise the chip falls back to its internal
 * local `selectedDurationMs`. The local ref is still updated on click
 * for instant host feedback before the controlled prop round-trips back.
 */
const effectiveSelectedDurationMs = computed(() => {
    const c = props.selectedDurationMs;
    if (typeof c === 'number' && Number.isFinite(c) && props.presetMsList.includes(c)) {
        return c;
    }
    return selectedDurationMs.value;
});
const timerDisplay = computed(() => {
    if (!isActive.value)
        return null;
    return formatTimerMmss(remainingMs.value);
});
const timerIdleDisplay = computed(() => formatTimerMmss(effectiveSelectedDurationMs.value));
const timerText = computed(() => timerDisplay.value ?? timerIdleDisplay.value);
const useCompactTimer = computed(() => props.compact || !showHostControls.value);
/**
 * Button text. Defaults to the literal `'Start'` / `'Stop'` Mafia and
 * Game Template have always shipped. Eat First passes
 * `labels.startButton` / `labels.stopButton` to keep its Ukrainian
 * "Стоп" instead of falling back to the English literal.
 */
const startButtonText = computed(() => props.labels.startButton ?? 'Start');
const stopButtonText = computed(() => props.labels.stopButton ?? 'Stop');
function onSelectDuration(ms) {
    if (!showHostControls.value)
        return;
    // Optimistic local update for instant host feedback; the upstream
    // controlled prop (if wired) overrides this once the WS round-trip
    // completes.
    selectedDurationMs.value = ms;
    emit('select-duration', ms);
}
function onToggleTimer() {
    if (!showHostControls.value)
        return;
    if (props.disabled)
        return;
    if (isActive.value) {
        emit('stop');
        return;
    }
    emit('start', effectiveSelectedDurationMs.value);
}
const __VLS_defaults = {
    isHost: false,
    streamView: false,
    compact: false,
    defaultDurationMs: undefined,
    paused: false,
    frozenRemainingMs: null,
    disabled: false,
    selectedDurationMs: null,
    // `withDefaults` hoists this factory above setup() — but importing a
    // module-scope `const` is fine; the compiler-sfc rule only forbids
    // referencing setup-scope locals. `GAME_TIMER_PRESET_MS` is a module
    // import, so this is safe.
    presetMsList: () => GAME_TIMER_PRESET_MS,
};
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "game-timer-overlay call-floating-surface" },
    ...{ class: ({ 'game-timer-overlay--compact': __VLS_ctx.useCompactTimer }) },
});
/** @type {__VLS_StyleScopedClasses['game-timer-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['call-floating-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['game-timer-overlay--compact']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "game-timer-overlay__main" },
    ...{ class: ({ 'game-timer-overlay__main--compact': __VLS_ctx.useCompactTimer }) },
});
/** @type {__VLS_StyleScopedClasses['game-timer-overlay__main']} */ ;
/** @type {__VLS_StyleScopedClasses['game-timer-overlay__main--compact']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "game-timer-overlay__stopwatch" },
    src: (__VLS_ctx.mafiaTimerClock),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['game-timer-overlay__stopwatch']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "game-timer-overlay__text game-timer-overlay__text--mono" },
    role: "timer",
    'aria-label': (__VLS_ctx.labels.countdown(__VLS_ctx.timerText)),
});
/** @type {__VLS_StyleScopedClasses['game-timer-overlay__text']} */ ;
/** @type {__VLS_StyleScopedClasses['game-timer-overlay__text--mono']} */ ;
(__VLS_ctx.timerText);
if (__VLS_ctx.showHostControls) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "game-timer-overlay__ctrls" },
        role: "group",
        'aria-label': (__VLS_ctx.labels.controlsAria),
    });
    /** @type {__VLS_StyleScopedClasses['game-timer-overlay__ctrls']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "game-timer-overlay__presets" },
        role: "group",
        'aria-label': (__VLS_ctx.labels.durationsAria),
    });
    /** @type {__VLS_StyleScopedClasses['game-timer-overlay__presets']} */ ;
    for (const [ms] of __VLS_vFor((__VLS_ctx.presetMsList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showHostControls))
                        return;
                    __VLS_ctx.onSelectDuration(ms);
                    // @ts-ignore
                    [useCompactTimer, useCompactTimer, mafiaTimerClock, labels, labels, labels, timerText, timerText, showHostControls, presetMsList, onSelectDuration,];
                } },
            key: (ms),
            type: "button",
            ...{ class: "sa-chip-btn game-timer-overlay__preset" },
            ...{ class: ({ 'game-timer-overlay__preset--active': __VLS_ctx.effectiveSelectedDurationMs === ms }) },
            title: (__VLS_ctx.labels.durationSec(ms / 1000)),
            'aria-label': (__VLS_ctx.labels.durationSec(ms / 1000)),
            'aria-pressed': (__VLS_ctx.effectiveSelectedDurationMs === ms),
        });
        /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['game-timer-overlay__preset']} */ ;
        /** @type {__VLS_StyleScopedClasses['game-timer-overlay__preset--active']} */ ;
        (ms / 1000);
        // @ts-ignore
        [labels, labels, effectiveSelectedDurationMs, effectiveSelectedDurationMs,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onToggleTimer) },
        type: "button",
        ...{ class: "sa-chip-btn game-timer-overlay__action game-timer-overlay__action--start" },
        title: (__VLS_ctx.isActive ? __VLS_ctx.labels.stop : __VLS_ctx.labels.start),
        'aria-label': (__VLS_ctx.isActive ? __VLS_ctx.labels.stop : __VLS_ctx.labels.start),
        disabled: (__VLS_ctx.disabled),
    });
    /** @type {__VLS_StyleScopedClasses['sa-chip-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['game-timer-overlay__action']} */ ;
    /** @type {__VLS_StyleScopedClasses['game-timer-overlay__action--start']} */ ;
    (__VLS_ctx.isActive ? __VLS_ctx.stopButtonText : __VLS_ctx.startButtonText);
}
// @ts-ignore
[labels, labels, labels, labels, onToggleTimer, isActive, isActive, isActive, disabled, stopButtonText, startButtonText,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
