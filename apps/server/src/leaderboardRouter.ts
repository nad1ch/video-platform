import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { resolvePrismaUserIdFromSession } from './auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from './auth/session/sessionJwt'

/** Matches `MAX_ATTEMPTS` in client `nadleLogic` / solo board rows. */
const SOLO_MAX_ATTEMPTS = 6

/** `GameRound.winnerUserId` when a solo round ends in a loss (player exhausted attempts). Not a real user id. */
const NADLE_SOLO_LOSS_PLACEHOLDER_WINNER = '__nadle_solo_loss__'

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

/**
 * Longest run of consecutive wins, in chronological round order (one entry per round the user played).
 * Losses reset the running count but not the recorded maximum.
 */
function maxConsecutiveWinStreakChronological(rows: { isWinner: boolean }[]): number {
  let run = 0
  let best = 0
  for (const r of rows) {
    if (r.isWinner) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
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
    list.sort((a, b) => a.roundCreatedAt.getTime() - b.roundCreatedAt.getTime())
  }

  const scored = [...byUser.entries()]
    .map(([userId, list]) => ({
      userId,
      streak: maxConsecutiveWinStreakChronological(list),
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

/** Best consecutive-win streak for this viewer on this streamer (matches `GameResult.userId` to prisma `id` or `twitchId`). */
async function viewerMaxWinStreakForStreamer(streamerId: string, prismaUserId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: prismaUserId },
    select: { id: true, twitchId: true },
  })
  if (!u) {
    return 0
  }
  const uniqKeys = [
    ...new Set(
      [u.id, u.twitchId].filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
    ),
  ]
  if (uniqKeys.length === 0) {
    return 0
  }
  const flat = await prisma.$queryRaw<Array<{ isWinner: boolean; createdAt: Date; roundId: string }>>(
    Prisma.sql`
      SELECT gr."isWinner", g."createdAt" AS "createdAt", g."id" AS "roundId"
      FROM "GameResult" gr
      INNER JOIN "GameRound" g ON g.id = gr."roundId"
      WHERE g."streamerId" = ${streamerId}
        AND gr."userId" IN (${Prisma.join(uniqKeys)})
    `,
  )
  const sorted = [...flat].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const seenRound = new Set<string>()
  const merged: { isWinner: boolean }[] = []
  for (const row of sorted) {
    if (seenRound.has(row.roundId)) {
      continue
    }
    seenRound.add(row.roundId)
    merged.push({ isWinner: row.isWinner })
  }
  return maxConsecutiveWinStreakChronological(merged)
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

export function mountLeaderboardRoutes(app: Express): void {
  /**
   * Records a solo nadle result for any signed-in user with a linked `User` row.
   * Body: { streamerId, result?: 'win' | 'lose', attempts } — rating uses wins − (gamesPlayed − wins).
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
    const userId = await resolvePrismaUserIdFromSession(session)
    if (!userId) {
      res.status(401).json({ error: 'account_not_linked' })
      return
    }
    const body = req.body as { streamerId?: unknown; attempts?: unknown; result?: unknown }
    const streamerId = typeof body.streamerId === 'string' ? body.streamerId.trim() : ''
    const attemptsRaw = body.attempts
    const attempts =
      typeof attemptsRaw === 'number' && Number.isFinite(attemptsRaw)
        ? Math.round(attemptsRaw)
        : typeof attemptsRaw === 'string'
          ? Number.parseInt(attemptsRaw, 10)
          : NaN
    const resultRaw = body.result
    const result =
      resultRaw === 'lose'
        ? 'lose'
        : resultRaw === 'win' || resultRaw === undefined
          ? 'win'
          : null
    if (result === null) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }
    if (!streamerId) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }
    if (result === 'win') {
      if (!Number.isFinite(attempts) || attempts < 1 || attempts > SOLO_MAX_ATTEMPTS) {
        res.status(400).json({ error: 'invalid_body' })
        return
      }
    } else if (!Number.isFinite(attempts) || attempts !== SOLO_MAX_ATTEMPTS) {
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
      const isWin = result === 'win'
      await prisma.$transaction(async (tx) => {
        if (isWin) {
          await tx.userStreamerStats.upsert({
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
        } else {
          await tx.userStreamerStats.upsert({
            where: {
              userId_streamerId: { userId, streamerId },
            },
            create: {
              userId,
              streamerId,
              gamesPlayed: 1,
              wins: 0,
            },
            update: {
              gamesPlayed: { increment: 1 },
            },
          })
        }
        const round = await tx.gameRound.create({
          data: {
            streamerId,
            winnerUserId: isWin ? userId : NADLE_SOLO_LOSS_PLACEHOLDER_WINNER,
          },
        })
        await tx.gameResult.create({
          data: {
            roundId: round.id,
            userId,
            attempts,
            isWinner: isWin,
          },
        })
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
      if (!scope) {
        res.json({ entries: [] })
        return
      }
      const entries = await winsLeaderboardForStreamer(scope)
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
      if (!scope) {
        res.json({ entries: [] })
        return
      }
      const entries = await streakLeaderboardForStreamer(scope)
      const session = readSessionFromCookie(req.headers.cookie)
      const prismaUserId = session ? await resolvePrismaUserIdFromSession(session) : null
      const viewerMaxStreak =
        prismaUserId !== null ? await viewerMaxWinStreakForStreamer(scope, prismaUserId) : undefined
      res.json({ entries, ...(viewerMaxStreak !== undefined ? { viewerMaxStreak } : {}) })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/streak', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })

  /** Rating: +1 per win, −1 per loss (wins − (gamesPlayed − wins)). */
  app.get('/api/leaderboard/rating', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      const scope = await resolveStreamerScopeFromQuery(req)
      if (!scope) {
        res.json({ entries: [] })
        return
      }
      const entries = await ratingLeaderboardForStreamer(scope)
      res.json({ entries })
    } catch (e) {
      console.error('[leaderboard] GET /api/leaderboard/rating', e)
      res.status(500).json({ entries: [], error: 'server_error' })
    }
  })
}
