import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { isSessionAdminFromCookie } from './auth/session/isAdminRequest'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!isSessionAdminFromCookie(req.headers.cookie)) {
    res.status(403).json({ error: 'forbidden', message: 'Admin only' })
    return false
  }
  return true
}

export function mountAdminRoutes(app: Express): void {
  app.get('/api/admin/users', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({ databaseConfigured: false, users: [] })
      return
    }
    try {
      const [rows, wordleAgg] = await Promise.all([
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
          },
        }),
        prisma.userStreamerStats.groupBy({
          by: ['userId'],
          _sum: { wins: true, gamesPlayed: true },
        }),
      ])
      const wordleByUser = new Map(
        wordleAgg.map((g) => [
          g.userId,
          { wins: g._sum.wins ?? 0, gamesPlayed: g._sum.gamesPlayed ?? 0 },
        ]),
      )
      const users = rows.map((u) => {
        const w = wordleByUser.get(u.id)
        const role =
          u.role === 'admin' ? 'admin' : u.role === 'host' ? 'host' : 'user'
        return {
          id: u.id,
          displayName: u.displayName,
          avatar: u.avatarUrl?.trim() ? u.avatarUrl.trim() : undefined,
          provider: u.provider,
          role,
          twitchId: u.twitchId ?? undefined,
          wins: w?.wins ?? 0,
          gamesPlayed: w?.gamesPlayed ?? 0,
        }
      })
      res.json({ databaseConfigured: true, users })
    } catch (e) {
      console.error('[admin] GET /api/admin/users', e)
      res.status(500).json({ error: 'server_error', users: [] })
    }
  })

  app.patch('/api/admin/users/:userId/role', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : ''
    const body = req.body as { role?: unknown }
    const nextRole = typeof body.role === 'string' ? body.role.trim() : ''
    if (!userId || (nextRole !== 'user' && nextRole !== 'host')) {
      res.status(400).json({ error: 'invalid_role' })
      return
    }
    try {
      const row = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
      if (!row) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (row.role === 'admin') {
        res.status(400).json({ error: 'cannot_change_admin_role' })
        return
      }
      await prisma.user.update({ where: { id: userId }, data: { role: nextRole } })
      res.status(204).end()
    } catch (e) {
      console.error('[admin] PATCH /api/admin/users/:userId/role', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/api/admin/stats', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return
    }
    if (!isDatabaseConfigured()) {
      res.json({
        databaseConfigured: false,
        userCount: 0,
        wordleRounds: 0,
        totalWinsRecorded: 0,
        totalGamesPlayed: 0,
        topWins: [] as { displayName: string; wins: number; userId: string }[],
        topRating: [] as { displayName: string; rating: number; userId: string }[],
      })
      return
    }
    try {
      const [userCount, wordleRounds, agg, topWinnersRaw, statsGrouped] = await Promise.all([
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
        wordleRounds,
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
    if (!requireAdmin(req, res)) {
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
    if (!requireAdmin(req, res)) {
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
    if (!requireAdmin(req, res)) {
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
      await prisma.streamer.delete({ where: { id } })
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
