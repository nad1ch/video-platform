import { resolveUserRole } from '../auth/resolveUserRole'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import { readSessionFromCookie, type SessionPayload } from '../auth/session/sessionJwt'
import { isDatabaseConfigured, prisma } from '../prisma'

function roleInput(s: SessionPayload) {
  return {
    provider: s.provider,
    id: s.id,
    email: s.email,
    twitchId:
      s.provider === 'twitch'
        ? typeof s.twitch_id === 'string' && s.twitch_id.length > 0
          ? s.twitch_id
          : s.id
        : undefined,
  }
}

type SessionContext = {
  isAdmin: boolean
  prismaUserId: string | null
  isHostRole: boolean
}

async function resolveSessionContext(cookieHeader: string | undefined): Promise<SessionContext | null> {
  const session = readSessionFromCookie(cookieHeader)
  if (!session) return null
  const envAdmin = resolveUserRole(roleInput(session)) === 'admin'
  const prismaUserId = await resolvePrismaUserIdFromSession(session)
  if (!prismaUserId) {
    
    
    return envAdmin ? { isAdmin: true, prismaUserId: null, isHostRole: false } : null
  }
  const u = await prisma.user.findUnique({
    where: { id: prismaUserId },
    select: { role: true },
  })
  const r = u?.role ?? ''
  const isAdmin = envAdmin || r === 'admin'
  const isHostRole = r === 'host'
  return { isAdmin, prismaUserId, isHostRole }
}

/**
 * Global gate (back-compat): admin or legacy `User.role = host`.
 * PREFER `eatFirstSessionCanOperateGame(cookie, gameId)` for per-game checks —
 * this helper is kept as a fallback for paths that do not yet know the gameId
 * (e.g. `ensureGame` where ownership is established on the fly).
 */
export async function eatFirstSessionCanOperate(cookieHeader: string | undefined): Promise<boolean> {
  const ctx = await resolveSessionContext(cookieHeader)
  if (!ctx) return false
  return ctx.isAdmin || ctx.isHostRole
}

/**
 * Per-game authorization. Returns `true` when the session is allowed to
 * operate on this specific `gameId`:
 *   - admin sessions always pass;
 *   - any authenticated user whose Prisma id matches `room.ownerUserId`
 *     (per-game host stamped on first `ensure`) may operate;
 *   - otherwise, legacy `User.role = host` staff rules apply when `ownerUserId`
 *     is missing or the game row does not exist yet.
 */
export async function eatFirstSessionCanOperateGame(
  cookieHeader: string | undefined,
  gameId: string,
): Promise<boolean> {
  const ctx = await resolveSessionContext(cookieHeader)
  if (!ctx) return false
  if (ctx.isAdmin) return true
  if (!isDatabaseConfigured()) {
    return process.env.NODE_ENV !== 'production'
  }
  const row = await prisma.eatFirstGame.findUnique({
    where: { id: gameId },
    select: { room: true },
  })
  const room =
    row && typeof row.room === 'object' && row.room !== null && !Array.isArray(row.room)
      ? (row.room as Record<string, unknown>)
      : {}
  const ownerUserIdRaw = room.ownerUserId
  const ownerUserId =
    typeof ownerUserIdRaw === 'string' && ownerUserIdRaw.trim().length > 0
      ? ownerUserIdRaw.trim()
      : ''
  if (ctx.prismaUserId && ownerUserId.length > 0 && ctx.prismaUserId === ownerUserId) {
    return true
  }
  if (!ctx.isHostRole) return false
  if (!row) {
    return true
  }
  if (ownerUserId.length === 0) {
    return true
  }
  return ctx.prismaUserId === ownerUserId
}

/**
 * Resolve the authenticated caller's Prisma user id when they are an admin
 * OR a system-level host. Used by `eatFirstEnsureGame` to stamp ownership
 * on first creation. Returns `null` for non-host/non-admin sessions.
 */
export async function resolveEatFirstOperatorUserId(
  cookieHeader: string | undefined,
): Promise<string | null> {
  const ctx = await resolveSessionContext(cookieHeader)
  if (!ctx) return null
  if (!ctx.isAdmin && !ctx.isHostRole) return null
  return ctx.prismaUserId
}

/**
 * User id to stamp into `room.ownerUserId` on `eatFirstEnsureGame`:
 * staff (admin / global host role) first, otherwise any authenticated Prisma user.
 */
export async function resolveEatFirstEnsureOwnerUserId(
  cookieHeader: string | undefined,
): Promise<string | null> {
  const operator = await resolveEatFirstOperatorUserId(cookieHeader)
  if (operator) return operator
  const ctx = await resolveSessionContext(cookieHeader)
  return ctx?.prismaUserId ?? null
}
