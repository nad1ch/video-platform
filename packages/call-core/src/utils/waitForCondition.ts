
export function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 50,
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
