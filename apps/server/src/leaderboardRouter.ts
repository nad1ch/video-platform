import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from './prisma'
import { resolvePrismaUserIdFromSession } from './auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from './auth/session/sessionJwt'
import { normalizeTwitchLogin } from './streamerIdentity'

const CHECKERS_ELO_INITIAL = 1200
const CHECKERS_ELO_K = 20

type ParticipantRow = {
  userId: string
  isWinner: boolean
  roundCreatedAt: Date
}

export type CheckersEloSnapshot = {
  rating: number
  wins: number
  losses: number
}


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
  const raw =
    typeof q.streamer === 'string' ? normalizeTwitchLogin(q.streamer) : null
  if (!raw) {
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

/**
 * Short-TTL cache for the full-history ELO recomputation.
 *
 * Before this cache every `/api/leaderboard/{rating,wins,streak}` hit ran a
 * full `gameRound.findMany({ streamerId: null, include: { results } })` and
 * re-evaluated every round — O(rounds). With dashboards polling and the
 * leaderboard surfacing in multiple tabs this was a hot path.
 *
 * 5 s is short enough that operator clicks feel live (multiple leaderboard
 * views share one snapshot), and any write path (`recordCheckersMatchResult`)
 * explicitly invalidates it, so a just-played match appears without delay.
 */
const CHECKERS_ELO_CACHE_TTL_MS = 5_000
let checkersEloCacheAt = 0
let checkersEloCachedPromise: Promise<Map<string, CheckersEloSnapshot>> | null = null

function invalidateCheckersEloCache(): void {
  checkersEloCacheAt = 0
  checkersEloCachedPromise = null
}

async function computeCheckersEloSnapshotsUncached(): Promise<Map<string, CheckersEloSnapshot>> {
  const rounds = await prisma.gameRound.findMany({
    where: { streamerId: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { results: true },
  })
  const snapshots = new Map<string, CheckersEloSnapshot>()

  function ensure(userId: string): CheckersEloSnapshot {
    let row = snapshots.get(userId)
    if (!row) {
      row = { rating: CHECKERS_ELO_INITIAL, wins: 0, losses: 0 }
      snapshots.set(userId, row)
    }
    return row
  }

  for (const round of rounds) {
    
    
    
    
    const results = round.results.filter((r) => r.userId.length > 0)
    if (results.length !== 2 || results[0]!.userId === results[1]!.userId) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[leaderboard][checkers] skipping malformed round', {
          roundId: round.id,
          resultCount: results.length,
        })
      }
      continue
    }
    const winners = results.filter((r) => r.isWinner)
    if (winners.length !== 1) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[leaderboard][checkers] skipping round with ambiguous winner', {
          roundId: round.id,
          winnerCount: winners.length,
        })
      }
      continue
    }
    const winner = winners[0]!
    const loser = results.find((r) => r.userId !== winner.userId)!
    const winnerRow = ensure(winner.userId)
    const loserRow = ensure(loser.userId)
    const winnerExpected = 1 / (1 + 10 ** ((loserRow.rating - winnerRow.rating) / 400))
    const loserExpected = 1 / (1 + 10 ** ((winnerRow.rating - loserRow.rating) / 400))
    winnerRow.rating = Math.round(winnerRow.rating + CHECKERS_ELO_K * (1 - winnerExpected))
    loserRow.rating = Math.round(loserRow.rating + CHECKERS_ELO_K * (0 - loserExpected))
    winnerRow.wins += 1
    loserRow.losses += 1
  }

  return snapshots
}

async function computeCheckersEloSnapshots(): Promise<Map<string, CheckersEloSnapshot>> {
  const now = Date.now()
  if (checkersEloCachedPromise && now - checkersEloCacheAt < CHECKERS_ELO_CACHE_TTL_MS) {
    return checkersEloCachedPromise
  }
  const pending = computeCheckersEloSnapshotsUncached()
  checkersEloCachedPromise = pending
  checkersEloCacheAt = now
  
  
  pending.catch(() => {
    if (checkersEloCachedPromise === pending) {
      invalidateCheckersEloCache()
    }
  })
  return pending
}

