/**
 * In-memory Mafia room → original-host-owner identity store.
 *
 * Purpose
 * -------
 * The Mafia room ("ведучий" / host) must be tied to the original room owner's
 * stable `userId`. Without persistence, a `Room` instance is disposed by
 * `finalizeRoomIfEmpty` as soon as the last peer leaves, which loses
 * `Room.mafiaHostUserId`. The next user who joins the same `roomId` would
 * then be auto-promoted to host by the legacy "first authed user becomes
 * host" branch in `handleJoinRoom` / `handleMafiaClaimHost` — silently
 * stealing host ownership from the original streamer.
 *
 * This store keeps the owner `userId` per `roomId` in process memory with a
 * TTL window (default 24h) so:
 *   - the original owner regains host on rejoin even after the room was
 *     disposed (server-authoritative, not client-asserted);
 *   - other users who join an "owner-claimed" room while the owner is
 *     offline do not become host;
 *   - OBS/view sessions never become host (claim-host is also gated on
 *     the client by `useMafiaViewMode`, but the server cannot tell view
 *     vs participant from the wire today).
 *
 * Out of scope (intentional)
 * --------------------------
 * - DB persistence: per spec, in-memory + TTL is acceptable for production
 *   minimal diff. Server restart drops ownership and the next first authed
 *   joiner of any room becomes the new owner.
 * - Per-streamer linkage: this store does not validate that the room
 *   belongs to a streamer database row; it only enforces ownership
 *   continuity for the current process lifetime. Combine with existing
 *   streamer/auth helpers if stricter validation is needed in a follow-up.
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

type OwnerEntry = {
  userId: string
  expiresAt: number
}

const ownerByRoomId = new Map<string, OwnerEntry>()

function nowMs(): number {
  return Date.now()
}

/**
 * Lazy-expiring lookup: drops entries whose `expiresAt` has passed before
 * returning. Keeping the prune lazy avoids a global `setInterval` and the
 * map only ever holds rooms that have been touched recently.
 */
export function getMafiaRoomOwnerUserId(roomId: string): string | null {
  const entry = ownerByRoomId.get(roomId)
  if (!entry) return null
  if (entry.expiresAt <= nowMs()) {
    ownerByRoomId.delete(roomId)
    return null
  }
  return entry.userId
}

/**
 * Record `userId` as the original Mafia owner for `roomId` (or refresh the
 * TTL if the same owner is asserting again). Use only after server-side
 * authority checks: the caller must have established that this `userId`
 * is allowed to become host (i.e., room had no prior owner OR matching
 * owner re-assertion OR validated transfer-host).
 */
export function setMafiaRoomOwnerUserId(
  roomId: string,
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  if (typeof roomId !== 'string' || roomId.length === 0) return
  if (typeof userId !== 'string' || userId.length === 0) return
  ownerByRoomId.set(roomId, { userId, expiresAt: nowMs() + Math.max(0, ttlMs) })
}

/** Test/admin helper. No callers in the live signaling path today. */
export function clearMafiaRoomOwner(roomId: string): void {
  ownerByRoomId.delete(roomId)
}

/** Test-only helpers (not exported through any barrel). */
export function _ownerStoreSizeForTests(): number {
  return ownerByRoomId.size
}

export function _resetMafiaRoomOwnerStoreForTests(): void {
  ownerByRoomId.clear()
}
