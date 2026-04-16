import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { readSessionFromCookie, type SessionPayload } from './auth/session/sessionJwt'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

type ParticipantRow = {
  userId: string
  isWinner: boolean
  roundCreatedAt: Date
}

/** Resolve `?streamerId=` or Twitch login `?streamer=` to an active Streamer id. */
async function resolveStreamerScopeFromQuery(req: Request): Promise<string | null> {
  const q = req.query
  const sid = typeof q.streamerId === 'string' ? q.streamerId.trim() : ''
  if (sid.length > 0) {
    const row = await prisma.streamer.findFirst({
      where: { id: sid, isActive: true },
      select: { id: true },
    })
    return row?.id ?? null
  }
  const raw = typeof q.streamer === 'string' ? q.streamer.trim().toLowerCase().replace(/^#/, '') : ''
  if (raw.length < 2 || raw.length > 25 || !/^[a-z0-9_]+$/.test(raw)) {
    return null
  }
  const row = await prisma.streamer.findFirst({
    where: { isActive: true, OR: [{ name: raw }, { username: raw }] },
    select: { id: true },
  })
  return row?.id ?? null
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

async function winsLeaderboardGlobal(): Promise<
  Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; wins: number }>
> {
  const grouped = await prisma.userStreamerStats.groupBy({
    by: ['userId'],
    _sum: { wins: true },
    having: { wins: { _sum: { gt: 0 } } },
    orderBy: { _sum: { wins: 'desc' } },
    take: 100,
  })
  const sorted = [...grouped].sort(
    (a, b) =>
      (b._sum.wins ?? 0) - (a._sum.wins ?? 0) || a.userId.localeCompare(b.userId),
  )
  const display = await buildParticipantDisplayMap(sorted.map((g) => g.userId))
  return sorted.map((g, i) => ({
    rank: i + 1,
    userId: g.userId,
    displayName: display.get(g.userId)?.displayName ?? g.userId,
    avatarUrl: display.get(g.userId)?.avatarUrl ?? null,
    wins: g._sum.wins ?? 0,
  }))
}

async function winsLeaderboardForStreamer(
  streamerId: string,
): Promise<Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; wins: number }>> {
  const rows = await prisma.userStreamerStats.findMany({
    where: { streamerId, wins: { gt: 0 } },
    orderBy: [{ wins: 'desc' }, { userId: 'asc' }],
    take: 100,
    include: { user: { select: { displayName: true, avatarUrl: true } } },
  })
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    displayName: r.user.displayName,
    avatarUrl: r.user.avatarUrl,
    wins: r.wins,
  }))
}

async function streakLeaderboardGlobal(): Promise<
  Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; streak: number }>
> {
  const raw = await prisma.gameResult.findMany({
    select: {
      userId: true,
      isWinner: true,
      round: { select: { createdAt: true } },
    },
  })
  return streakFromRows(raw)
}

async function streakLeaderboardForStreamer(
  streamerId: string,
): Promise<Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; streak: number }>> {
  const flat = await prisma.$queryRaw<Array<{ userId: string; isWinner: boolean; createdAt: Date }>>(
    Prisma.sql`
      SELECT gr."userId", gr."isWinner", g."createdAt" AS "createdAt"
      FROM "GameResult" gr
      INNER JOIN "GameRound" g ON g.id = gr."roundId"
      WHERE g."streamerId" = ${streamerId}
    `,
  )
  const raw = flat.map((r) => ({
    userId: r.userId,
    isWinner: r.isWinner,
    round: { createdAt: r.createdAt },
  }))
  return streakFromRows(raw)
}

async function streakFromRows(
  raw: Array<{ userId: string; isWinner: boolean; round: { createdAt: Date } }>,
): Promise<Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; streak: number }>> {
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

  return scored.map((s, i) => {
    const d = display.get(s.userId)
    return {
      rank: i + 1,
      userId: s.userId,
      displayName: d?.displayName ?? s.userId,
      avatarUrl: d?.avatarUrl ?? null,
      streak: s.streak,
    }
  })
}

async function ratingLeaderboardGlobal(): Promise<
  Array<{
    rank: number
    userId: string
    displayName: string
    avatarUrl: string | null
    rating: number
    wins: number
    losses: number
  }>
> {
  const grouped = await prisma.userStreamerStats.groupBy({
    by: ['userId'],
    _sum: { wins: true, gamesPlayed: true },
  })

  const scored = grouped
    .map((g) => {
      const wins = g._sum.wins ?? 0
      const played = g._sum.gamesPlayed ?? 0
      const losses = Math.max(0, played - wins)
      const rating = wins - losses
      return { userId: g.userId, wins, played, losses, rating }
    })
    .filter((x) => x.played > 0)
    .sort(
      (a, b) =>
        b.rating - a.rating || b.wins - a.wins || a.userId.localeCompare(b.userId),
    )
    .slice(0, 100)

  const display = await buildParticipantDisplayMap(scored.map((s) => s.userId))

  return scored.map((x, i) => ({
    rank: i + 1,
    userId: x.userId,
    displayName: display.get(x.userId)?.displayName ?? x.userId,
    avatarUrl: display.get(x.userId)?.avatarUrl ?? null,
    rating: x.rating,
    wins: x.wins,
    losses: x.losses,
  }))
}

