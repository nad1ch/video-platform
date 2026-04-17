/**
 * Eat-first overlay mediasoup session: display names for peers.
 *
 * **Boundary:** Video call / `useCallEngine` owns signaling, tiles, and `remoteDisplayNames`
 * updates from room-state. This module is a **thin consumer**: it maps overlay session snapshots
 * into `resolvePeerDisplayNameForUi` from `call-core` so naming matches `callSession.labelFor` /
 * Call page — **single source of truth** in `call-core`, no second participant model.
 *
 * Overlay-specific game labels (`playerLabels` in `useEatOverlayMediasoup`) stay in the composable;
 * when absent, UI falls back to `CallTile.displayName` from the engine.
 */

import { resolvePeerDisplayNameForUi } from 'call-core'

/**
 * Resolve a display label for a peer using the same rules as Video call UI / `session.labelFor`.
 * Pure: does not read Pinia or WebRTC.
 *
 * @param {string} peerId
 * @param {Readonly<Record<string, string>>} remoteDisplayNames snapshot (server map, excludes self)
 * @param {{ selfPeerId: string; selfDisplayName: string }} opts
 * @returns {string}
 */
export function resolveOverlayPeerDisplayName(peerId, remoteDisplayNames, opts) {
  const participants = new Map()
  for (const [pid, dn] of Object.entries(remoteDisplayNames)) {
    participants.set(pid, { peerId: pid, displayName: typeof dn === 'string' ? dn : '' })
  }
  const raw = opts.selfDisplayName
  const selfDisplayName = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  return resolvePeerDisplayNameForUi(peerId, participants, {
    selfPeerId: opts.selfPeerId,
    selfDisplayName,
  })
}
