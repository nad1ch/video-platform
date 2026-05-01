import type { Express, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { resolvePrismaUserIdFromSession } from './auth/resolvePrismaUserFromSession'
import { readSessionFromCookie } from './auth/session/sessionJwt'
import { isDatabaseConfigured, prisma } from './prisma'

const ALLOWED_CLIENT_EVENTS = new Set([
  'route_change',
  'admin_role_toggle_clicked',
  'streamer_create_clicked',
  'streamer_deactivate_clicked',
  'game_opened',
  'game_joined',
])

const SENSITIVE_KEY_RE = /(token|cookie|password|passwd|secret|authorization|authheader|auth_header|credential|private|message)/i
const MAX_METADATA_KEYS = 24
const MAX_STRING_LENGTH = 240
const MAX_PATH_LENGTH = 512
const MAX_MESSAGE_LENGTH = 512
const MAX_STACK_LENGTH = 2000
const MAX_SOURCE_LENGTH = 80
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 80

type RateBucket = { count: number; resetAt: number }

const rateBuckets = new Map<string, RateBucket>()

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(cookie|authorization)\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .replace(/([?&](?:token|code|state|password|secret|auth|access_token|refresh_token)=)[^&\s]+/gi, '$1[redacted]')
}

function truncateString(value: string, maxLength: number): string {
  const s = redactSensitiveText(value.trim())
  return s.length > maxLength ? s.slice(0, maxLength) : s
}

function sanitizePath(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }
  const raw = input.trim()
  if (!raw) {
    return null
  }
  try {
    const parsed = new URL(raw, 'http://streamassist.local')
    return truncateString(parsed.pathname || '/', MAX_PATH_LENGTH)
  } catch {
    return truncateString(raw.split('?')[0]?.split('#')[0] ?? raw, MAX_PATH_LENGTH)
  }
}

function sanitizeSessionId(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }
  const s = input.trim()
  if (!/^[a-zA-Z0-9_.:-]{8,80}$/.test(s)) {
    return null
  }
  return s
}

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (value == null) {
    return null
  }
  if (typeof value === 'string') {
    return truncateString(value, MAX_STRING_LENGTH)
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    if (depth >= 2) {
      return null
    }
    return value.slice(0, 12).map((item) => sanitizeMetadataValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    if (depth >= 2) {
      return null
    }
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        continue
      }
      const safe = sanitizeMetadataValue(item, depth + 1)
      if (safe !== undefined) {
        out[key.slice(0, 80)] = safe
      }
    }
    return out
  }
  return null
}

function sanitizeMetadata(input: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const safe = sanitizeMetadataValue(input, 0)
  if (!safe || typeof safe !== 'object') {
    return Prisma.JsonNull
  }
  return safe as Prisma.InputJsonValue
}

function rateKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return `${typeof ip === 'string' ? ip.split(',')[0]?.trim() : req.ip}:${req.path}`
}

function consumeRateLimit(req: Request): boolean {
  const now = Date.now()
  const key = rateKey(req)
  const current = rateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  current.count += 1
  return current.count <= RATE_LIMIT
}

async function resolveOptionalUserId(req: Request): Promise<string | null> {
  const session = readSessionFromCookie(req.headers.cookie)
  return session ? await resolvePrismaUserIdFromSession(session) : null
}

function safeAccepted(res: Response): void {
  res.status(202).json({ ok: true })
}

export function mountClientEventRoutes(app: Express): void {
  app.post('/api/events/client', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      safeAccepted(res)
      return
    }
    if (!consumeRateLimit(req)) {
      res.status(429).json({ error: 'rate_limited' })
      return
    }
    const body = req.body as { event?: unknown; path?: unknown; metadata?: unknown; sessionId?: unknown }
    const event = typeof body.event === 'string' ? body.event.trim() : ''
    if (!ALLOWED_CLIENT_EVENTS.has(event)) {
      res.status(400).json({ error: 'invalid_event' })
      return
    }
    try {
      await prisma.userActivityEvent.create({
        data: {
          userId: await resolveOptionalUserId(req),
          sessionId: sanitizeSessionId(body.sessionId),
          event,
          path: sanitizePath(body.path),
          metadata: sanitizeMetadata(body.metadata),
        },
      })
      safeAccepted(res)
    } catch (error) {
      console.error('[events] POST /api/events/client', error)
      res.status(500).json({ error: 'server_error' })
    }
  })

  app.post('/api/events/error', async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      safeAccepted(res)
      return
    }
    if (!consumeRateLimit(req)) {
      res.status(429).json({ error: 'rate_limited' })
      return
    }
    const body = req.body as {
      message?: unknown
      stack?: unknown
      path?: unknown
      source?: unknown
      metadata?: unknown
      sessionId?: unknown
    }
    const rawMessage = typeof body.message === 'string' ? body.message : ''
    const message = truncateString(rawMessage || 'Unknown client error', MAX_MESSAGE_LENGTH)
    const source = truncateString(typeof body.source === 'string' ? body.source : 'client', MAX_SOURCE_LENGTH) || 'client'
    try {
      await prisma.clientErrorEvent.create({
        data: {
          userId: await resolveOptionalUserId(req),
          sessionId: sanitizeSessionId(body.sessionId),
          message,
          stack: typeof body.stack === 'string' ? truncateString(body.stack, MAX_STACK_LENGTH) : null,
          path: sanitizePath(body.path),
          source,
          metadata: sanitizeMetadata(body.metadata),
        },
      })
      safeAccepted(res)
    } catch (error) {
      console.error('[events] POST /api/events/error', error)
      res.status(500).json({ error: 'server_error' })
    }
  })
}