async function ratingLeaderboardForStreamer(streamerId: string): Promise<
  Array<{
    rank: number
    userId: string
    displayName: string
    avatarUrl: string | null
    rating: number
    wins: number
    losses: number
  }>
> {
  const rows = await prisma.userStreamerStats.findMany({
    where: { streamerId, gamesPlayed: { gt: 0 } },
    include: { user: { select: { displayName: true, avatarUrl: true } } },
  })

  const scored = rows
    .map((r) => {
      const wins = r.wins
      const played = r.gamesPlayed
      const losses = Math.max(0, played - wins)
      return {
        userId: r.userId,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
        wins,
        played,
        losses,
        rating: wins - losses,
      }
    })
    .sort(
      (a, b) =>
        b.rating - a.rating || b.wins - a.wins || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, 100)

  return scored.map((x, i) => ({
    rank: i + 1,
    userId: x.userId,
    displayName: x.displayName,
    avatarUrl: x.avatarUrl,
    rating: x.rating,
    wins: x.wins,
    losses: x.losses,
  }))
}

async function resolvePrismaUserIdForSession(session: SessionPayload): Promise<string | null> {
  const byId = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true },
  })
  if (byId) {
    return byId.id
  }
  const tid =
    session.provider === 'twitch'
      ? typeof session.twitch_id === 'string' && session.twitch_id.length > 0
        ? session.twitch_id
        : session.id
      : null
  if (typeof tid === 'string' && tid.length > 0) {
    const byTwitch = await prisma.user.findFirst({
      where: { twitchId: tid },
      select: { id: true },
    })
    return byTwitch?.id ?? null
  }
  return null
}

export function mountLeaderboardRoutes(app: Express): void {
  /**
   * Records a solo Wordle win for the signed-in Prisma user (OAuth-linked row).
   * Body: { streamerId, attempts } — increments UserStreamerStats (gamesPlayed + wins).
   */
  app.post('/api/wins', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const session = readSessionFromCookie(req.headers.cookie)
    if (!session) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    const userId = await resolvePrismaUserIdForSession(session)
    if (!userId) {
      res.status(403).json({ error: 'account_not_linked' })
      return
    }
    const body = req.body as { streamerId?: unknown; attempts?: unknown }
    const streamerId = typeof body.streamerId === 'string' ? body.streamerId.trim() : ''
    const attemptsRaw = body.attempts
    const attempts =
      typeof attemptsRaw === 'number' && Number.isFinite(attemptsRaw)
        ? Math.round(attemptsRaw)
        : typeof attemptsRaw === 'string'
          ? Number.parseInt(attemptsRaw, 10)
          : NaN
    if (!streamerId || !Number.isFinite(attempts) || attempts < 1 || attempts > 6) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }
    try {
      const streamer = await prisma.streamer.findFirst({
        where: { id: streamerId, isActive: true },
        select: { id: true },
      })
      if (!streamer) {
        res.status(404).json({ error: 'streamer_not_found' })
        return
      }
      await prisma.userStreamerStats.upsert({
        where: {
          userId_streamerId: { userId, streamerId },
        },
        create: {
          userId,
          streamerId,
          gamesPlayed: 1,
          wins: 1,
        },
        update: {
          gamesPlayed: { increment: 1 },
          wins: { increment: 1 },
        },
      })
      res.status(204).end()
    } catch (e) {
      console.error('[leaderboard] POST /api/wins', e)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.get('/api/leaderboard/wins', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const scope = await resolveStreamerScopeFromQuery(req)
      const entries = scope ? await winsLeaderboardForStreamer(scope) : await winsLeaderboardGlobal()
      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/wins', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })

  app.get('/api/leaderboard/streak', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const scope = await resolveStreamerScopeFromQuery(req)
      const entries = scope ? await streakLeaderboardForStreamer(scope) : await streakLeaderboardGlobal()
      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/streak', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })

  /** Рейтинг: +1 за перемогу, −1 за поразку (wins − (gamesPlayed − wins)). */
  app.get('/api/leaderboard/rating', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const scope = await resolveStreamerScopeFromQuery(req)
      const entries = scope ? await ratingLeaderboardForStreamer(scope) : await ratingLeaderboardGlobal()
      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/rating', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })
}
