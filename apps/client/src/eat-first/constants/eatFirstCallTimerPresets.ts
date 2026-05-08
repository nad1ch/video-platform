/**
 * Eat First call speaking timer presets: same as Mafia (30 / 60 / 90 s) plus 120 s.
 * Keep in sync with server `eat:timer-start` duration bounds and CallPage host handler.
 */
export const EAT_FIRST_CALL_TIMER_PRESET_MS = [30_000, 60_000, 90_000, 120_000] as const

export type EatFirstCallTimerPresetMs = (typeof EAT_FIRST_CALL_TIMER_PRESET_MS)[number]
