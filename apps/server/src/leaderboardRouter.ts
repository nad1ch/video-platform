import type { Express, Request, Response } from 'express'
import { prisma } from './prisma'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

type ParticipantRow = {
  userId: string
  isWinner: boolean
  roundCreatedAt: Date
}

async function buildParticipantDisplayMap(
  participantIds: string[],
): Promise<Map<string, { displayName: string; avatarUrl: string | null }>> {
  const uniq = [...new Set(participantIds.filter((x) => x.length > 0))]
  if (uniq.length === 0) {
    return new Map()
  }
  const users = await prisma.user.findMany({
    where: {
      OR: [{ id: { in: uniq } }, { twitchId: { in: uniq } }],
    },
    select: { id: true, twitchId: true, displayName: true, avatarUrl: true },
  })
  const map = new Map<string, { displayName: string; avatarUrl: string | null }>()
  for (const u of users) {
    const row = { displayName: u.displayName, avatarUrl: u.avatarUrl }
    map.set(u.id, row)
    if (u.twitchId) {
      map.set(u.twitchId, row)
    }
  }
  return map
}

function consecutiveWinStreakFromNewestFirst(rows: { isWinner: boolean }[]): number {
  let n = 0
  for (const r of rows) {
    if (!r.isWinner) {
      break
    }
    n += 1
  }
  return n
}

export function mountLeaderboardRoutes(app: Express): void {
  app.get('/api/leaderboard/wins', async (_req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const users = await prisma.user.findMany({
        where: { stats: { isNot: null } },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          stats: { select: { wins: true } },
        },
        orderBy: { stats: { wins: 'desc' } },
        take: 100,
      })
      const entries = users.map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        wins: u.stats?.wins ?? 0,
      }))
      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/wins', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })

  app.get('/api/leaderboard/streak', async (_req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const raw = await prisma.gameResult.findMany({
        select: {
          userId: true,
          isWinner: true,
          round: { select: { createdAt: true } },
        },
      })

      const rows: ParticipantRow[] = raw.map((r) => ({
        userId: r.userId,
        isWinner: r.isWinner,
        roundCreatedAt: r.round.createdAt,
      }))

      const byUser = new Map<string, ParticipantRow[]>()
      for (const r of rows) {
        const list = byUser.get(r.userId)
        if (list) {
          list.push(r)
        } else {
          byUser.set(r.userId, [r])
        }
      }

      for (const list of byUser.values()) {
        list.sort((a, b) => b.roundCreatedAt.getTime() - a.roundCreatedAt.getTime())
      }

      const scored = [...byUser.entries()]
        .map(([userId, list]) => ({
          userId,
          streak: consecutiveWinStreakFromNewestFirst(list),
        }))
        .filter((x) => x.streak > 0)
        .sort((a, b) => b.streak - a.streak || a.userId.localeCompare(b.userId))
        .slice(0, 100)

      const display = await buildParticipantDisplayMap(scored.map((s) => s.userId))

      const entries = scored.map((s, i) => {
        const d = display.get(s.userId)
        return {
          rank: i + 1,
          userId: s.userId,
          displayName: d?.displayName ?? s.userId,
          avatarUrl: d?.avatarUrl ?? null,
          streak: s.streak,
        }
      })

      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/streak', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })

  /** Рейтинг: +1 за перемогу, −1 за поразку (wins − (gamesPlayed − wins)). */
  app.get('/api/leaderboard/rating', async (_req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const users = await prisma.user.findMany({
        where: { stats: { isNot: null } },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          stats: { select: { wins: true, gamesPlayed: true } },
        },
      })

      const scored = users
        .map((u) => {
          const wins = u.stats?.wins ?? 0
          const played = u.stats?.gamesPlayed ?? 0
          const losses = Math.max(0, played - wins)
          const rating = wins - losses
          return { u, wins, played, losses, rating }
        })
        .filter((x) => x.played > 0)
        .sort(
          (a, b) =>
            b.rating - a.rating || b.wins - a.wins || a.u.displayName.localeCompare(b.u.displayName),
        )
        .slice(0, 100)

      const entries = scored.map((x, i) => ({
        rank: i + 1,
        userId: x.u.id,
        displayName: x.u.displayName,
        avatarUrl: x.u.avatarUrl,
        rating: x.rating,
        wins: x.wins,
        losses: x.losses,
      }))

      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/rating', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })
}