export async function checkersRatingsForUsers(userIds: string[]): Promise<Map<string, number>> {
  const snapshots = await computeCheckersEloSnapshots()
  const out = new Map<string, number>()
  for (const userId of userIds) {
    out.set(userId, snapshots.get(userId)?.rating ?? CHECKERS_ELO_INITIAL)
  }
  return out
}

export async function recordCheckersMatchResult(input: {
  player1UserId: string
  player2UserId: string
  winnerUserId: string
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await tx.gameRound.create({
      data: {
        streamerId: null,
        winnerUserId: input.winnerUserId,
      },
    })
    await tx.gameResult.createMany({
      data: [
        {
          roundId: round.id,
          userId: input.player1UserId,
          attempts: 1,
          isWinner: input.player1UserId === input.winnerUserId,
        },
        {
          roundId: round.id,
          userId: input.player2UserId,
          attempts: 1,
          isWinner: input.player2UserId === input.winnerUserId,
        },
      ],
    })
  })
  
  // just-played match appears without a 5 s stale cache window.
  invalidateCheckersEloCache()
}

async function checkersRatingLeaderboard(): Promise<
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
  const snapshots = await computeCheckersEloSnapshots()
  const displayMap = await buildParticipantDisplayMap([...snapshots.keys()])
  return [...snapshots.entries()]
    .map(([userId, snapshot]) => ({
      userId,
      displayName: displayMap.get(userId)?.displayName ?? 'Player',
      avatarUrl: displayMap.get(userId)?.avatarUrl ?? null,
      rating: snapshot.rating,
      wins: snapshot.wins,
      losses: snapshot.losses,
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating || b.wins - a.wins || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, 100)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

async function checkersWinsLeaderboard(): Promise<
  Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; wins: number }>
> {
  const snapshots = await computeCheckersEloSnapshots()
  const displayMap = await buildParticipantDisplayMap([...snapshots.keys()])
  return [...snapshots.entries()]
    .map(([userId, snapshot]) => ({
      userId,
      displayName: displayMap.get(userId)?.displayName ?? 'Player',
      avatarUrl: displayMap.get(userId)?.avatarUrl ?? null,
      wins: snapshot.wins,
    }))
    .filter((r) => r.wins > 0)
    .sort(
      (a, b) =>
        b.wins - a.wins || a.userId.localeCompare(b.userId) || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, 100)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

async function checkersStreakLeaderboard(): Promise<
  Array<{ rank: number; userId: string; displayName: string; avatarUrl: string | null; streak: number }>
> {
  const flat = await prisma.$queryRaw<Array<{ userId: string; isWinner: boolean; createdAt: Date }>>(
    Prisma.sql`
      SELECT gr."userId", gr."isWinner", g."createdAt" AS "createdAt"
      FROM "GameResult" gr
      INNER JOIN "GameRound" g ON g.id = gr."roundId"
      WHERE g."streamerId" IS NULL
    `,
  )
  const raw = flat.map((r) => ({
    userId: r.userId,
    isWinner: r.isWinner,
    round: { createdAt: r.createdAt },
  }))
  return streakFromRows(raw)
}


async function viewerMaxWinStreakForCheckers(prismaUserId: string): Promise<number> {
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
      WHERE g."streamerId" IS NULL
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

export function mountLeaderboardRoutes(app: Express): void {
  



  app.post('/api/wins', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'server_authority_required' })
  })

  app.get('/api/leaderboard/wins', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      if (req.query.game === 'checkers') {
        const entries = await checkersWinsLeaderboard()
        res.json({ entries })
        return
      }
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
      if (req.query.game === 'checkers') {
        const entries = await checkersStreakLeaderboard()
        const session = readSessionFromCookie(req.headers.cookie)
        const prismaUserId = session ? await resolvePrismaUserIdFromSession(session) : null
        const viewerMaxStreak =
          prismaUserId !== null ? await viewerMaxWinStreakForCheckers(prismaUserId) : undefined
        res.json({ entries, ...(viewerMaxStreak !== undefined ? { viewerMaxStreak } : {}) })
        return
      }
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

  
  app.get('/api/leaderboard/rating', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.json({ entries: [] })
      return
    }
    try {
      if (req.query.game === 'checkers') {
        const entries = await checkersRatingLeaderboard()
        res.json({ entries })
        return
      }
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
