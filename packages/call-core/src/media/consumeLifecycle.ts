/**
 * # Receive-side consume lifecycle (documentation + future types)
 *
 * Coordination state is owned by `consumeLifecycleManager.ts` (called from `useRemoteMedia`). This
 * module does **not** participate in execution — it records invariants for refactors.
 *
 * ## Data structures (current)
 *
 * | Structure | Role |
 * |-----------|------|
 * | `consumedProducerIds` | `Set<string>` — logical “slot reserved” for `producerId` after the async boundary (see below). |
 * | `inflightConsumeByProducerId` | `Map<string, Promise<void>>` — coalesces concurrent `consumeProducer` calls for the same id. |
 * | `consumingProducerIds` | `Set<string>` — marks work in progress (observability / coordination). |
 * | `consumersByProducerId` | `Map<string, mediasoup Consumer>` — live recv consumers after success. |
 *
 * ## Call graph
 *
 * 1. **`consumeProducer`** (outer)
 *    - Early exit if `consumedProducerIds.has(producerId)`.
 *    - If another consume is in flight for the same id, `await` that promise and return.
 *    - Otherwise spawn an async task that calls `runConsumeProducer`.
 *    - Task `catch`: `consumedProducerIds.delete(producerId)` so a retry can proceed.
 *    - Task `finally`: drop from `consumingProducerIds`; outer `finally` clears `inflightConsumeByProducerId`.
 *
 * 2. **`runConsumeProducer`** (inner)
 *    - **Fast path:** `if (consumedProducerIds.has(producerId)) return` — skip work if already done.
 *    - **`await ensureRecvTransport(...)`** — async boundary; two overlapping calls can both pass the fast path.
 *    - **Reserve:** `tryConsumeProducerOnce(producerId, consumedProducerIds)` — first caller inserts id; second gets `alreadyConsumed` and returns (dedupe after `await`).
 *    - Signaling `consume` → wait for `consumed` / `consume-failed` → `transport.consume` → `resume` → store consumer and wire track.
 *    - **`catch`:** `consumedProducerIds.delete(producerId)` — rollback reservation so a later attempt can re-enter (mediasoup consumer may not exist yet if failure was early).
 *
 * ## Dedupe strategy
 *
 * - **Before `await`:** `has` avoids redundant `ensureRecvTransport` / work when already consumed.
 * - **After `await`:** `tryConsumeProducerOnce` matches the old `has` + `add` pair and matches tests in `consumerDedup` / flow mocks.
 * - JS is single-threaded; “races” are interleavings around `await`, not parallel threads.
 *
 * ## `ensureRecvTransport` and scale
 *
 * Each `runConsumeProducer` awaits `ensureRecvTransport`. The implementation returns an existing open
 * transport when present — so later producers typically do not recreate transports. (Future: cache
 * the first `Promise` if profiling shows redundant awaits under very large fan-in.)
 *
 * ## Rollback vs partial failure
 *
 * On error after reservation, we remove `producerId` from `consumedProducerIds`. If `transport.consume`
 * failed after the server accepted consume, any partial consumer is not stored in `consumersByProducerId`;
 * a full retry path may need server/mediasoup alignment — unchanged from prior behavior.
 */

/**
 * Placeholder for a future explicit per-`producerId` state machine (not used in runtime yet).
 * Name distinguishes this from mediasoup’s `Consumer` type.
 */
export type ConsumerLifecycleStatus = 'idle' | 'creating' | 'created' | 'failed'

/**
 * Non-active shape for upcoming orchestration — **do not wire into `useRemoteMedia` until a refactor
 * explicitly replaces `Set`/`Map` guards.**
 */
export type ConsumerState = {
  status: ConsumerLifecycleStatus
}
