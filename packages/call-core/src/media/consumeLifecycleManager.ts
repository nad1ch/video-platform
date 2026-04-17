import { tryConsumeProducerOnce } from '../utils/consumerDedup'

/**
 * Owns recv-side consume coordination only (no mediasoup calls):
 * reservation after transport, inflight coalescing, consuming markers, rollback, teardown clears.
 *
 * Invariants match previous inline `Set`/`Map` usage in `useRemoteMedia` — see `consumeLifecycle.ts`.
 */
export type ConsumeLifecycleManager = {
  /** Fast path before `await ensureRecvTransport` — skip if slot already consumed. */
  isAlreadyConsumed: (producerId: string) => boolean
  /**
   * After `ensureRecvTransport`: reserve `producerId` or detect duplicate concurrent entry.
   * @returns `true` if this caller holds the reservation and must proceed to signaling/consume.
   */
  tryReserveAfterTransport: (producerId: string) => boolean
  /** Roll back reservation on failure (same as `consumedProducerIds.delete`). */
  releaseReservation: (producerId: string) => void

  getInflightTask: (producerId: string) => Promise<void> | undefined
  registerInflightTask: (producerId: string, task: Promise<void>) => void
  unregisterInflightTask: (producerId: string) => void

  markConsuming: (producerId: string) => void
  unmarkConsuming: (producerId: string) => void

  /** `peer-left` / per-producer teardown: drop all tracking for one producer id. */
  removeProducerLifecycle: (producerId: string) => void
  /** Full recv reset (`teardownAllRemoteConsumers`, `stopRemoteMedia`). */
  resetAllLifecycle: () => void
}

export function createConsumeLifecycleManager(): ConsumeLifecycleManager {
  const consumedProducerIds = new Set<string>()
  const consumingProducerIds = new Set<string>()
  const inflightConsumeByProducerId = new Map<string, Promise<void>>()

  return {
    isAlreadyConsumed(producerId: string): boolean {
      return consumedProducerIds.has(producerId)
    },
    tryReserveAfterTransport(producerId: string): boolean {
      return tryConsumeProducerOnce(producerId, consumedProducerIds) === 'created'
    },
    releaseReservation(producerId: string): void {
      consumedProducerIds.delete(producerId)
    },
    getInflightTask(producerId: string): Promise<void> | undefined {
      return inflightConsumeByProducerId.get(producerId)
    },
    registerInflightTask(producerId: string, task: Promise<void>): void {
      inflightConsumeByProducerId.set(producerId, task)
    },
    unregisterInflightTask(producerId: string): void {
      inflightConsumeByProducerId.delete(producerId)
    },
    markConsuming(producerId: string): void {
      consumingProducerIds.add(producerId)
    },
    unmarkConsuming(producerId: string): void {
      consumingProducerIds.delete(producerId)
    },
    removeProducerLifecycle(producerId: string): void {
      consumedProducerIds.delete(producerId)
      consumingProducerIds.delete(producerId)
      inflightConsumeByProducerId.delete(producerId)
    },
    resetAllLifecycle(): void {
      consumedProducerIds.clear()
      consumingProducerIds.clear()
      inflightConsumeByProducerId.clear()
    },
  }
}
