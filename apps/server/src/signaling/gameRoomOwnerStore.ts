/**
 * In-memory + DB-backed generic game-room → original-host-owner identity store.
 *
 * Parallel to {@link ./mafiaRoomOwnerStore.ts} but keyed by `gameroom:<base>`
 * room ids. The two stores are kept separate (and the DB tables too) so a
 * user who claims host of `mafia:foo` does NOT auto-own `gameroom:foo`
 * (and vice versa) — each namespace has its own ownership lifetime.
 *
 * Storage layers, lifecycle, and dynamic Prisma load behavior match the
 * Mafia variant — see that file for the full design notes.
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

function isDbConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

let prismaModulePromise: Promise<typeof import('../prisma')> | null = null
async function loadPrismaIfConfigured(): Promise<typeof import('../prisma') | null> {
  if (!isDbConfigured()) return null
  if (!prismaModulePromise) {
    prismaModulePromise = import('../prisma')
  }
  try {
    return await prismaModulePromise
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gameroom-owner-store] prisma import failed; degrading to in-memory only', err)
    }
    return null
  }
}

/** Synchronous cache lookup with lazy expiry. See Mafia variant for full docs. */
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
 * Write-through: updates the cache synchronously and queues a best-effort
 * Prisma upsert. Use only after server-side authority checks: the caller
 * must have established that this `userId` is allowed to become host.
 */
export function setGameRoomOwnerUserId(
  roomId: string,
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  if (typeof roomId !== 'string' || roomId.length === 0) return
  if (typeof userId !== 'string' || userId.length === 0) return
  const expiresAt = nowMs() + Math.max(0, ttlMs)
  ownerByRoomId.set(roomId, { userId, expiresAt })
  void persistGameRoomOwner(roomId, userId, expiresAt)
}

async function persistGameRoomOwner(
  roomId: string,
  userId: string,
  expiresAtMs: number,
): Promise<void> {
  const mod = await loadPrismaIfConfigured()
  if (!mod) return
  try {
    const expiresAt = new Date(expiresAtMs)
    await mod.prisma.gameRoomOwner.upsert({
      where: { roomId },
      create: { roomId, userId, expiresAt },
      update: { userId, expiresAt },
    })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gameroom-owner-store] persist upsert failed', { roomId, err })
    }
  }
}

/**
 * Repopulate the in-memory cache for `roomId` from the durable backstop if
 * the cache is cold. Must be called before any auto-promote-host decision
 * after a server restart so the recorded owner re-asserts ownership.
 */
export async function hydrateGameRoomOwnerFromDb(roomId: string): Promise<void> {
  if (typeof roomId !== 'string' || roomId.length === 0) return
  if (ownerByRoomId.has(roomId)) return
  const mod = await loadPrismaIfConfigured()
  if (!mod) return
  try {
    const row = await mod.prisma.gameRoomOwner.findUnique({ where: { roomId } })
    if (!row) return
    const expiresAtMs = row.expiresAt.getTime()
    if (expiresAtMs <= nowMs()) {
      void mod.prisma.gameRoomOwner
        .delete({ where: { roomId } })
        .catch(() => {
          /* best-effort lazy purge */
        })
      return
    }
    if (!ownerByRoomId.has(roomId)) {
      ownerByRoomId.set(roomId, { userId: row.userId, expiresAt: expiresAtMs })
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gameroom-owner-store] hydrate failed', { roomId, err })
    }
  }
}

/** Test/admin helper. No callers in the live signaling path today. */
export function clearGameRoomOwner(roomId: string): void {
  ownerByRoomId.delete(roomId)
  void persistGameRoomOwnerDelete(roomId)
}

async function persistGameRoomOwnerDelete(roomId: string): Promise<void> {
  const mod = await loadPrismaIfConfigured()
  if (!mod) return
  try {
    await mod.prisma.gameRoomOwner.delete({ where: { roomId } })
  } catch {
    /* row may not exist — best-effort */
  }
}

/** Test-only helpers (not exported through any barrel). */
export function _gameRoomOwnerStoreSizeForTests(): number {
  return ownerByRoomId.size
}

export function _resetGameRoomOwnerStoreForTests(): void {
  ownerByRoomId.clear()
}
