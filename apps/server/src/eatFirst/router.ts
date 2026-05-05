import type { Express, Request, Response } from 'express'
import { prisma } from '../prisma'
import { isValidGameId, normalizeEatFirstSlot } from './slot'
import {
  eatFirstSessionCanOperateGame,
  resolveEatFirstEnsureOwnerUserId,
  resolveEatFirstOperatorUserId,
} from './sessionGate'
import {
  eatFirstClearVotesAdmin,
  eatFirstClaimSlot,
  eatFirstDeletePlayerAdmin,
  eatFirstDeleteVoteAdmin,
  eatFirstEnsureGame,
  eatFirstMergePlayerAdmin,
  eatFirstMergeRoomAdmin,
  eatFirstPostHand,
  eatFirstPostReady,
  eatFirstHostReshuffleAdmin,
  eatFirstReviveEliminatedAdmin,
  eatFirstSnapshot,
  eatFirstSubmitVote,
  verifyEatFirstSlotAuth,
} from './service'

async function requireEatFirstHostForGame(
  req: Request,
  res: Response,
  gameId: string,
): Promise<boolean> {
  if (!(await eatFirstSessionCanOperateGame(req.headers.cookie, gameId))) {
    res.status(403).type('text/plain').send('Forbidden')
    return false
  }
  return true
}

/**
 * Resolve the authenticated operator's Prisma user id for a request that has
 * already passed a host/admin gate. Any mutation that may implicitly create
 * the game row (via `eatFirstEnsureGame`) MUST pass this through so the first
 * write stamps ownership — otherwise an ownerless row is created and any host
 * can hijack it via the legacy fallback in `eatFirstSessionCanOperateGame`.
 */
async function resolveMutationOwnerUserId(req: Request): Promise<string | null> {
  return resolveEatFirstOperatorUserId(req.headers.cookie)
}

/**
 * Authorize an action on behalf of `slotId` in `gameId`. Accepts either:
 *   - authenticated host/admin session that is allowed to operate this game, OR
 *   - matching `joinToken` + `deviceId` for the claimed slot (eatFirstClaimSlot).
 *
 * Responds with the appropriate HTTP status on failure. Callers must return
 * immediately when this returns `false`.
 */
async function authorizePlayerAction(
  req: Request,
  res: Response,
  gameId: string,
  slotId: string,
  body: { joinToken?: unknown; deviceId?: unknown },
): Promise<boolean> {
  
  
  if (await eatFirstSessionCanOperateGame(req.headers.cookie, gameId)) {
    return true
  }
  const joinToken = typeof body.joinToken === 'string' ? body.joinToken : ''
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  const verdict = await verifyEatFirstSlotAuth(gameId, slotId, deviceId, joinToken)
  if (verdict.ok) {
    return true
  }
  if (verdict.reason === 'no-slot') {
    res.status(404).json({ error: 'no-slot' })
    return false
  }
  if (verdict.reason === 'unclaimed') {
    res.status(409).json({ error: 'unclaimed' })
    return false
  }
  res.status(403).json({ error: 'forbidden' })
  return false
}

function sendErr(res: Response, err: unknown): void {
  const e = err as Error & { status?: number }
  const status = typeof e.status === 'number' ? e.status : 500
  if (status >= 500) {
    console.error('[eat-first]', e)
  }
  res.status(status).type('text/plain').send(e.message || 'Error')
}

