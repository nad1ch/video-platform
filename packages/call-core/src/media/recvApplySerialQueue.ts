/**
 * Serializes recv-side async work (producer-sync, new-producer apply, public syncExistingProducers).
 * Execution control only — policy stays in `recoveryCoordinator` + `useRemoteMedia`.
 *
 * The tail promise always settles (errors are logged) so the chain never deadlocks.
 */
export type RecvApplySerialQueue = {
  /** Queue one unit of work after any prior recv apply completes. */
  enqueue: (run: () => Promise<void>) => Promise<void>
  /** Reset the chain (e.g. `stopRemoteMedia`) so the next session starts fresh. */
  reset: () => void
}

export function createRecvApplySerialQueue(logError: (err: unknown) => void = console.error): RecvApplySerialQueue {
  let tail: Promise<void> = Promise.resolve()

  function enqueue(run: () => Promise<void>): Promise<void> {
    const job = tail.then(() => run())
    tail = job.catch((err) => {
      logError(err)
    })
    return job
  }

  function reset(): void {
    tail = Promise.resolve()
  }

  return { enqueue, reset }
}
