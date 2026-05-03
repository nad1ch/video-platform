import type { Express, Request, Response } from 'express'
import { getCheckersState } from './checkersGameStore'
import { reserveCheckersMatchRoom } from './checkersSocket'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import {
  checkersRatingsForUsers,
  recordCheckersMatchResult,
} from '../leaderboardRouter'

const MATCH_WAIT_TIMEOUT_MS = 30_000
const PREFERRED_RATING_DIFF = 200

/**
 * How long a matched room stays in memory before the orphan reaper drops it
 * and its corresponding `recordedResultKeys` entries. Normal games finish in
 * minutes; 30 min leaves slack for long pauses but bounds memory growth.
 */
const MATCHED_ROOM_TTL_MS = 30 * 60 * 1000
const MATCHED_ROOM_REAP_INTERVAL_MS = 5 * 60 * 1000

type WaitingPlayer = {
  clientId: string
  userId: string | null
  rating: number
  res: Response
  done: boolean
  timeout: ReturnType<typeof setTimeout>
}

type MatchedRoom = {
  player1ClientId: string
  player2ClientId: string
  player1UserId: string | null
  player2UserId: string | null
  createdAt: number
}

const waitingPlayers: WaitingPlayer[] = []
const matchedRooms = new Map<string, MatchedRoom>()
const recordedResultKeys = new Set<string>()

/**
 * Forget a matchmaking room and every recorded-result key under its prefix.
 * Called after a successful `/api/matchmaking/result` and from the reaper
 * below. Idempotent — missing entries are no-ops.
 */
function forgetMatchmakingRoom(roomId: string): void {
  matchedRooms.delete(roomId)
  const prefix = `${roomId}:`
  for (const key of recordedResultKeys) {
    if (key.startsWith(prefix)) {
      recordedResultKeys.delete(key)
    }
  }
}

/**
 * Bounded orphan reaper for `matchedRooms` that never received a result
 * submission (client crashed mid-game, network failure, etc). Without this
 * both maps grew monotonically for the process lifetime.
 */
const matchedRoomReaper = setInterval(() => {
  const now = Date.now()
  for (const [roomId, room] of matchedRooms) {
    if (now - room.createdAt > MATCHED_ROOM_TTL_MS) {
      forgetMatchmakingRoom(roomId)
    }
  }
}, MATCHED_ROOM_REAP_INTERVAL_MS)
if (typeof matchedRoomReaper.unref === 'function') {
  matchedRoomReaper.unref()
}

function cleanClientId(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  const clientId = raw.trim().slice(0, 120)
  return clientId.length > 0 ? clientId : null
}

