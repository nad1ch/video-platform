import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { isDatabaseConfigured, prisma } from '../../prisma'
import { createRateLimiter, getClientIp, type RateLimiter } from '../../utils/rateLimit'
import { clientPublicOrigin } from '../clientOrigin'
import { resolveUserRole } from '../resolveUserRole'
import { findUserByEmail, normalizeEmail, updateEmailUserPassword } from './emailUserService'
import { sendPasswordResetEmail } from './emailVerificationMailer'
import { resolveEmailLocale } from './emailTemplates'

/**
 * Rate limiters for password-reset send.
 *
 * Both responses are SILENT generic `{ ok: true }` (same shape as a legitimate
 * success). A 429 response here would leak "this email exists" / "this IP has
 * been probing" to an enumeration attacker — the whole point of the generic-ok
 * design is that the attacker cannot distinguish existing vs. missing emails.
 *
 * The IP cap keeps cost bounded; the email cap specifically blunts enumeration
 * velocity without adding a new distinguishing response code.
 */
const passwordResetIpLimiter: RateLimiter = createRateLimiter({
  label: 'auth:password-reset:ip',
  windowMs: 15 * 60 * 1000,
  limit: 5,
})
const passwordResetEmailLimiter: RateLimiter = createRateLimiter({
  label: 'auth:password-reset:email',
  windowMs: 60 * 60 * 1000,
  limit: 3,
})

const TOKEN_BYTES = 32
const TOKEN_TTL_MINUTES = 30
const TOKEN_TTL_MS = TOKEN_TTL_MINUTES * 60 * 1000
const SEND_COOLDOWN_MS = 5 * 60 * 1000

type PasswordResetTokenRow = {
  id: string
  expiresAt: Date
  usedAt: Date | null
  user: { provider: string; providerUserId: string }
}

type PasswordResetTokenDelegate = {
  findFirst(args: unknown): Promise<{ createdAt: Date } | null>
  create(args: unknown): Promise<unknown>
  findUnique(args: unknown): Promise<PasswordResetTokenRow | null>
  updateMany(args: unknown): Promise<{ count: number }>
}

function passwordResetToken(client: unknown): PasswordResetTokenDelegate {
  return (client as { passwordResetToken: PasswordResetTokenDelegate }).passwordResetToken
}

const sendBodySchema = z.object({
  email: z.string().email().max(320),
  locale: z.string().max(32).optional(),
})

const confirmBodySchema = z.object({
  token: z.string().min(24).max(256),
  password: z.string().min(6).max(128),
})

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function createRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function buildResetUrl(token: string): string {
  // The reset link targets the SPA route (/auth?mode=reset&token=...), so it
  // MUST come from the trusted `clientPublicOrigin()` — never from
  // `x-forwarded-host` / request headers which an attacker could spoof to
  // redirect the victim's click to a hostile host.
  const url = new URL('/auth', clientPublicOrigin())
  url.searchParams.set('mode', 'reset')
  url.searchParams.set('token', token)
  return url.toString()
}

function requestLocale(req: Request, locale: string | undefined): 'en' | 'uk' {
  return resolveEmailLocale({
    locale,
    acceptLanguage: req.header('accept-language'),
  })
}

async function ensureEmailPasswordPrismaUser(row: { id: string; email: string; display_name: string }): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  const byProvider = await prisma.user.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'email',
        providerUserId: row.id,
      },
    },
    select: { id: true },
  })
  if (byProvider) {
    return byProvider.id
  }

  const email = normalizeEmail(row.email)
  const owner = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (owner) {
    return null
  }

  const created = await prisma.user.create({
    data: {
      id: row.id,
      provider: 'email',
      providerUserId: row.id,
      email,
      emailVerified: false,
      displayName: row.display_name.trim() || (email.includes('@') ? email.split('@')[0]! : 'User'),
      avatarUrl: null,
      role: resolveUserRole({ provider: 'email', id: row.id, email }),
      twitchId: null,
      stats: { create: {} },
    },
    select: { id: true },
  })
  return created.id
}

/** POST /api/auth/password-reset/send */
export async function handleSendPasswordReset(req: Request, res: Response): Promise<void> {
  const parsed = sendBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'VALIDATION' })
    return
  }

  const genericOk = (): void => {
    res.json({ ok: true })
  }

  // Rate limit BEFORE any DB read so an attacker cannot pay DB cost while
  // enumerating. Responses stay generic (`{ ok: true }`) on rate-limit hits
  // so a probe cannot distinguish "throttled" from "unknown email".
  const ipCheck = passwordResetIpLimiter.tryConsume(`ip:${getClientIp(req)}`)
  if (!ipCheck.allowed) {
    genericOk()
    return
  }
  const normalized = normalizeEmail(parsed.data.email)
  const emailCheck = passwordResetEmailLimiter.tryConsume(`email:${normalized}`)
  if (!emailCheck.allowed) {
    genericOk()
    return
  }

  try {
    const row = findUserByEmail(normalized)
    if (!row) {
      genericOk()
      return
    }
    const userId = await ensureEmailPasswordPrismaUser(row)
    if (!userId) {
      genericOk()
      return
    }
    const latest = await passwordResetToken(prisma).findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (latest && Date.now() - latest.createdAt.getTime() < SEND_COOLDOWN_MS) {
      genericOk()
      return
    }

    const rawToken = createRawToken()
    await passwordResetToken(prisma).create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })
    await sendPasswordResetEmail({
      to: normalizeEmail(row.email),
      displayName: row.display_name.trim() || 'User',
      resetUrl: buildResetUrl(rawToken),
      expiresInMinutes: TOKEN_TTL_MINUTES,
      locale: requestLocale(req, parsed.data.locale),
    })
    genericOk()
  } catch (e) {
    console.error('[auth][password-reset] send failed', e)
    genericOk()
  }
}

/** POST /api/auth/password-reset/confirm */
export async function handleConfirmPasswordReset(req: Request, res: Response): Promise<void> {
  const parsed = confirmBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'VALIDATION' })
    return
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' })
    return
  }

  const now = new Date()
  const tokenHash = hashToken(parsed.data.token.trim())
  try {
    const ok = await prisma.$transaction(async (tx) => {
      const resetTokens = passwordResetToken(tx)
      const row = await resetTokens.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          expiresAt: true,
          usedAt: true,
          user: { select: { provider: true, providerUserId: true } },
        },
      })
      if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
        return false
      }
      if (row.user.provider !== 'email') {
        return false
      }
      const updated = await resetTokens.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (updated.count !== 1) {
        return false
      }
      if (!updateEmailUserPassword(row.user.providerUserId, parsed.data.password)) {
        throw new Error('Email credential row not found')
      }
      return true
    })
    if (!ok) {
      res.status(400).json({ ok: false, error: 'INVALID_OR_EXPIRED' })
      return
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('[auth][password-reset] confirm failed', e)
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' })
  }
}
