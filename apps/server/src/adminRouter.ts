import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from './prisma'
import { isSessionAdminFromCookie } from './auth/session/isAdminRequest'
import { resolvePrismaUserIdFromSession } from './auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from './auth/session/sessionJwt'
import { getUserRoles, parseFeaturePermissions, parseSystemRoles, setUserRoles } from './auth/userRoles'
import { normalizeTwitchLogin } from './streamerIdentity'
import {
  BUCKET_PREFIX_SESSION,
  ROOM_ID_MAX_LENGTH,
  snapshotRoomDiagnostics,
} from './signaling/roomDiagnosticsBus'
import { buildGameSessionReport } from './signaling/roomDiagnosticsReport'
import { createIpRateLimitMiddleware } from './utils/rateLimitMiddleware'

/**
 * Per-IP cap for admin mutations (audit S7). All three handlers gate on
 * `requireAdmin`; this cap is defense-in-depth against stolen cookies and
 * audit-log spam. 60/min comfortably covers legitimate role-promotion
 * batches and streamer-list curation; abnormal bursts get a 429.
 */
const adminMutationRateLimit = createIpRateLimitMiddleware({
  label: 'http:admin:mutate',
  windowMs: 60 * 1000,
  limit: 60,
}).middleware

/**
 * Max length of the `roomId` slug used in the `Content-Disposition`
 * attachment filename. Bounded so a pathological key cannot produce a
 * megabyte-long header.
 */
const DIAGNOSTIC_FILENAME_SLUG_MAX_LENGTH = 80

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isSessionAdminFromCookie(req.headers.cookie))) {
    res.status(403).json({ error: 'forbidden', message: 'Admin only' })
    return false
  }
  return true
}

async function resolveActorUserId(req: Request): Promise<string | null> {
  const session = readSessionFromCookie(req.headers.cookie)
  return session ? await resolvePrismaUserIdFromSession(session) : null
}

async function actorAuditId(req: Request, actorUserId: string | null): Promise<string> {
  if (actorUserId) {
    return actorUserId
  }
  const session = readSessionFromCookie(req.headers.cookie)
  return session?.id ?? 'unknown'
}

/**
 * Parse an ISO datetime query param. Returns `undefined` when the value
 * is missing or invalid so callers can skip the where clause rather than
 * crashing on `new Date(NaN)`.
 */
function parseAdminDateParam(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? new Date(ms) : undefined
}

async function logAdminAudit(
  req: Request,
  input: {
    actorUserId: string | null
    targetUserId?: string | null
    targetStreamerId?: string | null
    action: string
    metadata?: Prisma.InputJsonValue
  },
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: await actorAuditId(req, input.actorUserId),
        targetUserId: input.targetUserId ?? null,
        targetStreamerId: input.targetStreamerId ?? null,
        action: input.action,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    })
  } catch (e) {
    console.error('[admin] audit log write failed', e)
  }
}

const RECENT_ACTIVITY_LIMIT = 20
const ACTIVITY_SUMMARY_EVENT_LIMIT = 1000
const MAX_SESSION_GAP_MS = 30 * 60 * 1000