export function mountEatFirstRoutes(app: Express): void {
  const base = '/api/eat-first'

  app.get(`${base}/games/:gameId/snapshot`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!isValidGameId(gameId)) {
          res.status(400).json({ error: 'bad game id' })
          return
        }
        const snap = await eatFirstSnapshot(prisma, gameId)
        res.json(snap)
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/ensure`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        
        
        
        
        
        
        const ownerUserId = await resolveEatFirstEnsureOwnerUserId(req.headers.cookie)
        const created = await eatFirstEnsureGame(gameId, ownerUserId)
        res.json({ created })
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.patch(`${base}/games/:gameId/room`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        const patch = (req.body as { patch?: unknown })?.patch ?? req.body
        const ownerUserId = await resolveMutationOwnerUserId(req)
        await eatFirstMergeRoomAdmin(gameId, patch, ownerUserId)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/hand`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        const body = req.body as {
          playerId?: string
          raised?: boolean
          joinToken?: unknown
          deviceId?: unknown
        }
        const rawSlot = String(body.playerId ?? '')
        const slotId = normalizeEatFirstSlot(rawSlot)
        if (!(await authorizePlayerAction(req, res, gameId, slotId, body))) return
        
        
        const ownerUserId = await resolveMutationOwnerUserId(req)
        await eatFirstPostHand(gameId, rawSlot, Boolean(body.raised), ownerUserId)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/ready`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        const body = req.body as {
          playerId?: string
          ready?: boolean
          joinToken?: unknown
          deviceId?: unknown
        }
        const rawSlot = String(body.playerId ?? '')
        const slotId = normalizeEatFirstSlot(rawSlot)
        if (!(await authorizePlayerAction(req, res, gameId, slotId, body))) return
        const ownerUserId = await resolveMutationOwnerUserId(req)
        await eatFirstPostReady(gameId, rawSlot, Boolean(body.ready), ownerUserId)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/players/:slotId/claim`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        const slotId = String(req.params.slotId ?? '')
        const { deviceId, name } = req.body as { deviceId?: string; name?: string }
        const out = await eatFirstClaimSlot(
          gameId,
          slotId,
          String(deviceId ?? ''),
          String(name ?? '').slice(0, 64),
        )
        if (!out.ok) {
          res.status(400).json(out)
          return
        }
        res.json(out)
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.patch(`${base}/games/:gameId/players/:slotId`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        const slotId = String(req.params.slotId ?? '')
        const { patch } = req.body as { patch?: unknown }
        const ownerUserId = await resolveMutationOwnerUserId(req)
        await eatFirstMergePlayerAdmin(gameId, slotId, patch, ownerUserId)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.delete(`${base}/games/:gameId/players/:slotId`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        const slotId = String(req.params.slotId ?? '')
        await eatFirstDeletePlayerAdmin(gameId, slotId)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/votes/submit`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        const body = req.body as {
          voterPlayerId?: string
          targetPlayer?: string
          choice?: string
          round?: number
          joinToken?: unknown
          deviceId?: unknown
        }
        const rawVoter = String(body.voterPlayerId ?? '')
        const voterSlotId = normalizeEatFirstSlot(rawVoter)
        if (!(await authorizePlayerAction(req, res, gameId, voterSlotId, body))) return
        const out = await eatFirstSubmitVote(
          gameId,
          rawVoter,
          String(body.targetPlayer ?? ''),
          String(body.choice ?? ''),
          Number(body.round ?? 0),
        )
        res.json(out)
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/votes/clear`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        await eatFirstClearVotesAdmin(gameId)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/votes/delete`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        const { voterId } = req.body as { voterId?: string }
        await eatFirstDeleteVoteAdmin(gameId, String(voterId ?? ''))
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/players/revive-eliminated`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        const n = await eatFirstReviveEliminatedAdmin(gameId)
        res.json({ updated: n })
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.post(`${base}/games/:gameId/host-reshuffle`, (req, res) => {
    void (async () => {
      try {
        const gameId = String(req.params.gameId ?? '')
        if (!(await requireEatFirstHostForGame(req, res, gameId))) return
        const ownerUserId = await resolveMutationOwnerUserId(req)
        const body = req.body as { participantCount?: unknown }
        const participantCount = Number(body?.participantCount ?? 0)
        const out = await eatFirstHostReshuffleAdmin(gameId, participantCount, ownerUserId)
        res.json(out)
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })
}
