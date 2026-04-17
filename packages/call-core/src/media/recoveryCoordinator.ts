import { mergeProducerLists } from './mergeProducerLists'
import type { RemoteProducerInfo } from '../signaling/useRoomConnection'

/**
 * Recovery coordination for recv-side producer lists (`producer-sync`, `new-producer`, outbound
 * `request-producer-sync`). Pure decision layer — no WebSocket, no mediasoup; `useRemoteMedia` applies effects.
 *
 * Order invariant (unchanged): if `shouldReset`, run full recv teardown first, then `syncExistingProducers`.
 */

export type ProducerSyncParsed = {
  producers: RemoteProducerInfo[]
  /** True when `syncReason === 'client-refresh'` (server-driven full resync). */
  forceResync: boolean
}

/** Inbound recovery signals the recv orchestrator may map from WS / setup. */
export type RecoveryEvent =
  | {
      type: 'producer-sync'
      producers: RemoteProducerInfo[]
      /** `client-refresh` ⇒ reset recv consumers before applying the list (matches `forceResync`). */
      reason?: 'client-refresh' | 'recv-connected'
    }
  | { type: 'new-producer'; producer: RemoteProducerInfo }
  /** Reserved for future local hooks (e.g. transport “connected”); no recv work by default. */
  | { type: 'connected' }
  /** Reserved; client-refresh is normally carried as `producer-sync` + `reason: 'client-refresh'`. */
  | { type: 'client-refresh' }

export type RecoveryDecision = {
  shouldReset: boolean
  /**
   * When false, caller skips `syncExistingProducers` (e.g. `connected` noop).
   * For `producer-sync` / `new-producer` this is always true — same as always running one sync pass.
   */
  shouldApplySync: boolean
  producersToApply: RemoteProducerInfo[]
}

/** Back-compat shape from `planProducerSyncRecovery` (maps to `RecoveryDecision`). */
export type ProducerSyncRecvPlan = {
  teardownRecvConsumers: boolean
  producersToConsume: RemoteProducerInfo[]
}

export type RequestProducerSyncMode = 'soft' | 'hard'

function decisionForProducerSync(
  producers: RemoteProducerInfo[],
  reason: Extract<RecoveryEvent, { type: 'producer-sync' }>['reason'],
): RecoveryDecision {
  const shouldReset = reason === 'client-refresh'
  const producersToApply = mergeProducerLists(producers)
  return {
    shouldReset,
    shouldApplySync: true,
    producersToApply,
  }
}

/**
 * Stateful coordinator: one instance per `useRemoteMedia` / recv session. `mark*` hooks are for tracing
 * and future dedupe policy — they do not change consume semantics today.
 */
export function createRecoveryCoordinator() {
  let resetGeneration = 0
  let lastSyncAppliedSignature: string | null = null

  function onEvent(event: RecoveryEvent): RecoveryDecision {
    switch (event.type) {
      case 'producer-sync':
        return decisionForProducerSync(event.producers, event.reason)
      case 'new-producer':
        return {
          shouldReset: false,
          shouldApplySync: true,
          producersToApply: mergeProducerLists([event.producer]),
        }
      case 'connected':
      case 'client-refresh':
        return { shouldReset: false, shouldApplySync: false, producersToApply: [] }
    }
  }

  function markResetDone(): void {
    resetGeneration += 1
  }

  function markSyncApplied(producerIds: readonly string[]): void {
    lastSyncAppliedSignature = [...producerIds].sort().join('\u0000')
  }

  return {
    onEvent,
    markResetDone,
    markSyncApplied,
    /** DEV/tests: last signature passed to `markSyncApplied`. */
    get lastSyncSignature(): string | null {
      return lastSyncAppliedSignature
    },
    get resetGeneration(): number {
      return resetGeneration
    },
  }
}

export type RecoveryCoordinatorHandle = ReturnType<typeof createRecoveryCoordinator>

/** Map parsed WS `producer-sync` into a `RecoveryEvent`. */
export function producerSyncParsedToRecoveryEvent(parsed: ProducerSyncParsed): RecoveryEvent {
  return {
    type: 'producer-sync',
    producers: parsed.producers,
    reason: parsed.forceResync ? 'client-refresh' : undefined,
  }
}

/**
 * Plans recv handling for one `producer-sync` message (back-compat helper).
 * Prefer `createRecoveryCoordinator().onEvent(producerSyncParsedToRecoveryEvent(parsed))` in new code.
 */
export function planProducerSyncRecovery(parsed: ProducerSyncParsed): ProducerSyncRecvPlan {
  const c = createRecoveryCoordinator()
  const d = c.onEvent(producerSyncParsedToRecoveryEvent(parsed))
  return {
    teardownRecvConsumers: d.shouldReset,
    producersToConsume: d.producersToApply,
  }
}

/**
 * Payload for outbound `request-producer-sync` (merge-only vs reset-then-sync on server).
 */
export function buildRequestProducerSyncPayload(mode: RequestProducerSyncMode): { resetConsumers: boolean } {
  return { resetConsumers: mode === 'hard' }
}
