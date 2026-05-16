/**
 * If `producerId` is not yet in `consumed`, add it and return `created`; otherwise `alreadyConsumed`.
 * Mutates `consumed` only on `created` — same contract as the previous `has` + `add` after `ensureRecvTransport`.
 */
export function tryConsumeProducerOnce(producerId, consumed) {
    if (consumed.has(producerId)) {
        return 'alreadyConsumed';
    }
    consumed.add(producerId);
    return 'created';
}
