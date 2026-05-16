/**
 * Pure resolver for the Eat First call timer strip model.
 *
 * Mirrors the Mafia / Game Template live-host-timer pattern (single live
 * WS source of truth) while preserving Eat First's distinct paused/frozen
 * pathway, which has no corresponding WS event today and is therefore
 * carried by the HTTP snapshot.
 *
 * Source-of-truth precedence:
 *
 *   1. **WS running** — `eat:table-state-sync.timer` carries
 *      `{ startedAt, duration, isRunning: true }` and is the canonical
 *      "is running" signal. When the table-sync's timer field is non-null
 *      and `isRunning === true` with a valid `startedAt`/`durationMs`,
 *      this resolver returns the running model directly. Snapshot fields
 *      are ignored — the WS is authoritative for live state.
 *
 *   2. **HTTP-confirmed pause** — pause/resume is set through the Eat
 *      First HTTP merge route (`PATCH /games/:id/room`), not through a
 *      dedicated WS event, so the snapshot is the only source of paused
 *      state. When the WS table-sync's timer is null AND the snapshot
 *      explicitly reports `paused: true`, the resolver surfaces the
 *      paused state from the snapshot (timerStartedAt + frozenRemainingSec).
 *
 *   3. **Stopped** — everything else (WS says null AND snapshot is not
 *      paused). This includes the critical "Stop just happened" window:
 *      the WS table-sync arrives with `timer: null` instantly, while
 *      the HTTP snapshot may still hold a non-empty `timerStartedAt`
 *      from the previous run for up to one poll interval. That stale
 *      "running" data is treated as stopped here — a stopped timer
 *      cannot be resurrected by a lagging snapshot. This is the
 *      essential difference from the previous "fall back to snapshot
 *      verbatim" behaviour and the root-cause fix for the cross-screen
 *      Stop desync.
 *
 * The helper has no Vue / store / protocol imports; all inputs are plain
 * primitives passed by the caller.
 */
/**
 * Canonical "stopped" model. Used whenever the WS table-sync indicates
 * no live timer AND the HTTP snapshot does not indicate an explicit
 * paused state. Distinct from the snapshot-pass-through in that
 * `timerStartedAt` is always empty here — that empty string is the
 * adapter's contract for "render the idle preset chip, not a counting
 * timer".
 */
const EAT_FIRST_TIMER_STOPPED_MODEL = {
    speakingTotalSec: null,
    timerStartedAt: '',
    timerPaused: false,
    frozenRemainingSec: null,
};
export function resolveEatFirstTimerStripModel(input) {
    const t = input.tableSyncTimer;
    if (t &&
        t.isRunning &&
        Number.isFinite(t.startedAt) &&
        Number.isFinite(t.durationMs) &&
        t.durationMs >= 5000) {
        return {
            speakingTotalSec: Math.floor(t.durationMs / 1000),
            timerStartedAt: new Date(t.startedAt).toISOString(),
            timerPaused: false,
            frozenRemainingSec: null,
        };
    }
    // WS says no running timer. The only legitimate snapshot fallback is
    // a server-confirmed paused state — running fields in the snapshot
    // are treated as stale and ignored so a stopped timer cannot be
    // resurrected between the WS clear and the next HTTP poll.
    if (input.snapshotTimerFields.paused === true) {
        return {
            speakingTotalSec: input.snapshotSpeakingTotalSec,
            timerStartedAt: input.snapshotTimerFields.startedAt,
            timerPaused: true,
            frozenRemainingSec: input.snapshotTimerFields.frozenRemainingSec,
        };
    }
    return EAT_FIRST_TIMER_STOPPED_MODEL;
}
