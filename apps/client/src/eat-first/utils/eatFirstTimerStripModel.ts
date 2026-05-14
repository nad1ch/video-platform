/**
 * Pure resolver for the Eat First call timer strip model.
 *
 * Extracted from `EatFirstCallPage.vue`'s inline `eatFirstTimerStripModel`
 * computed (Block C). Behaviour is byte-equivalent to the previous inline
 * form; the only structural change is that this file is callable from
 * Vitest without mounting the Vue page.
 *
 * Precedence:
 *   1. Table-sync timer (from `eat:table-state-sync`) wins when:
 *      - non-null
 *      - `isRunning === true`
 *      - finite `startedAt` and `durationMs`
 *      - `durationMs >= 5000`
 *      Winning branch forces `timerPaused: false` and `frozenRemainingSec:
 *      null` because the wire shape carries no pause/frozen fields.
 *   2. Otherwise fall back to the snapshot fields verbatim.
 *
 * The helper has no Vue / store / protocol imports; all inputs are plain
 * primitives passed by the caller.
 */

export type EatFirstTableSyncTimer = {
  startedAt: number
  durationMs: number
  isRunning: boolean
} | null

export type EatFirstSnapshotTimerFields = {
  startedAt: string
  paused: boolean
  frozenRemainingSec: number | null
}

export type EatFirstTimerStripModel = {
  speakingTotalSec: number | null
  timerStartedAt: string
  timerPaused: boolean
  frozenRemainingSec: number | null
}

export function resolveEatFirstTimerStripModel(input: {
  tableSyncTimer: EatFirstTableSyncTimer
  snapshotSpeakingTotalSec: number | null
  snapshotTimerFields: EatFirstSnapshotTimerFields
}): EatFirstTimerStripModel {
  const t = input.tableSyncTimer
  if (
    t &&
    t.isRunning &&
    Number.isFinite(t.startedAt) &&
    Number.isFinite(t.durationMs) &&
    t.durationMs >= 5000
  ) {
    return {
      speakingTotalSec: Math.floor(t.durationMs / 1000),
      timerStartedAt: new Date(t.startedAt).toISOString(),
      timerPaused: false,
      frozenRemainingSec: null,
    }
  }
  return {
    speakingTotalSec: input.snapshotSpeakingTotalSec,
    timerStartedAt: input.snapshotTimerFields.startedAt,
    timerPaused: input.snapshotTimerFields.paused,
    frozenRemainingSec: input.snapshotTimerFields.frozenRemainingSec,
  }
}
