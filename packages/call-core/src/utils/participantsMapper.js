/**
 * Derived participant view for future store/UI — pure functions only, no Pinia or WebRTC side effects.
 *
 * @example
 * ```ts
 * // Prefer a shallow copy so a later store mutation cannot mutate past snapshots:
 * const map = mapTilesToParticipants(tiles.value, { ...session.remoteDisplayNames })
 * const p = map.get(peerId)
 * ```
 */
import { normalizeDisplayName } from './normalizeDisplayName';
export function guestDisplayNameForPeerId(peerId) {
    return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`;
}
export function resolveParticipantDisplayName(peerId, tileDisplayName, isLocal, remoteDisplayNames) {
    const fromTile = normalizeDisplayName(tileDisplayName);
    if (fromTile) {
        return fromTile;
    }
    if (isLocal) {
        return 'You';
    }
    const fromRemote = remoteDisplayNames[peerId];
    if (typeof fromRemote === 'string') {
        const t = normalizeDisplayName(fromRemote);
        if (t) {
            return t;
        }
    }
    return guestDisplayNameForPeerId(peerId);
}
/**
 * Build a stable `Map<peerId, Participant>` from grid tiles plus optional remote name map.
 * Does not mutate inputs. Duplicate `peerId` rows: **last tile wins** (same as `Map.set` order).
 * Pass `{ ...remoteDisplayNames }` if you want a snapshot isolated from live Pinia mutations.
 */
export function mapTilesToParticipants(tiles, remoteDisplayNames = {}) {
    const m = new Map();
    for (const t of tiles) {
        const isLocal = t.isLocal === true;
        const displayName = resolveParticipantDisplayName(t.peerId, t.displayName, isLocal, remoteDisplayNames);
        const stream = t.stream;
        let audioTrack;
        let videoTrack;
        if (stream) {
            for (const track of stream.getTracks()) {
                if (track.kind === 'audio') {
                    audioTrack = track;
                }
                if (track.kind === 'video') {
                    videoTrack = track;
                }
            }
        }
        const row = {
            peerId: t.peerId,
            displayName,
            isLocal,
        };
        if (stream) {
            row.stream = stream;
        }
        if (audioTrack) {
            row.audioTrack = audioTrack;
        }
        if (videoTrack) {
            row.videoTrack = videoTrack;
        }
        m.set(t.peerId, row);
    }
    return m;
}
/**
 * Tiles first, then any remote-only peers (e.g. joined in signaling before a recv tile exists).
 * Keeps `displayName` aligned with `resolveParticipantDisplayName` / `remoteDisplayNames`.
 *
 * **Call / overlay UI:** use this map + `resolvePeerDisplayNameForUi` as the single name path (do not
 * read `tile.displayName` or ad-hoc fallbacks in templates).
 */
export function buildCallParticipantMap(tiles, remoteDisplayNames, selfPeerId) {
    const m = mapTilesToParticipants(tiles, remoteDisplayNames);
    for (const peerId of Object.keys(remoteDisplayNames)) {
        if (peerId === selfPeerId) {
            continue;
        }
        if (m.has(peerId)) {
            continue;
        }
        m.set(peerId, {
            peerId,
            displayName: resolveParticipantDisplayName(peerId, '', false, remoteDisplayNames),
            isLocal: false,
        });
    }
    return m;
}
