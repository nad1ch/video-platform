import { mergeProducerLists } from './mergeProducerLists';
function decisionForProducerSync(producers, reason) {
    const shouldReset = reason === 'client-refresh';
    const producersToApply = mergeProducerLists(producers);
    return {
        shouldReset,
        shouldApplySync: true,
        producersToApply,
    };
}
/**
 * Stateful coordinator: one instance per `useRemoteMedia` / recv session. `mark*` hooks are for tracing
 * and future dedupe policy — they do not change consume semantics today.
 */
export function createRecoveryCoordinator() {
    let resetGeneration = 0;
    let lastSyncAppliedSignature = null;
    function onEvent(event) {
        switch (event.type) {
            case 'producer-sync':
                return decisionForProducerSync(event.producers, event.reason);
            case 'new-producer':
                return {
                    shouldReset: false,
                    shouldApplySync: true,
                    producersToApply: mergeProducerLists([event.producer]),
                };
            case 'connected':
            case 'client-refresh':
                return { shouldReset: false, shouldApplySync: false, producersToApply: [] };
        }
    }
    function markResetDone() {
        resetGeneration += 1;
    }
    function markSyncApplied(producerIds) {
        lastSyncAppliedSignature = [...producerIds].sort().join('\u0000');
    }
    return {
        onEvent,
        markResetDone,
        markSyncApplied,
        get lastSyncSignature() {
            return lastSyncAppliedSignature;
        },
        get resetGeneration() {
            return resetGeneration;
        },
    };
}
/** Map parsed WS `producer-sync` into a `RecoveryEvent`. */
export function producerSyncParsedToRecoveryEvent(parsed) {
    return {
        type: 'producer-sync',
        producers: parsed.producers,
        reason: parsed.forceResync ? 'client-refresh' : undefined,
    };
}
/**
 * Plans recv handling for one `producer-sync` message (back-compat helper).
 * Prefer `createRecoveryCoordinator().onEvent(producerSyncParsedToRecoveryEvent(parsed))` in new code.
 */
export function planProducerSyncRecovery(parsed) {
    const c = createRecoveryCoordinator();
    const d = c.onEvent(producerSyncParsedToRecoveryEvent(parsed));
    return {
        teardownRecvConsumers: d.shouldReset,
        producersToConsume: d.producersToApply,
    };
}
/**
 * Payload for outbound `request-producer-sync` (merge-only vs reset-then-sync on server).
 */
export function buildRequestProducerSyncPayload(mode) {
    return { resetConsumers: mode === 'hard' };
}
