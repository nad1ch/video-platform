/**
 * Pure compute helpers extracted from `GameTimerOverlay.vue` for testability.
 *
 * - `computeTimerRemainingMs`: remaining time in ms; honours `paused` +
 *   finite `frozenRemainingMs` for Eat First, otherwise derives from
 *   `nowMs - startedAt`.
 * - `computeTimerIsActive`: whether the timer is "live" (running OR paused
 *   with a finite, positive `frozenRemainingMs`).
 * - `computeTimerIsTicking`: whether the chip should keep its 1 s tick
 *   interval running (`isActive && !paused`).
 * - `formatTimerMmss`: format ms as `m:ss`.
 * - `pickInitialTimerPreset`: choose the initial selected preset on mount,
 *   with a stable fallback to the last entry (or 90 s if list is empty).
 *
 * Behaviour matches the previous inline form byte-for-byte. Mafia / Game
 * Template adapters do not pass `paused` / `frozenRemainingMs`, so those
 * params default to values that preserve their existing behaviour.
 */
const FALLBACK_PRESET_MS = 90_000;
export function computeTimerRemainingMs(input) {
    const { timer, nowMs, paused, frozenRemainingMs } = input;
    if (paused &&
        typeof frozenRemainingMs === 'number' &&
        Number.isFinite(frozenRemainingMs)) {
        return Math.max(0, frozenRemainingMs);
    }
    if (timer == null)
        return 0;
    const elapsed = Math.max(0, nowMs - timer.startedAt);
    return Math.max(0, timer.durationMs - elapsed);
}
export function computeTimerIsActive(input) {
    const { timer, remainingMs, paused, frozenRemainingMs } = input;
    if (timer != null && remainingMs > 0)
        return true;
    if (paused &&
        typeof frozenRemainingMs === 'number' &&
        Number.isFinite(frozenRemainingMs) &&
        frozenRemainingMs > 0) {
        return true;
    }
    return false;
}
export function computeTimerIsTicking(input) {
    return input.isActive && !input.paused;
}
export function formatTimerMmss(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
export function pickInitialTimerPreset(defaultDurationMs, presets) {
    if (defaultDurationMs != null && presets.includes(defaultDurationMs)) {
        return defaultDurationMs;
    }
    return presets[presets.length - 1] ?? FALLBACK_PRESET_MS;
}