function createMatchRoomId(): string {
  return `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function finishWaiting(player: WaitingPlayer, status: number, payload: unknown): void {
  if (player.done) {
    return
  }
  player.done = true
  clearTimeout(player.timeout)
  removeWaitingPlayer(player)
  player.res.status(status).json(payload)
}

function removeWaitingPlayer(player: WaitingPlayer): void {
  const index = waitingPlayers.indexOf(player)
  if (index !== -1) {
    waitingPlayers.splice(index, 1)
  }
}

function queuePlayer(clientId: string, userId: string | null, rating: number, res: Response): void {
  const entry: WaitingPlayer = {
    clientId,
    userId,
    rating,
    res,
    done: false,
    timeout: setTimeout(() => {
      finishWaiting(entry, 202, { roomId: null, status: 'waiting' })
    }, MATCH_WAIT_TIMEOUT_MS),
  }

  if (typeof entry.timeout.unref === 'function') {
    entry.timeout.unref()
  }

  res.on('close', () => {
    if (!entry.done) {
      clearTimeout(entry.timeout)
      removeWaitingPlayer(entry)
      entry.done = true
    }
  })

  waitingPlayers.push(entry)
}

function findOpponent(clientId: string, rating: number): WaitingPlayer | null {
  const candidates = waitingPlayers.filter((player) => !player.done && player.clientId !== clientId)
  if (candidates.length === 0) {
    return null
  }
  return (
    candidates.find((player) => Math.abs(player.rating - rating) < PREFERRED_RATING_DIFF) ??
    candidates[0] ??
    null
  )
}

async function userIdFromRequest(req: Request): Promise<string | null> {
  const session = readSessionFromCookie(req.headers.cookie)
  return session ? await resolvePrismaUserIdFromSession(session) : null
}

async function ratingForUser(userId: string | null): Promise<number> {
  if (!userId) {
    return 1200
  }
  const ratings = await checkersRatingsForUsers([userId])
  return ratings.get(userId) ?? 1200
}

export function mountCheckersMatchmakingRoutes(app: Express): void {
  app.post('/api/matchmaking/join', async (req: Request, res: Response) => {
    const clientId = cleanClientId((req.body as { clientId?: unknown } | undefined)?.clientId)
    if (!clientId) {
      res.status(400).json({ error: 'client_id_required' })
      return
    }

    const userId = await userIdFromRequest(req)
    const rating = await ratingForUser(userId)
    const opponent = findOpponent(clientId, rating)

    if (opponent) {
      removeWaitingPlayer(opponent)
      const roomId = createMatchRoomId()
      reserveCheckersMatchRoom(roomId, opponent.clientId, clientId, {
        player1UserId: opponent.userId,
        player2UserId: userId,
      })
      matchedRooms.set(roomId, {
        player1ClientId: opponent.clientId,
        player2ClientId: clientId,
        player1UserId: opponent.userId,
        player2UserId: userId,
        createdAt: Date.now(),
      })
      finishWaiting(opponent, 200, { roomId })
      res.json({ roomId })
      return
    }

    for (const player of [...waitingPlayers]) {
      if (player.clientId === clientId) {
        finishWaiting(player, 409, { error: 'search_replaced' })
      }
    }

    queuePlayer(clientId, userId, rating, res)
  })

  app.post('/api/matchmaking/leave', (req: Request, res: Response) => {
    const clientId = cleanClientId((req.body as { clientId?: unknown } | undefined)?.clientId)
    if (clientId) {
      for (const player of [...waitingPlayers]) {
        if (player.clientId === clientId) {
          finishWaiting(player, 200, { left: true })
          return
        }
      }
    }
    res.json({ left: false })
  })

  app.post('/api/matchmaking/result', async (req: Request, res: Response) => {
    const body = req.body as { roomId?: unknown; revision?: unknown } | undefined
    const roomId = typeof body?.roomId === 'string' ? body.roomId.trim().slice(0, 80) : ''
    const revision = typeof body?.revision === 'number' && Number.isFinite(body.revision) ? Math.floor(body.revision) : 0
    if (!roomId || revision < 1) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }
    const room = matchedRooms.get(roomId)
    if (!room?.player1UserId || !room.player2UserId) {
      res.status(202).json({ recorded: false, reason: 'unrated_match' })
      return
    }
    const submitterUserId = await userIdFromRequest(req)
    if (submitterUserId !== room.player1UserId && submitterUserId !== room.player2UserId) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const state = getCheckersState(roomId)
    if (state.revision !== revision) {
      res.status(409).json({ recorded: false, reason: 'stale_revision' })
      return
    }
    if (state.winner !== 'player1' && state.winner !== 'player2') {
      res.status(409).json({ recorded: false, reason: 'not_finished' })
      return
    }
    const resultKey = `${roomId}:${revision}`
    if (recordedResultKeys.has(resultKey)) {
      res.json({ recorded: true })
      return
    }
    // Claim the idempotency slot BEFORE the first DB write. Node.js is
    // single-threaded, so `has` + `add` with no intervening await is
    // race-safe within one process — a truly concurrent sibling request
    // will find the key already set and return `recorded: true` below.
    // Cross-process duplication (horizontally-scaled API) is a separate
    // infrastructure limitation, same class as the in-memory rate limits.
    recordedResultKeys.add(resultKey)
    let persisted = false
    try {
      const beforeRatings = await checkersRatingsForUsers([room.player1UserId, room.player2UserId])
      await recordCheckersMatchResult({
        player1UserId: room.player1UserId,
        player2UserId: room.player2UserId,
        winnerUserId: state.winner === 'player1' ? room.player1UserId : room.player2UserId,
      })
      // From here on the GameRound row is committed; any later failure
      // (ratings re-read, cache invalidation, network hiccup while writing
      // the HTTP response) MUST NOT release the idempotency key, otherwise
      // a client retry would create a second GameRound and double-apply ELO.
      persisted = true
      const afterRatings = await checkersRatingsForUsers([room.player1UserId, room.player2UserId])
      const before = beforeRatings.get(submitterUserId) ?? 1200
      const after = afterRatings.get(submitterUserId) ?? before
      // Match is now persisted in the DB. Drop in-memory state so both maps
      // stay bounded. A later resubmit would 202 `unrated_match` — acceptable
      // since the DB is the source of truth for the result.
      forgetMatchmakingRoom(roomId)
      res.json({ recorded: true, ratingDelta: after - before })
    } catch (err) {
      if (!persisted) {
        // Write never committed — safe to allow a retry. If the write DID
        // commit we keep the key so the retry returns `recorded: true`
        // above instead of double-writing.
        recordedResultKeys.delete(resultKey)
      }
      console.error('[checkers-matchmaking] record result failed', err)
      res.status(500).json({ error: 'server_error' })
    }
  })
}
