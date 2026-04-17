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

import { normalizeDisplayName } from './normalizeDisplayName'

export type Participant = {
  peerId: string
  displayName: string
  stream?: MediaStream
  audioTrack?: MediaStreamTrack
  videoTrack?: MediaStreamTrack
  isLocal?: boolean
}

/** Minimal tile shape (matches `CallTile` fields needed for mapping). */
export type ParticipantTileInput = {
  peerId: string
  displayName: string
  stream: MediaStream | null
  /** When omitted, tile is treated as remote (`false`). */
  isLocal?: boolean
}

/** Back-compat alias — prefer `Participant`. */
export type CallParticipant = Participant

/** Back-compat alias — prefer `ParticipantTileInput`. */
export type TileLike = ParticipantTileInput

/** Remote peer with no tile name and no server row — matches legacy `labelFor` guest string. */
export function guestDisplayNameForPeerId(peerId: string): string {
  return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`
}

/**
 * Resolve display name from tile string, optional Pinia `remoteDisplayNames`, and local/remote role.
 * Pure — pass `session.remoteDisplayNames` (or a plain object snapshot) from the caller.
 */
export function resolveParticipantDisplayName(
  peerId: string,
  tileDisplayName: string,
  isLocal: boolean,
  remoteDisplayNames: Readonly<Record<string, string>>,
): string {
  const fromTile = normalizeDisplayName(tileDisplayName)
  if (fromTile) {
    return fromTile
  }
  if (isLocal) {
    return 'You'
  }
  const fromRemote = remoteDisplayNames[peerId]
  if (typeof fromRemote === 'string') {
    const t = normalizeDisplayName(fromRemote)
    if (t) {
      return t
    }
  }
  return guestDisplayNameForPeerId(peerId)
}

/**
 * Build a stable `Map<peerId, Participant>` from grid tiles plus optional remote name map.
 * Does not mutate inputs. Duplicate `peerId` rows: **last tile wins** (same as `Map.set` order).
 * Pass `{ ...remoteDisplayNames }` if you want a snapshot isolated from live Pinia mutations.
 */
export function mapTilesToParticipants(
  tiles: readonly ParticipantTileInput[],
  remoteDisplayNames: Readonly<Record<string, string>> = {},
): Map<string, Participant> {
  const m = new Map<string, Participant>()
  for (const t of tiles) {
    const isLocal = t.isLocal === true
    const displayName = resolveParticipantDisplayName(t.peerId, t.displayName, isLocal, remoteDisplayNames)

    const stream = t.stream
    let audioTrack: MediaStreamTrack | undefined
    let videoTrack: MediaStreamTrack | undefined
    if (stream) {
      for (const track of stream.getTracks()) {
        if (track.kind === 'audio') {
          audioTrack = track
        }
        if (track.kind === 'video') {
          videoTrack = track
        }
      }
    }

    const row: Participant = {
      peerId: t.peerId,
      displayName,
      isLocal,
    }
    if (stream) {
      row.stream = stream
    }
    if (audioTrack) {
      row.audioTrack = audioTrack
    }
    if (videoTrack) {
      row.videoTrack = videoTrack
    }
    m.set(t.peerId, row)
  }
  return m
}

/**
 * Tiles first, then any remote-only peers (e.g. joined in signaling before a recv tile exists).
 * Keeps `displayName` aligned with `resolveParticipantDisplayName` / `remoteDisplayNames`.
 *
 * **Call / overlay UI:** use this map + `resolvePeerDisplayNameForUi` as the single name path (do not
 * read `tile.displayName` or ad-hoc fallbacks in templates).
 */
export function buildCallParticipantMap(
  tiles: readonly ParticipantTileInput[],
  remoteDisplayNames: Readonly<Record<string, string>>,
  selfPeerId: string,
): Map<string, Participant> {
  const m = mapTilesToParticipants(tiles, remoteDisplayNames)
  for (const peerId of Object.keys(remoteDisplayNames)) {
    if (peerId === selfPeerId) {
      continue
    }
    if (m.has(peerId)) {
      continue
    }
    m.set(peerId, {
      peerId,
      displayName: resolveParticipantDisplayName(peerId, '', false, remoteDisplayNames),
      isLocal: false,
    })
  }
  return m
}