type ActivitySummaryRow = {
  sessionId: string | null
  path: string | null
  createdAt: Date
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function summarizeActivity(
  eventsDesc: ActivitySummaryRow[],
  latestErrorAt: Date | null,
): {
  lastSeenAt: string | null
  totalSessions: number
  totalTimeSpentSeconds: number
  lastPath: string | null
} {
  const latestEvent = eventsDesc[0] ?? null
  const lastSeen =
    latestEvent && latestErrorAt
      ? latestEvent.createdAt > latestErrorAt
        ? latestEvent.createdAt
        : latestErrorAt
      : latestEvent?.createdAt ?? latestErrorAt
  const lastPath = eventsDesc.find((event) => event.path)?.path ?? null
  const sessionIds = new Set<string>()
  let anonymousSessions = 0
  let lastAnonymousAt: Date | null = null
  let totalTimeMs = 0
  const lastBySession = new Map<string, Date>()

  for (const event of [...eventsDesc].reverse()) {
    if (event.sessionId) {
      sessionIds.add(event.sessionId)
      const previous = lastBySession.get(event.sessionId)
      if (previous) {
        const gap = event.createdAt.getTime() - previous.getTime()
        if (gap > 0 && gap <= MAX_SESSION_GAP_MS) {
          totalTimeMs += gap
        }
      }
      lastBySession.set(event.sessionId, event.createdAt)
      continue
    }

    if (!lastAnonymousAt || event.createdAt.getTime() - lastAnonymousAt.getTime() > MAX_SESSION_GAP_MS) {
      anonymousSessions += 1
    } else {
      const gap = event.createdAt.getTime() - lastAnonymousAt.getTime()
      if (gap > 0) {
        totalTimeMs += gap
      }
    }
    lastAnonymousAt = event.createdAt
  }

  return {
    lastSeenAt: toIso(lastSeen),
    totalSessions: sessionIds.size + anonymousSessions,
    totalTimeSpentSeconds: Math.round(totalTimeMs / 1000),
    lastPath,
  }
}

/**
 * Parse an ISO datetime query param. Returns `undefined` when the value
 * is missing or invalid so callers can skip the where clause rather than
 * crashing on `new Date(NaN)`.
 */
function parseAdminDateParam(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? new Date(ms) : undefined
}

export function mountAdminRoutes(app: Express): void {
  app.get('/api/admin/users', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({ databaseConfigured: false, users: [] })
      return
    }
    try {
      /**
       * Optional date range filters. Invalid values are ignored (not
       * 400'd) so a half-typed `datetime-local` value in the admin UI
       * never bricks the list. `createdAt`/`updatedAt` are both indexed
       * via the User model; the existing `take: 250` + `orderBy: updatedAt`
       * stays as-is so the page caps at the same size whether or not
       * date filters are applied.
       */
      const createdFrom = parseAdminDateParam(req.query.createdFrom)
      const createdTo = parseAdminDateParam(req.query.createdTo)
      const updatedFrom = parseAdminDateParam(req.query.updatedFrom)
      const updatedTo = parseAdminDateParam(req.query.updatedTo)
      const where: Prisma.UserWhereInput = {}
      if (createdFrom || createdTo) {
        where.createdAt = {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {}),
        }
      }
      if (updatedFrom || updatedTo) {
        where.updatedAt = {
          ...(updatedFrom ? { gte: updatedFrom } : {}),
          ...(updatedTo ? { lte: updatedTo } : {}),
        }
      }
      const [rows, userStatsAgg] = await Promise.all([
        prisma.user.findMany({
          where,
          take: 250,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            provider: true,
            role: true,
            twitchId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.userStreamerStats.groupBy({
          by: ['userId'],
          _sum: { wins: true, gamesPlayed: true },
        }),
      ])
      const statsByUser = new Map(
        userStatsAgg.map((g) => [
          g.userId,
          { wins: g._sum.wins ?? 0, gamesPlayed: g._sum.gamesPlayed ?? 0 },
        ]),
      )
      const roleContexts = await Promise.all(rows.map((u) => getUserRoles(u.id)))
      const users = rows.map((u, idx) => {
        const w = statsByUser.get(u.id)
        const role =
          u.role === 'admin' ? 'admin' : u.role === 'host' ? 'host' : 'user'
        const roleContext = roleContexts[idx]
        return {
          id: u.id,
          displayName: u.displayName,
          avatar: u.avatarUrl?.trim() ? u.avatarUrl.trim() : undefined,
          provider: u.provider,
          role,
          roles: roleContext?.roles ?? ['USER'],
          permissions: roleContext?.permissions ?? [],
          streamerId: roleContext?.streamerId ?? undefined,
          twitchId: u.twitchId ?? undefined,
          wins: w?.wins ?? 0,
          gamesPlayed: w?.gamesPlayed ?? 0,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }
      })
      res.json({ databaseConfigured: true, users })
    } catch (e) {
      console.error('[admin] GET /api/admin/users', e)
      res.status(500).json({ error: 'server_error', users: [] })
    }
  })

  app.get('/api/admin/users/:userId/activity', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({
        databaseConfigured: false,
        summary: { lastSeenAt: null, totalSessions: 0, totalTimeSpentSeconds: 0, lastPath: null },
        gameSummary: { nadle: { gamesPlayed: 0, wins: 0, losses: 0, lastGameAt: null } },
        recentEvents: [],
        recentErrors: [],
      })
      return
    }
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    if (!userId) {
      res.status(400).json({ error: 'invalid_user_id' })
      return
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, twitchId: true },
      })
      if (!user) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const gameUserIds = [user.id, user.twitchId].filter((id): id is string => Boolean(id?.trim()))
      const [recentEvents, recentErrors, summaryEvents, nadleStats, lastNadleRound] = await Promise.all([
        prisma.userActivityEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_ACTIVITY_LIMIT,
          select: { event: true, path: true, metadata: true, createdAt: true },
        }),
        prisma.clientErrorEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: RECENT_ACTIVITY_LIMIT,
          select: { message: true, path: true, source: true, metadata: true, createdAt: true },
        }),
        prisma.userActivityEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_SUMMARY_EVENT_LIMIT,
          select: { sessionId: true, path: true, createdAt: true },
        }),
        prisma.userStreamerStats.aggregate({
          where: { userId },
          _sum: { gamesPlayed: true, wins: true },
        }),
        prisma.gameRound.findFirst({
          where: {
            streamerId: { not: null },
            results: { some: { userId: { in: gameUserIds } } },
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ])
      const wins = nadleStats._sum.wins ?? 0
      const gamesPlayed = nadleStats._sum.gamesPlayed ?? 0
      res.json({
        databaseConfigured: true,
        summary: summarizeActivity(summaryEvents, recentErrors[0]?.createdAt ?? null),
        gameSummary: {
          nadle: {
            gamesPlayed,
            wins,
            losses: Math.max(0, gamesPlayed - wins),
            lastGameAt: toIso(lastNadleRound?.createdAt),
          },
        },
        recentEvents: recentEvents.map((event) => ({
          event: event.event,
          path: event.path,
          createdAt: event.createdAt.toISOString(),
          metadata: event.metadata ?? null,
        })),
        recentErrors: recentErrors.map((event) => ({
          message: event.message,
          path: event.path,
          source: event.source,
          createdAt: event.createdAt.toISOString(),
          metadata: event.metadata ?? null,
        })),
      })
    } catch (e) {
      console.error('[admin] GET /api/admin/users/:userId/activity', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.patch('/api/admin/users/:userId/role', adminMutationRateLimit, async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const body = req.body as { role?: unknown; roles?: unknown; permissions?: unknown; streamerId?: unknown }
    const nextRole = typeof body.role === 'string' ? body.role.trim() : ''
    const roles = parseSystemRoles(body.roles)
    const permissions = parseFeaturePermissions(body.permissions)
    const legacyEatFirstOperator =
      nextRole === 'host' ||
      (Array.isArray(body.roles) && body.roles.includes('HOST')) ||
      (Array.isArray(body.permissions) && body.permissions.includes('EAT_FIRST_OPERATOR'))
    if (
      !userId ||
      (!roles && !permissions && !legacyEatFirstOperator && nextRole !== 'user' && nextRole !== 'host' && nextRole !== 'admin')
    ) {
      res.status(400).json({ error: 'invalid_role' })
      return
    }
    try {
      const actorUserId = await resolveActorUserId(req)
      const current = await getUserRoles(userId)
      if (!current) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const nextRoles =
        roles ??
        (nextRole === 'admin'
          ? ['USER', 'ADMIN']
          : nextRole === 'host'
            ? ['USER']
            : ['USER'])
      const nextPermissions = permissions ?? (legacyEatFirstOperator ? ['EAT_FIRST_OPERATOR' as const] : [])
      if (!roles && current.roles.includes('STREAMER')) {
        nextRoles.push('STREAMER')
      }
      const streamerId = typeof body.streamerId === 'string' ? body.streamerId.trim() : null
      const result = await setUserRoles({
        actorUserId,
        userId,
        roles: nextRoles,
        permissions: nextPermissions,
        streamerId,
      })
      if (!result.ok) {
        res.status(result.status).json({ error: result.error })
        return
      }
      const before = current.roles
      const after = result.roles
      await logAdminAudit(req, {
        actorUserId,
        targetUserId: userId,
        action: 'user.roles.set',
        metadata: {
          before,
          after,
          permissionsBefore: current.permissions,
          permissionsAfter: result.permissions,
          added: after.filter((role) => !before.includes(role)),
          removed: before.filter((role) => !after.includes(role)),
          permissionsAdded: result.permissions.filter((permission) => !current.permissions.includes(permission)),
          permissionsRemoved: current.permissions.filter((permission) => !result.permissions.includes(permission)),
          streamerId: result.streamerId,
        },
      })
      res.json({ roles: result.roles, permissions: result.permissions, streamerId: result.streamerId })
    } catch (e) {
      console.error('[admin] PATCH /api/admin/users/:userId/role', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/api/admin/stats', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({
        databaseConfigured: false,
        userCount: 0,
        nadleRounds: 0,
        totalWinsRecorded: 0,
        totalGamesPlayed: 0,
        topWins: [] as { displayName: string; wins: number; userId: string }[],
        topRating: [] as { displayName: string; rating: number; userId: string }[],
      })
      return
    }
    try {
      const [userCount, nadleRounds, agg, topWinnersRaw, statsGrouped] = await Promise.all([
        prisma.user.count(),
        prisma.gameRound.count(),
        prisma.userStreamerStats.aggregate({ _sum: { wins: true, gamesPlayed: true } }),
        prisma.$queryRaw<Array<{ userId: string; displayName: string; wins: number }>>(
          Prisma.sql`
            SELECT u."id" AS "userId", u."displayName", SUM(uss."wins")::int AS wins
            FROM "UserStreamerStats" uss
            INNER JOIN "User" u ON u.id = uss."userId"
            GROUP BY u.id, u."displayName"
            ORDER BY SUM(uss."wins") DESC
            LIMIT 8
          `,
        ),
        prisma.userStreamerStats.groupBy({
          by: ['userId'],
          _sum: { wins: true, gamesPlayed: true },
        }),
      ])

      const topWins = topWinnersRaw.map((r) => ({
        userId: r.userId,
        displayName: r.displayName,
        wins: r.wins,
      }))

      const rated = statsGrouped
        .map((g) => {
          const wins = g._sum.wins ?? 0
          const played = g._sum.gamesPlayed ?? 0
          const losses = Math.max(0, played - wins)
          return {
            userId: g.userId,
            displayName: g.userId,
            rating: wins - losses,
            wins,
            losses,
          }
        })
        .filter((x) => x.wins + x.losses > 0)
        .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
        .slice(0, 8)

      const displayNames = await prisma.user.findMany({
        where: { id: { in: rated.map((r) => r.userId) } },
        select: { id: true, displayName: true },
      })
      const nameById = new Map(displayNames.map((u) => [u.id, u.displayName]))
      for (const r of rated) {
        r.displayName = nameById.get(r.userId) ?? r.userId
      }

      res.json({
        databaseConfigured: true,
        userCount,
        nadleRounds,
        totalWinsRecorded: agg._sum.wins ?? 0,
        totalGamesPlayed: agg._sum.gamesPlayed ?? 0,
        topWins,
        topRating: rated,
      })
    } catch (e) {
      console.error('[admin] GET /api/admin/stats', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  /**
   * Anonymous-visitor analytics over existing `UserActivityEvent` rows
   * where `userId IS NULL` (signed-out sessions). NO new event capture is
   * introduced — this endpoint only aggregates what the client already
   * sends to `/api/events/client` (allowlisted events: route_change,
   * game_opened, …). The `sessionId` is the sessionStorage-scoped
   * pseudonym from `clientAnalytics.ts`; admins see only aggregates.
   *
   * Range defaults to last 7 days; clamped to 90 days to match the
   * existing retention reaper (`clientEventsRouter.ts:RETENTION_DAYS`).
   *
   * Returns `databaseConfigured: false` when the DB is offline,
   * mirroring the rest of the admin handlers.
   */
  app.get('/api/admin/analytics/anonymous', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({
        databaseConfigured: false,
        range: { from: null, to: null },
        sessions: { total: 0, bounceRate: 0, avgDurationSec: 0 },
        visitors24h: 0,
        visitors7d: 0,
        visitors30d: 0,
        activeNow: 0,
        topRoutes: [],
        topEvents: [],
      })
      return
    }
    const now = Date.now()
    const ANALYTICS_MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000
    const ANALYTICS_DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000
    const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000
    const SHORT_SESSION_MAX_MS = 30 * 1000

    const fromRaw = parseAdminDateParam(req.query.dateFrom)
    const toRaw = parseAdminDateParam(req.query.dateTo)
    /**
     * Range derivation: both / from-only / to-only / neither — always
     * clamped to a 90-day window. Invalid input is ignored, not 400'd, so
     * a partially-typed `datetime-local` value never bricks the panel.
     */
    let toMs = toRaw ? toRaw.getTime() : now
    let fromMs = fromRaw ? fromRaw.getTime() : toMs - ANALYTICS_DEFAULT_RANGE_MS
    if (fromMs > toMs) {
      const swap = fromMs
      fromMs = toMs
      toMs = swap
    }
    if (toMs - fromMs > ANALYTICS_MAX_RANGE_MS) {
      fromMs = toMs - ANALYTICS_MAX_RANGE_MS
    }
    const from = new Date(fromMs)
    const to = new Date(toMs)

    const topRoutesRaw = req.query.topRoutes
    const topRoutesN = (() => {
      const parsed =
        typeof topRoutesRaw === 'string' ? Number.parseInt(topRoutesRaw, 10) : Number.NaN
      if (!Number.isFinite(parsed)) return 10
      return Math.max(1, Math.min(50, Math.floor(parsed)))
    })()

    const baseWhere: Prisma.UserActivityEventWhereInput = {
      userId: null,
      sessionId: { not: null },
      createdAt: { gte: from, lte: to },
    }
    const cutoff24h = new Date(now - 24 * 60 * 60 * 1000)
    const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const cutoff30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const activeCutoff = new Date(now - ACTIVE_NOW_WINDOW_MS)

    try {
      /**
       * Per-session aggregates: each anonymous session contributes one row
       * with min/max `createdAt` (= session start/end) and event count.
       * `groupBy` on `sessionId` uses the existing `@@index([createdAt])`
       * scan with the `userId IS NULL` predicate applied as a filter.
       *
       * For very large ranges this could return many session rows; the
       * 90-day clamp + existing 90-day retention keep this bounded under
       * realistic traffic. If scale ever requires it, swap this for a raw
       * SQL aggregate that returns only the four numbers below.
       */
      const sessionAgg = await prisma.userActivityEvent.groupBy({
        by: ['sessionId'],
        where: baseWhere,
        _min: { createdAt: true },
        _max: { createdAt: true },
        _count: { _all: true },
      })

      let totalSessions = 0
      let totalDurationMs = 0
      let bounces = 0
      let activeNow = 0
      for (const row of sessionAgg) {
        if (!row.sessionId) continue
        totalSessions += 1
        const min = row._min.createdAt
        const max = row._max.createdAt
        const durationMs = min && max ? Math.max(0, max.getTime() - min.getTime()) : 0
        totalDurationMs += durationMs
        const eventCount = row._count._all
        if (eventCount <= 1 || durationMs <= SHORT_SESSION_MAX_MS) {
          bounces += 1
        }
        if (max && max.getTime() >= activeCutoff.getTime()) {
          activeNow += 1
        }
      }
      const avgDurationSec =
        totalSessions > 0 ? Math.round(totalDurationMs / totalSessions / 1000) : 0
      const bounceRate = totalSessions > 0 ? bounces / totalSessions : 0

      /**
       * Visitor windows (24h / 7d / 30d) regardless of the user-selected
       * range. Raw SQL with PostgreSQL `FILTER` so all three counts come
       * back in one round trip. Anonymous + non-null sessionId predicate
       * applied uniformly; broadest window (30d) bounds the scan.
       */
      const visitorRows = await prisma.$queryRaw<
        Array<{ v24h: number | bigint; v7d: number | bigint; v30d: number | bigint }>
      >(Prisma.sql`
        SELECT
          COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${cutoff24h}) AS "v24h",
          COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${cutoff7d}) AS "v7d",
          COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${cutoff30d}) AS "v30d"
        FROM "UserActivityEvent"
        WHERE "userId" IS NULL
          AND "sessionId" IS NOT NULL
          AND "createdAt" >= ${cutoff30d}
      `)
      const visitorRow = visitorRows[0]
      const toInt = (v: number | bigint | undefined): number =>
        typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : 0
      const visitors24h = toInt(visitorRow?.v24h)
      const visitors7d = toInt(visitorRow?.v7d)
      const visitors30d = toInt(visitorRow?.v30d)

      /**
       * Top routes by event volume within the selected range. `sessions`
       * is `COUNT(DISTINCT sessionId)` per path — same predicate as the
       * session aggregate above. Limit clamped to 1..50.
       */
      const topRoutesRows = await prisma.$queryRaw<
        Array<{ path: string | null; events: number | bigint; sessions: number | bigint }>
      >(Prisma.sql`
        SELECT
          "path",
          COUNT(*) AS "events",
          COUNT(DISTINCT "sessionId") AS "sessions"
        FROM "UserActivityEvent"
        WHERE "userId" IS NULL
          AND "sessionId" IS NOT NULL
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND "path" IS NOT NULL
        GROUP BY "path"
        ORDER BY "events" DESC
        LIMIT ${topRoutesN}
      `)
      const topRoutes = topRoutesRows
        .filter((r) => typeof r.path === 'string' && r.path.length > 0)
        .map((r) => ({
          path: r.path as string,
          events: toInt(r.events),
          sessions: toInt(r.sessions),
        }))

      /**
       * Top events by count within the selected range. Plain Prisma
       * `groupBy` is enough — `event` is the allowlisted enum-ish field
       * (route_change, game_opened, …) and there are at most a handful.
       */
      const topEventsAgg = await prisma.userActivityEvent.groupBy({
        by: ['event'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { _count: { event: 'desc' } },
        take: 20,
      })
      const topEvents = topEventsAgg.map((r) => ({
        event: r.event,
        count: r._count._all,
      }))

      res.setHeader('Cache-Control', 'no-store')
      res.json({
        databaseConfigured: true,
        range: { from: from.toISOString(), to: to.toISOString() },
        sessions: {
          total: totalSessions,
          bounceRate,
          avgDurationSec,
        },
        visitors24h,
        visitors7d,
        visitors30d,
        activeNow,
        topRoutes,
        topEvents,
      })
    } catch (e) {
      console.error('[admin] GET /api/admin/analytics/anonymous', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/api/admin/streamers', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({ databaseConfigured: false, streamers: [] })
      return
    }
    try {
      const rows = await prisma.streamer.findMany({
        orderBy: { name: 'asc' },
        take: 200,
        select: {
          id: true,
          name: true,
          username: true,
          twitchId: true,
          isActive: true,
          ownerId: true,
          owner: { select: { id: true, displayName: true, email: true } },
        },
      })
      res.json({ databaseConfigured: true, streamers: rows })
    } catch (e) {
      console.error('[admin] GET /api/admin/streamers', e)
      res.status(500).json({ error: 'server_error', streamers: [] })
    }
  })

  app.post('/api/admin/streamers', adminMutationRateLimit, async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const body = req.body as { name?: unknown; ownerId?: unknown }
    const rawName = typeof body.name === 'string' ? body.name : ''
    const ownerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : ''
    const name = normalizeTwitchLogin(rawName)
    if (!name) {
      res.status(400).json({ error: 'invalid_name' })
      return
    }
    if (!ownerId) {
      res.status(400).json({ error: 'owner_required' })
      return
    }
    try {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, twitchId: true },
      })
      if (!owner) {
        res.status(400).json({ error: 'owner_not_found' })
        return
      }
      if (!owner.twitchId || !owner.twitchId.trim()) {
        res.status(400).json({ error: 'owner_twitch_required', message: 'Owner must have linked Twitch id for IRC ingest' })
        return
      }
      const twitchId = owner.twitchId.trim()
      const twitchTaken = await prisma.streamer.findFirst({
        where: { twitchId },
        select: { id: true },
      })
      if (twitchTaken) {
        res.status(409).json({ error: 'twitch_id_already_streamer' })
        return
      }
      const streamer = await prisma.streamer.create({
        data: {
          name,
          username: name,
          twitchId,
          ownerId: owner.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          username: true,
          twitchId: true,
          isActive: true,
          ownerId: true,
        },
      })
      await prisma.user.update({
        where: { id: owner.id },
        data: { streamerId: streamer.id },
      })
      await prisma.streamerMember.upsert({
        where: {
          userId_streamerId: {
            userId: owner.id,
            streamerId: streamer.id,
          },
        },
        create: { userId: owner.id, streamerId: streamer.id, role: 'OWNER' },
        update: { role: 'OWNER' },
      })
      await logAdminAudit(req, {
        actorUserId: await resolveActorUserId(req),
        targetUserId: owner.id,
        targetStreamerId: streamer.id,
        action: 'streamer.create',
        metadata: {
          name,
          username: streamer.username,
          twitchId: streamer.twitchId,
          ownerId: owner.id,
        },
      })
      res.status(201).json(streamer)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        res.status(409).json({ error: 'duplicate_name_or_username' })
        return
      }
      console.error('[admin] POST /api/admin/streamers', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.delete('/api/admin/streamers/:id', adminMutationRateLimit, async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      res.status(400).json({ error: 'invalid_id' })
      return
    }
    try {
      const streamer = await prisma.streamer.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, name: true, username: true, twitchId: true, ownerId: true, isActive: true },
      })
      await logAdminAudit(req, {
        actorUserId: await resolveActorUserId(req),
        targetUserId: streamer.ownerId,
        targetStreamerId: streamer.id,
        action: 'streamer.deactivate',
        metadata: {
          name: streamer.name,
          username: streamer.username,
          twitchId: streamer.twitchId,
          isActive: streamer.isActive,
        },
      })
      res.status(204).end()
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        res.status(404).json({ error: 'not_found' })
        return
      }
      console.error('[admin] DELETE /api/admin/streamers/:id', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  /**
   * Block D1 — admin diagnostics export.
   *
   * Returns the in-memory `GameSessionReport` snapshot for one bucket.
   * Accepted bucket keys:
   *   - signaling room id (e.g. `mafia:foo`, `gameroom:bar`, `eat:baz`)
   *   - synthetic session bucket key (`session:<analyticsSessionId>`)
   *     for client errors that fired without a room correlation
   *
   * `Cache-Control: no-store` because the report is a fresh snapshot.
   * `?download=1` adds an attachment Content-Disposition for direct
   * file download from the browser address bar.
   */
  app.get('/api/admin/rooms/:roomId/diagnostics', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    const rawRoomId = typeof req.params.roomId === 'string' ? req.params.roomId : ''
    const roomId = rawRoomId.trim().slice(0, ROOM_ID_MAX_LENGTH)
    if (!roomId) {
      res.status(400).json({ error: 'invalid_room_id' })
      return
    }
    const snapshot = snapshotRoomDiagnostics(roomId)
    const isSessionBucket = roomId.startsWith(BUCKET_PREFIX_SESSION)
    const report = buildGameSessionReport(roomId, snapshot, {
      isSessionBucket,
      exportedBy: 'admin',
    })
    res.setHeader('Cache-Control', 'no-store')
    if (req.query.download === '1') {
      const safeName = roomId
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, DIAGNOSTIC_FILENAME_SLUG_MAX_LENGTH)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="diagnostics-${safeName}.json"`,
      )
    }
    res.json(report)
  })
}

/* The inline GameSessionReport builder lives in
 * `signaling/roomDiagnosticsReport.ts` (D1.3) so the persistence layer
 * and the live admin route share one source of truth. */
