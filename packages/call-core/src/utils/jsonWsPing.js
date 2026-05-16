/**
 * Application-level heartbeat for reverse proxies (nginx idle timeouts).
 * Server sends `{ type: 'ping' }`; browser replies `{ type: 'pong' }`.
 *
 * @returns true if `data` was a ping and a reply was attempted (caller should skip other handlers).
 */
export function replyJsonPingIfNeeded(data, ws) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    if (data.type !== 'ping') {
        return false;
    }
    try {
        ws.send(JSON.stringify({ type: 'pong' }));
    }
    catch {
        /* ignore */
    }
    return true;
}
