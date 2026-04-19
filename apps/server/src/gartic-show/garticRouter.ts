import type { Express, Request, Response } from 'express'
import { prisma } from '../prisma'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { canUserControlGarticRoom } from './garticAccess'
import { normalizeGarticPromptKey } from './garticGuess'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

function badJson(res: Response, code: string, status = 400): void {
  res.status(status).json({ error: code })
}

export function mountGarticShowRoutes(app: Express): void {
  app.get('/api/gartic-show/prompts', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      badJson(res, 'database_unconfigured', 503)
      return
    }
    const session = readSessionFromCookie(req.headers.cookie)
    const streamerId = String(req.query.streamerId ?? '').trim()
    if (streamerId.length < 4) {
      badJson(res, 'bad_streamer_id')
      return
    }
    if (!(await canUserControlGarticRoom(session, streamerId))) {
      badJson(res, 'forbidden', 403)
      return
    }
    try {
      const rows = await prisma.garticPrompt.findMany({
        where: { streamerId },
        orderBy: [{ approved: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          text: true,
          source: true,
          createdBy: true,
          approved: true,
          usageCount: true,
          createdAt: true,
        },
      })
      res.json({ prompts: rows })
    } catch (e) {
      console.error('[gartic-show] list prompts', e)
      badJson(res, 'server_error', 500)
    }
  })

  app.patch('/api/gartic-show/prompts/:id', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      badJson(res, 'database_unconfigured', 503)
      return
    }
    const session = readSessionFromCookie(req.headers.cookie)
    const id = String(req.params.id ?? '').trim()
    if (id.length < 4) {
      badJson(res, 'bad_id')
      return
    }
    const body = req.body as { streamerId?: unknown; approved?: unknown; text?: unknown }
    const streamerId = typeof body.streamerId === 'string' ? body.streamerId.trim() : ''
    if (streamerId.length < 4) {
      badJson(res, 'bad_streamer_id')
      return
    }
    if (!(await canUserControlGarticRoom(session, streamerId))) {
      badJson(res, 'forbidden', 403)
      return
    }
    try {
      const existing = await prisma.garticPrompt.findFirst({
        where: { id, streamerId },
      })
      if (!existing) {
        badJson(res, 'not_found', 404)
        return
      }
      const data: { approved?: boolean; text?: string; normalizedText?: string; source?: string } = {}
      if (typeof body.approved === 'boolean') {
        data.approved = body.approved
      }
      if (typeof body.text === 'string') {
        const t = body.text.trim().replace(/\s+/g, ' ')
        if (t.length < 1 || t.length > 80) {
          badJson(res, 'bad_text')
          return
        }
        const normalizedText = normalizeGarticPromptKey(t)
        if (!normalizedText) {
          badJson(res, 'bad_text')
          return
        }
        const clash = await prisma.garticPrompt.findFirst({
          where: { streamerId, normalizedText, NOT: { id } },
          select: { id: true },
        })
        if (clash) {
          badJson(res, 'duplicate')
          return
        }
        data.text = t
        data.normalizedText = normalizedText
        data.source = 'streamer'
      }
      if (Object.keys(data).length === 0) {
        badJson(res, 'no_updates')
        return
      }
      const row = await prisma.garticPrompt.update({
        where: { id },
        data,
        select: {
          id: true,
          text: true,
          source: true,
          createdBy: true,
          approved: true,
          usageCount: true,
          createdAt: true,
        },
      })
      res.json({ prompt: row })
    } catch (e) {
      console.error('[gartic-show] patch prompt', e)
      badJson(res, 'server_error', 500)
    }
  })

  app.delete('/api/gartic-show/prompts/:id', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      badJson(res, 'database_unconfigured', 503)
      return
    }
    const session = readSessionFromCookie(req.headers.cookie)
    const id = String(req.params.id ?? '').trim()
    const streamerId = String(req.query.streamerId ?? '').trim()
    if (id.length < 4 || streamerId.length < 4) {
      badJson(res, 'bad_request')
      return
    }
    if (!(await canUserControlGarticRoom(session, streamerId))) {
      badJson(res, 'forbidden', 403)
      return
    }
    try {
      const r = await prisma.garticPrompt.deleteMany({
        where: { id, streamerId },
      })
      if (r.count === 0) {
        badJson(res, 'not_found', 404)
        return
      }
      res.status(204).end()
    } catch (e) {
      console.error('[gartic-show] delete prompt', e)
      badJson(res, 'server_error', 500)
    }
  })
}
