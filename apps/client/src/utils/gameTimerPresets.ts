/**
 * Shared game-timer preset durations (in milliseconds).
 *
 * Single source of truth for the `GameTimerOverlay` chip used by:
 *   - production Mafia (`MafiaOverlay.vue` → passes via prop)
 *   - the reusable Game Template page (`GameTemplatePage.vue`)
 *
 * Lives in `utils/` so both stores (Mafia) and components (game-call) can
 * import it without crossing layering boundaries (a store importing from a
 * component path would be an inversion).
 *
 * Adding 120 s in Phase 5b: the prior list `[30, 60, 90]` was duplicated
 * between `mafiaGame.ts` and the timer component's default. Both sources
 * now resolve to this single constant.
 */
export const GAME_TIMER_PRESET_MS = [30_000, 60_000, 90_000, 120_000] as const
