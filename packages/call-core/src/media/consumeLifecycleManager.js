import { tryConsumeProducerOnce } from '../utils/consumerDedup';
export function createConsumeLifecycleManager() {
    const consumedProducerIds = new Set();
    const consumingProducerIds = new Set();
    const inflightConsumeByProducerId = new Map();
    return {
        isAlreadyConsumed(producerId) {
            return consumedProducerIds.has(producerId);
        },
        tryReserveAfterTransport(producerId) {
            return tryConsumeProducerOnce(producerId, consumedProducerIds) === 'created';
        },
        releaseReservation(producerId) {
            consumedProducerIds.delete(producerId);
        },
        getInflightTask(producerId) {
            return inflightConsumeByProducerId.get(producerId);
        },
        registerInflightTask(producerId, task) {
            inflightConsumeByProducerId.set(producerId, task);
        },
        unregisterInflightTask(producerId) {
            inflightConsumeByProducerId.delete(producerId);
        },
        markConsuming(producerId) {
            consumingProducerIds.add(producerId);
        },
        unmarkConsuming(producerId) {
            consumingProducerIds.delete(producerId);
        },
        removeProducerLifecycle(producerId) {
            consumedProducerIds.delete(producerId);
            consumingProducerIds.delete(producerId);
            inflightConsumeByProducerId.delete(producerId);
        },
        resetAllLifecycle() {
            consumedProducerIds.clear();
            consumingProducerIds.clear();
            inflightConsumeByProducerId.clear();
        },
    };
}
