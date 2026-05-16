/**
 * Mafia host is a non-player: fixed at the end of the numbering order and excluded from roles / night targets.
 */
export function pinHostPeerToEndOfOrder(order, hostPeerId) {
    const hp = typeof hostPeerId === 'string' ? hostPeerId.trim() : '';
    if (hp.length < 1 || order.length < 1) {
        return [...order];
    }
    const idx = order.indexOf(hp);
    if (idx < 0) {
        return [...order];
    }
    if (idx === order.length - 1) {
        return [...order];
    }
    return [...order.filter((id) => id !== hp), hp];
}
export function mafiaNightActionMaxSeatForOrder(order, hostPeerId) {
    const hp = typeof hostPeerId === 'string' ? hostPeerId.trim() : '';
    if (order.length >= 1 && hp.length > 0 && order[order.length - 1] === hp) {
        return Math.max(0, order.length - 1);
    }
    return order.length;
}
