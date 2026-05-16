const LS_PREFIX = 'streamassist_call_listen_v1:';
function clampGain(v) {
    if (!Number.isFinite(v)) {
        return 1;
    }
    return Math.min(2, Math.max(0, v));
}
export function loadRemoteListeningPrefs(roomId) {
    const out = new Map();
    if (typeof localStorage === 'undefined') {
        return out;
    }
    const key = LS_PREFIX + encodeURIComponent(roomId);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return out;
        }
        const o = JSON.parse(raw);
        if (!o || typeof o !== 'object') {
            return out;
        }
        for (const [peerId, row] of Object.entries(o)) {
            if (!row || typeof row !== 'object') {
                continue;
            }
            const r = row;
            const volume = clampGain(typeof r.v === 'number' ? r.v : 1);
            const muted = r.m === true;
            const nzRaw = r.nz;
            const nz = typeof nzRaw === 'number' && Number.isFinite(nzRaw) ? clampGain(nzRaw) : undefined;
            const entry = { volume, muted };
            if (nz !== undefined && nz > 0) {
                entry.nz = nz;
            }
            out.set(peerId, entry);
        }
    }
    catch {
        /* ignore */
    }
    return out;
}
export function saveRemoteListeningPrefs(roomId, map) {
    if (typeof localStorage === 'undefined') {
        return;
    }
    const key = LS_PREFIX + encodeURIComponent(roomId);
    try {
        const o = {};
        for (const [peerId, e] of map.entries()) {
            const row = {
                v: clampGain(e.volume),
                m: e.muted === true,
            };
            if (typeof e.nz === 'number' && Number.isFinite(e.nz) && clampGain(e.nz) > 0) {
                row.nz = clampGain(e.nz);
            }
            o[peerId] = row;
        }
        if (Object.keys(o).length === 0) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(key, JSON.stringify(o));
    }
    catch {
        /* ignore */
    }
}
