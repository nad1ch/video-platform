/**
 * In-memory generic game-room → original-host-owner identity store.
 *
 * Parallel to {@link ./mafiaRoomOwnerStore.ts} but keyed by `gameroom:<base>`
 * room ids. The two stores are kept separate so a user who claims host of
 * `mafia:foo` does NOT auto-own `gameroom:foo` (and vice versa) — each
 * namespace has its own ownership lifetime.
 *
 * Same TTL semantics as the Mafia variant:
 *   - 24h default; refreshed on every claim / rejoin.
 *   - Lazy-expiring lookup (no global setInterval).
 *   - In-memory only; server restart drops ownership and the next first authed
 *     joiner of any namespaced room becomes the new owner.
 *
 * The store does NOT validate that the room belongs to a database row; it
 * only enforces ownership continuity for the current process lifetime.
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
export function getGameRoomOwnerUserId(roomId: string): string | null {
  const entry = ownerByRoomId.get(roomId)
  if (!entry) return null
  if (entry.expiresAt <= nowMs()) {
    ownerByRoomId.delete(roomId)
    return null
  }
  return entry.userId
}

/**
 * Record `userId` as the original game-room owner for `roomId` (or refresh
 * the TTL if the same owner is asserting again). Use only after server-side
 * authority checks: the caller must have established that this `userId`
 * is allowed to become host (i.e., room had no prior owner OR matching
 * owner re-assertion OR validated transfer-host).
 */
export function setGameRoomOwnerUserId(
  roomId: string,
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  if (typeof roomId !== 'string' || roomId.length === 0) return
  if (typeof userId !== 'string' || userId.length === 0) return
  ownerByRoomId.set(roomId, { userId, expiresAt: nowMs() + Math.max(0, ttlMs) })
}

/** Test/admin helper. No callers in the live signaling path today. */
export function clearGameRoomOwner(roomId: string): void {
  ownerByRoomId.delete(roomId)
}

/** Test-only helpers (not exported through any barrel). */
export function _gameRoomOwnerStoreSizeForTests(): number {
  return ownerByRoomId.size
}

export function _resetGameRoomOwnerStoreForTests(): void {
  ownerByRoomId.clear()
}
