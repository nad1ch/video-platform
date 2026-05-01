import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from './prisma'
import { isSessionAdminFromCookie } from './auth/session/isAdminRequest'
import { resolvePrismaUserIdFromSession } from './auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from './auth/session/sessionJwt'
import { getUserRoles, parseSystemRoles, setUserRoles } from './auth/userRoles'

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
      const [rows, userStatsAgg] = await Promise.all([
        prisma.user.findMany({
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

  app.patch('/api/admin/users/:userId/role', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const body = req.body as { role?: unknown; roles?: unknown; streamerId?: unknown }
    const nextRole = typeof body.role === 'string' ? body.role.trim() : ''
    const roles = parseSystemRoles(body.roles)
    if (!userId || (!roles && nextRole !== 'user' && nextRole !== 'host' && nextRole !== 'admin')) {
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
            ? ['USER', 'HOST']
            : ['USER'])
      if (!roles && current.roles.includes('STREAMER')) {
        nextRoles.push('STREAMER')
      }
      const streamerId = typeof body.streamerId === 'string' ? body.streamerId.trim() : null
      const result = await setUserRoles({
        actorUserId,
        userId,
        roles: nextRoles,
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
          added: after.filter((role) => !before.includes(role)),
          removed: before.filter((role) => !after.includes(role)),
          streamerId: result.streamerId,
        },
      })
      res.json({ roles: result.roles, streamerId: result.streamerId })
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

  app.post('/api/admin/streamers', async (req: Request, res: Response) => {
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
    const name = rawName.trim().replace(/^#/, '').toLowerCase()
    if (name.length < 2 || name.length > 25 || !/^[a-z0-9_]+$/.test(name)) {
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

  app.delete('/api/admin/streamers/:id', async (req: Request, res: Response) => {
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
}
