import type { Express, Request, Response } from 'express'
import { prisma } from '../prisma'
import { isValidGameId } from './slot'
import { eatFirstSessionCanHost } from './sessionGate'
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
  eatFirstReviveEliminatedAdmin,
  eatFirstSnapshot,
  eatFirstSubmitVote,
} from './service'

async function requireEatFirstHost(req: Request, res: Response): Promise<boolean> {
  if (!(await eatFirstSessionCanHost(req.headers.cookie))) {
    res.status(403).type('text/plain').send('Forbidden')
    return false
  }
  return true
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
        const created = await eatFirstEnsureGame(gameId)
        res.json({ created })
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.patch(`${base}/games/:gameId/room`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireEatFirstHost(req, res))) return
        const gameId = String(req.params.gameId ?? '')
        const patch = (req.body as { patch?: unknown })?.patch ?? req.body
        await eatFirstMergeRoomAdmin(gameId, patch)
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
        const { playerId, raised } = req.body as { playerId?: string; raised?: boolean }
        await eatFirstPostHand(gameId, String(playerId ?? ''), Boolean(raised))
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
        const { playerId, ready } = req.body as { playerId?: string; ready?: boolean }
        await eatFirstPostReady(gameId, String(playerId ?? ''), Boolean(ready))
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
        if (!(await requireEatFirstHost(req, res))) return
        const gameId = String(req.params.gameId ?? '')
        const slotId = String(req.params.slotId ?? '')
        const { patch } = req.body as { patch?: unknown }
        await eatFirstMergePlayerAdmin(gameId, slotId, patch)
        res.status(204).end()
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })

  app.delete(`${base}/games/:gameId/players/:slotId`, (req, res) => {
    void (async () => {
      try {
        if (!(await requireEatFirstHost(req, res))) return
        const gameId = String(req.params.gameId ?? '')
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
        const { voterPlayerId, targetPlayer, choice, round } = req.body as {
          voterPlayerId?: string
          targetPlayer?: string
          choice?: string
          round?: number
        }
        const out = await eatFirstSubmitVote(
          gameId,
          String(voterPlayerId ?? ''),
          String(targetPlayer ?? ''),
          String(choice ?? ''),
          Number(round ?? 0),
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
        if (!(await requireEatFirstHost(req, res))) return
        const gameId = String(req.params.gameId ?? '')
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
        if (!(await requireEatFirstHost(req, res))) return
        const gameId = String(req.params.gameId ?? '')
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
        if (!(await requireEatFirstHost(req, res))) return
        const gameId = String(req.params.gameId ?? '')
        const n = await eatFirstReviveEliminatedAdmin(gameId)
        res.json({ updated: n })
      } catch (err) {
        sendErr(res, err)
      }
    })()
  })
}
