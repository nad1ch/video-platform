import type { Express, Request, Response } from 'express'
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
      const rows = await prisma.user.findMany({
        take: 250,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          provider: true,
          role: true,
          stats: { select: { wins: true, gamesPlayed: true } },
        },
      })
      const users = rows.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatar: u.avatarUrl?.trim() ? u.avatarUrl.trim() : undefined,
        provider: u.provider,
        role: u.role === 'admin' ? 'admin' : 'user',
        wins: u.stats?.wins ?? 0,
        gamesPlayed: u.stats?.gamesPlayed ?? 0,
      }))
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
      const [userCount, wordleRounds, agg, topWinners, statsRows] = await Promise.all([
        prisma.user.count(),
        prisma.gameRound.count(),
        prisma.userStats.aggregate({ _sum: { wins: true, gamesPlayed: true } }),
        prisma.user.findMany({
          where: { stats: { isNot: null } },
          orderBy: { stats: { wins: 'desc' } },
          take: 8,
          select: {
            id: true,
            displayName: true,
            stats: { select: { wins: true, gamesPlayed: true } },
          },
        }),
        prisma.user.findMany({
          where: { stats: { isNot: null } },
          select: {
            id: true,
            displayName: true,
            stats: { select: { wins: true, gamesPlayed: true } },
          },
        }),
      ])

      const topWins = topWinners.map((u) => ({
        userId: u.id,
        displayName: u.displayName,
        wins: u.stats?.wins ?? 0,
      }))

      const rated = statsRows
        .map((u) => {
          const wins = u.stats?.wins ?? 0
          const played = u.stats?.gamesPlayed ?? 0
          const losses = Math.max(0, played - wins)
          return {
            userId: u.id,
            displayName: u.displayName,
            rating: wins - losses,
            wins,
            losses,
          }
        })
        .filter((x) => x.wins + x.losses > 0)
        .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
        .slice(0, 8)

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
