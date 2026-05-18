/**
 * In-memory + DB-backed Mafia room → original-host-owner identity store.
 *
 * Purpose
 * -------
 * The Mafia room ("ведучий" / host) must be tied to the original room owner's
 * stable `userId`. Without persistence, a `Room` instance is disposed by
 * `finalizeRoomIfEmpty` as soon as the last peer leaves, which loses
 * `Room.mafiaHostUserId`. The next user who joins the same `roomId` would
 * then be auto-promoted to host by the "first authed user becomes host"
 * branch in `handleJoinRoom` / `handleMafiaClaimHost` — silently stealing
 * host ownership from the original streamer.
 *
 * Storage layers
 * --------------
 *  - In-memory `Map<roomId, OwnerEntry>` (fast path; sync get/set).
 *  - Postgres `MafiaRoomOwner` table (durability backstop, audit Batch F).
 *
 * The cache is the source of truth for synchronous read paths; the DB is
 * authoritative when the cache is cold (server restart). On every `set`
 * the cache is updated synchronously and a best-effort upsert is queued
 * for the DB (fire-and-forget). On every join, `handleJoinRoom` invokes
 * {@link hydrateMafiaRoomOwnerFromDb} so that the original owner is
 * recovered before the auto-promote branch runs.
 *
 * Tests
 * -----
 * The Prisma client is loaded via dynamic `import()` so unit tests in
 * `packages/client-consistency` can exercise the pure in-memory logic
 * without booting a Prisma client.
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
      console.warn('[mafia-owner-store] prisma import failed; degrading to in-memory only', err)
    }
    return null
  }
}

/**
 * Synchronous cache lookup with lazy expiry. Returns `null` for an unseen or
 * expired entry. Production callers that need the DB-backed value should
 * `await hydrateMafiaRoomOwnerFromDb(roomId)` first; the hydrate populates the
 * cache so this getter then returns the persisted owner.
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
 * Write-through: updates the cache synchronously and queues a best-effort
 * Prisma upsert. The DB write is fire-and-forget so existing sync call-sites
 * stay sync; if the write fails (DB outage, schema drift) we log in dev and
 * proceed — the cache remains correct for the current process lifetime, and
 * the next call refreshes the TTL.
 *
 * Use only after server-side authority checks: the caller must have
 * established that this `userId` is allowed to become host.
 */
export function setMafiaRoomOwnerUserId(
  roomId: string,
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  if (typeof roomId !== 'string' || roomId.length === 0) return
  if (typeof userId !== 'string' || userId.length === 0) return
  const expiresAt = nowMs() + Math.max(0, ttlMs)
  ownerByRoomId.set(roomId, { userId, expiresAt })
  void persistMafiaRoomOwner(roomId, userId, expiresAt)
}

async function persistMafiaRoomOwner(
  roomId: string,
  userId: string,
  expiresAtMs: number,
): Promise<void> {
  const mod = await loadPrismaIfConfigured()
  if (!mod) return
  try {
    const expiresAt = new Date(expiresAtMs)
    await mod.prisma.mafiaRoomOwner.upsert({
      where: { roomId },
      create: { roomId, userId, expiresAt },
      update: { userId, expiresAt },
    })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[mafia-owner-store] persist upsert failed', { roomId, err })
    }
  }
}

/**
 * Repopulate the in-memory cache for `roomId` from the durable backstop if
 * the cache is cold. Must be called before any auto-promote-host decision
 * after a server restart so the recorded owner re-asserts ownership. Pure
 * no-op when:
 *   - the cache is already hot for this `roomId`;
 *   - `DATABASE_URL` is unset (dev without DB);
 *   - the DB row is missing or expired (expired rows are pruned).
 */
export async function hydrateMafiaRoomOwnerFromDb(roomId: string): Promise<void> {
  if (typeof roomId !== 'string' || roomId.length === 0) return
  if (ownerByRoomId.has(roomId)) return
  const mod = await loadPrismaIfConfigured()
  if (!mod) return
  try {
    const row = await mod.prisma.mafiaRoomOwner.findUnique({ where: { roomId } })
    if (!row) return
    const expiresAtMs = row.expiresAt.getTime()
    if (expiresAtMs <= nowMs()) {
      void mod.prisma.mafiaRoomOwner
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
      console.warn('[mafia-owner-store] hydrate failed', { roomId, err })
    }
  }
}

/** Test/admin helper. No callers in the live signaling path today. */
export function clearMafiaRoomOwner(roomId: string): void {
  ownerByRoomId.delete(roomId)
  void persistMafiaRoomOwnerDelete(roomId)
}

async function persistMafiaRoomOwnerDelete(roomId: string): Promise<void> {
  const mod = await loadPrismaIfConfigured()
  if (!mod) return
  try {
    await mod.prisma.mafiaRoomOwner.delete({ where: { roomId } })
  } catch {
    /* row may not exist — best-effort */
  }
}

/** Test-only helpers (not exported through any barrel). */
export function _ownerStoreSizeForTests(): number {
  return ownerByRoomId.size
}

export function _resetMafiaRoomOwnerStoreForTests(): void {
  ownerByRoomId.clear()
}
