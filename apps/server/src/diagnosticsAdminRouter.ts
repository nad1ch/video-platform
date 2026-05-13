/**
 * Admin diagnostics router (D1.3).
 *
 * Endpoints for finalized RoomDiagnosticReport rows (the in-memory live
 * report endpoint stays in `adminRouter.ts`):
 *
 *   GET  /api/admin/diagnostics/reports
 *     List paginated metadata (no `reportJson`).
 *
 *   GET  /api/admin/diagnostics/reports/:id
 *     Full row including `reportJson`.
 *
 *   GET  /api/admin/diagnostics/reports/:id/download
 *     Same as detail but with `Content-Disposition: attachment` and
 *     `Cache-Control: no-store` for direct browser download.
 *
 * All routes admin-gated via the existing `isSessionAdminFromCookie`
 * helper used by `adminRouter.ts`. No audit log writes — these endpoints
 * are read-only.
 */

import type { Express, Request, Response } from 'express'
import type { Prisma } from '@prisma/client'
import { isDatabaseConfigured, prisma } from './prisma'
import { isSessionAdminFromCookie } from './auth/session/isAdminRequest'

const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 200
const MAX_GAME_TYPE_LENGTH = 32
const MAX_ROOM_ID_FILTER_LENGTH = 200
const MAX_DOWNLOAD_FILENAME_SLUG_LENGTH = 80

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await isSessionAdminFromCookie(req.headers.cookie))) {
    res.status(403).json({ error: 'forbidden', message: 'Admin only' })
    return false
  }
  return true
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function parseBoolFlag(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return undefined
}

function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? new Date(ms) : undefined
}

function sanitizeRoomIdFilter(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, MAX_ROOM_ID_FILTER_LENGTH)
  return trimmed.length > 0 ? trimmed : undefined
}

function sanitizeGameTypeFilter(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, MAX_GAME_TYPE_LENGTH)
  return trimmed.length > 0 ? trimmed : undefined
}

export function mountDiagnosticsAdminRoutes(app: Express): void {
  /**
   * GET /api/admin/diagnostics/reports
   *
   * Paginated list of finalized reports, newest first.
   * Query params (all optional):
   *   limit       1..200, default 50
   *   offset      >= 0, default 0
   *   gameType    'mafia' | 'game-room' | 'eat-first' | ...
   *   roomId      exact match (e.g. 'mafia:foo')
   *   hasErrors   '1' / '0' / 'true' / 'false'
   *   dateFrom    ISO datetime
   *   dateTo      ISO datetime
   */
  app.get('/api/admin/diagnostics/reports', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const limit = clampInt(req.query.limit, DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT)
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER)
    const gameType = sanitizeGameTypeFilter(req.query.gameType)
    const roomId = sanitizeRoomIdFilter(req.query.roomId)
    const hasErrors = parseBoolFlag(req.query.hasErrors)
    const dateFrom = parseDateParam(req.query.dateFrom)
    const dateTo = parseDateParam(req.query.dateTo)

    const where: Prisma.RoomDiagnosticReportWhereInput = {}
    if (gameType) where.gameType = gameType
    if (roomId) where.roomId = roomId
    if (hasErrors !== undefined) where.hasErrors = hasErrors
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      }
    }

    try {
      const [total, rows] = await Promise.all([
        prisma.roomDiagnosticReport.count({ where }),
        prisma.roomDiagnosticReport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          // Explicitly exclude reportJson from the list response — it can
          // be hundreds of kB per row.
          select: {
            id: true,
            roomId: true,
            gameType: true,
            startedAt: true,
            endedAt: true,
            durationMs: true,
            eventCount: true,
            warningCount: true,
            errorCount: true,
            criticalCount: true,
            hasErrors: true,
            hasWarnings: true,
            truncated: true,
            hostUserId: true,
            hostDisplayName: true,
            participantCount: true,
            finalizedReason: true,
            createdAt: true,
          },
        }),
      ])
      res.setHeader('Cache-Control', 'no-store')
      res.json({ total, limit, offset, items: rows })
    } catch (err) {
      console.error('[diagnostics-admin] list failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      res.status(500).json({ error: 'server_error' })
    }
  })

  /**
   * GET /api/admin/diagnostics/reports/:id
   * Full row including `reportJson`.
   */
  app.get('/api/admin/diagnostics/reports/:id', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      res.status(400).json({ error: 'invalid_id' })
      return
    }
    try {
      const row = await prisma.roomDiagnosticReport.findUnique({ where: { id } })
      if (!row) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.setHeader('Cache-Control', 'no-store')
      res.json(row)
    } catch (err) {
      console.error('[diagnostics-admin] detail failed', {
        id,
        error: err instanceof Error ? err.message : String(err),
      })
      res.status(500).json({ error: 'server_error' })
    }
  })

  /**
   * GET /api/admin/diagnostics/reports/:id/download
   * Returns the `reportJson` (only — not the metadata wrapper) as a JSON
   * attachment so it can be saved/pasted directly.
   */
  app.get('/api/admin/diagnostics/reports/:id/download', async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: 'database_unconfigured' })
      return
    }
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      res.status(400).json({ error: 'invalid_id' })
      return
    }
    try {
      const row = await prisma.roomDiagnosticReport.findUnique({
        where: { id },
        select: { id: true, roomId: true, reportJson: true },
      })
      if (!row) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const safeRoom = row.roomId
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, MAX_DOWNLOAD_FILENAME_SLUG_LENGTH)
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="diagnostics-${safeRoom}-${row.id}.json"`,
      )
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.send(JSON.stringify(row.reportJson))
    } catch (err) {
      console.error('[diagnostics-admin] download failed', {
        id,
        error: err instanceof Error ? err.message : String(err),
      })
      res.status(500).json({ error: 'server_error' })
    }
  })
}
