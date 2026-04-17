import { tryConsumeProducerOnce, type ConsumeOnceResult } from '../src/utils/consumerDedup'

/**
 * Minimal fake recv state: only producerIds and whether each has been "consumed".
 * Mirrors the invariant enforced by `consumedProducerIds` in `useRemoteMedia` (no transports, no RTP).
 */
export function createMockCallState() {
  const consumedProducerIds = new Set<string>()

  /** Simulates handling `new-producer` (first consume path). */
  function onNewProducer(producerId: string): ConsumeOnceResult {
    return tryConsumeProducerOnce(producerId, consumedProducerIds)
  }

  /**
   * Simulates applying a producer-sync list: each id is offered to consume once
   * (same as iterating merged producers and calling `consumeProducer`).
   */
  function onProducerSync(producerIds: readonly string[]): ConsumeOnceResult[] {
    return producerIds.map((id) => tryConsumeProducerOnce(id, consumedProducerIds))
  }

  /** Simulates hard recv teardown before resync (`teardownAllRemoteConsumers`). */
  function hardResetRecvConsumers(): void {
    consumedProducerIds.clear()
  }

  return {
    consumedProducerIds,
    get consumerCount(): number {
      return consumedProducerIds.size
    },
    onNewProducer,
    onProducerSync,
    hardResetRecvConsumers,
  }
}
