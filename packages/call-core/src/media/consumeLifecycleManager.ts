import { tryConsumeProducerOnce } from '../utils/consumerDedup'

/**
 * Owns recv-side consume coordination only (no mediasoup calls):
 * reservation after transport, inflight coalescing, consuming markers, rollback, teardown clears.
 *
 * Invariants match previous inline `Set`/`Map` usage in `useRemoteMedia` — see `consumeLifecycle.ts`.
 *
 * Audit M8 generation guard: `resetAllLifecycle()` bumps an internal counter
 * so any consume task that started in an older generation can detect the
 * teardown and bail out before mutating state. Call sites should snapshot
 * `getGeneration()` before the first `await` and skip post-await side
 * effects when `isCurrentGeneration(token)` is `false`.
 */
export type ConsumeLifecycleManager = {

  isAlreadyConsumed: (producerId: string) => boolean
  /**
   * After `ensureRecvTransport`: reserve `producerId` or detect duplicate concurrent entry.
   * @returns `true` if this caller holds the reservation and must proceed to signaling/consume.
   */
  tryReserveAfterTransport: (producerId: string) => boolean

  releaseReservation: (producerId: string) => void

  getInflightTask: (producerId: string) => Promise<void> | undefined
  registerInflightTask: (producerId: string, task: Promise<void>) => void
  unregisterInflightTask: (producerId: string) => void

  markConsuming: (producerId: string) => void
  unmarkConsuming: (producerId: string) => void

  /** `peer-left` / per-producer teardown: drop all tracking for one producer id. */
  removeProducerLifecycle: (producerId: string) => void

  resetAllLifecycle: () => void

  /** Audit M8: opaque token snapshot of the current generation. */
  getGeneration: () => number
  /** Audit M8: `true` iff `token` matches the current generation (no teardown happened since). */
  isCurrentGeneration: (token: number) => boolean
}

export function createConsumeLifecycleManager(): ConsumeLifecycleManager {
  const consumedProducerIds = new Set<string>()
  const consumingProducerIds = new Set<string>()
  const inflightConsumeByProducerId = new Map<string, Promise<void>>()
  /**
   * Monotonically increasing generation counter. Starts at 1 so 0 can be used
   * as a "never captured" sentinel by callers that store the token in a Map.
   */
  let generation = 1

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
      generation += 1
    },
    getGeneration(): number {
      return generation
    },
    isCurrentGeneration(token: number): boolean {
      return token === generation
    },
  }
}
