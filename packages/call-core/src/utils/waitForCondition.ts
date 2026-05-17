/**
 * Polled async wait. Calls `predicate()` immediately, then every `intervalMs`
 * until it returns `true` or `timeoutMs` elapses.
 *
 * Audit M9: the previous default of 50 ms produced up to 20 callbacks /
 * second per concurrent waiter (CallEngine awaits `lastRoomState.value`
 * with this helper twice during publish). The new 100 ms default halves
 * tick rate for the same effective worst-case latency at human time
 * scales — the actual signals being awaited resolve within a single
 * tick in practice, so doubling the interval costs negligible wall-clock
 * time on the happy path. Call sites that need tighter polling can still
 * pass `intervalMs` explicitly.
 */
export function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 100,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = (): void => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Timeout waiting for condition'))
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}
