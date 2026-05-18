/**
 * Shared driver for the per-tile `<StreamVideo>` decode-stall watchdog.
 *
 * Before: each `<StreamVideo>` instance held its own `setInterval(tick, 2000)`.
 * With 8–12 remote tiles open, that's 8–12 separate timers waking the event
 * loop on the same cadence. Per-tile state (last sampled `currentTime`,
 * track id, fired-at, stall detected) is intentionally still owned by the
 * component; this driver only consolidates the wakeup.
 *
 * Subscribers register via {@link registerStallTick}; the driver attaches
 * a single `setInterval` on the first registration and clears it when the
 * last subscription is removed. Identical to the pattern in
 * `sharedDocumentVisibility.ts` (Audit Perf-C / M11).
 *
 * Iteration takes a snapshot so a subscriber that unregisters itself during
 * dispatch does not skip a sibling tick. Errors thrown by one subscriber
 * never swallow the others (per-tile watchdog must keep firing).
 */

export const STALL_SAMPLE_MS = 2000

type StallTickSubscriber = () => void

const subscribers = new Set<StallTickSubscriber>()
let timer: ReturnType<typeof setInterval> | null = null

function startIfNeeded(): void {
  if (timer !== null) return
  if (typeof window === 'undefined') return
  timer = setInterval(() => {
    const snapshot: StallTickSubscriber[] = []
    for (const cb of subscribers) snapshot.push(cb)
    for (const cb of snapshot) {
      try {
        cb()
      } catch {
        /* never let one subscriber's failure swallow the others */
      }
    }
  }, STALL_SAMPLE_MS)
}

function stopIfEmpty(): void {
  if (timer === null || subscribers.size > 0) return
  clearInterval(timer)
  timer = null
}

export function registerStallTick(cb: StallTickSubscriber): () => void {
  subscribers.add(cb)
  startIfNeeded()
  return (): void => {
    subscribers.delete(cb)
    stopIfEmpty()
  }
}
