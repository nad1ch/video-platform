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

import { normalizeDisplayName, resolvePeerDisplayNameForUi } from 'call-core'

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
  const selfDisplayName = normalizeDisplayName(opts.selfDisplayName)
  return resolvePeerDisplayNameForUi(peerId, participants, {
    selfPeerId: opts.selfPeerId,
    selfDisplayName,
  })
}

/**
 * Stable avatar URL for overlay tile when video is off (no generated URLs — avoids rerender churn).
 *
 * @param {Record<string, unknown> | null | undefined} player Firestore / game row
 * @param {boolean} isLocalTile mediasoup tile is the signed-in overlay user
 * @param {string | undefined} selfAvatarUrl from `useAuth().user.avatar`
 * @returns {string} trimmed URL or empty
 */
export function overlayAvatarUrlForTile(player, isLocalTile, selfAvatarUrl) {
  if (isLocalTile && typeof selfAvatarUrl === 'string' && selfAvatarUrl.trim().length > 0) {
    return selfAvatarUrl.trim()
  }
  if (!player || typeof player !== 'object') {
    return ''
  }
  const raw =
    player.avatar ??
    player.photoUrl ??
    player.photoURL ??
    player.profileImageUrl ??
    player.profile_image_url ??
    ''
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim()
  }
  return ''
}
