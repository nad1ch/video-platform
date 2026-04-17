/**
 * Single-producerId guard matching recv `runConsumeProducer` / `consumeProducer` semantics:
 * at most one logical consumer per `producerId` in the consumed set.
 *
 * Assumes single-threaded JS event-loop ordering (no concurrent threads mutating `consumed` outside the same call stack).
 */
export type ConsumeOnceResult = 'created' | 'alreadyConsumed'

/**
 * If `producerId` is not yet in `consumed`, add it and return `created`; otherwise `alreadyConsumed`.
 * Mutates `consumed` only on `created` — same contract as the previous `has` + `add` after `ensureRecvTransport`.
 */
export function tryConsumeProducerOnce(
  producerId: string,
  consumed: Set<string>,
): ConsumeOnceResult {
  if (consumed.has(producerId)) {
    return 'alreadyConsumed'
  }
  consumed.add(producerId)
  return 'created'
}
