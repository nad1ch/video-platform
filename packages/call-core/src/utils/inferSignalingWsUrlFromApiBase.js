/**
 * When the SPA talks to the API on `https://api.example.com` but `VITE_SIGNALING_URL`
 * was forgotten or set to the Pages host, the session cookie is not sent on the WS
 * upgrade and server-resolved user id stays empty. Derive a default WebSocket origin from
 * the same absolute API base so host-only features (e.g. Mafia host) still authenticate.
 */
export function trimViteApiBase(v) {
    if (typeof v === 'string' && v.trim().length > 0) {
        return v.trim().replace(/\/$/, '');
    }
    return '';
}
/**
 * @returns WebSocket URL origin (no path), or `null` when inference is impossible
 * (empty env, or path-only API base like `/app`).
 */
export function inferWsOriginFromHttpApiBase(trimmedApiBase) {
    if (!trimmedApiBase || trimmedApiBase.startsWith('/')) {
        return null;
    }
    try {
        const u = new URL(trimmedApiBase);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return null;
        }
        u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        u.pathname = '';
        u.search = '';
        u.hash = '';
        return u.href;
    }
    catch {
        return null;
    }
}
