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
        return {
          id: u.id,
          displayName: u.displayName,
          avatar: u.avatarUrl?.trim() ? u.avatarUrl.trim() : undefined,
          provider: u.provider,
          role: u.role === 'admin' ? 'admin' : 'user',
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
}
