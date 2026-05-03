import type { Request, Response } from 'express'
import { z } from 'zod'
import { isDatabaseConfigured, prisma } from '../../prisma'
import { createRateLimiter, getClientIp, type RateLimiter } from '../../utils/rateLimit'
import { setGlobalSessionCookie } from '../session/cookies'
import { signSession, NADLE_SESSION_MAX_AGE_SEC } from '../session/sessionJwt'
import type { GlobalAuthUser, SessionUser } from '../session/types'
import { withSessionRole } from '../session/withSessionRole'
import { createEmailUser, findUserByEmail, normalizeEmail, verifyPassword } from './emailUserService'

const registerBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(6).max(128),
  displayName: z.string().max(80).optional(),
})

const loginBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
})

/**
 * Rate limiters for email auth endpoints. Two keys per request (IP and
 * normalized email) so one abuser on a shared NAT does not lock out another
 * user, and a credential-stuffer cycling emails still hits the per-IP cap.
 * Values are conservative production defaults — legitimate users almost
 * never hit them even on retry loops.
 */
const loginIpLimiter: RateLimiter = createRateLimiter({
  label: 'auth:login:ip',
  windowMs: 5 * 60 * 1000,
  limit: 10,
})
const loginEmailLimiter: RateLimiter = createRateLimiter({
  label: 'auth:login:email',
  windowMs: 15 * 60 * 1000,
  limit: 8,
})
const registerIpLimiter: RateLimiter = createRateLimiter({
  label: 'auth:register:ip',
  windowMs: 15 * 60 * 1000,
  limit: 5,
})
const registerEmailLimiter: RateLimiter = createRateLimiter({
  label: 'auth:register:email',
  windowMs: 15 * 60 * 1000,
  limit: 3,
})

function denyRateLimited(res: Response, retryAfterSec: number): void {
  res.setHeader('Retry-After', String(retryAfterSec))
  res.status(429).json({ error: 'RATE_LIMITED', retryAfterSec })
}

function rowToSessionUser(row: { id: string; display_name: string; email: string }): SessionUser {
  const dn = row.display_name.trim()
  const fallback = row.email.includes('@') ? row.email.split('@')[0] : 'User'
  const normalizedEmail = normalizeEmail(row.email)
  return withSessionRole({
    id: row.id,
    display_name: dn.length > 0 ? dn : fallback || 'User',
    profile_image_url: '',
    provider: 'email',
    email: normalizedEmail,
  })
}

type EmailVerificationState = {
  email: string | null
  emailVerified: boolean
  emailVerifiedAt: Date | null
}

type EmailSyncResult =
  | { ok: true; state: EmailVerificationState | null }
  | { ok: false; error: 'ACCOUNT_LINK_REQUIRED' | 'SERVER_ERROR' }

async function prismaEmailOwner(email: string): Promise<{ provider: string; providerUserId: string } | null> {
  if (!isDatabaseConfigured()) {
    return null
  }
  const row = await prisma.user.findUnique({
    where: { email },
    select: { provider: true, providerUserId: true },
  })
  return row ?? null
}

async function ensurePrismaEmailUser(
  row: { id: string; email: string; display_name: string },
  session: SessionUser,
): Promise<EmailSyncResult> {
  if (!isDatabaseConfigured()) {
    return { ok: true, state: null }
  }
  const email = normalizeEmail(row.email)
  const select = { email: true, emailVerified: true, emailVerifiedAt: true } satisfies {
    email: true
    emailVerified: true
    emailVerifiedAt: true
  }
  try {
    const byProvider = await prisma.user.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'email',
          providerUserId: row.id,
        },
      },
      select,
    })
    if (byProvider) {
      const state = await prisma.user.update({
        where: {
          provider_providerUserId: {
            provider: 'email',
            providerUserId: row.id,
          },
        },
        data: {
          email,
          displayName: session.display_name,
          role: session.role,
        },
        select,
      })
      return { ok: true, state }
    }

    const owner = await prismaEmailOwner(email)
    if (owner) {
      return { ok: false, error: 'ACCOUNT_LINK_REQUIRED' }
    }

    const state = await prisma.user.create({
      data: {
        id: row.id,
        provider: 'email',
        providerUserId: row.id,
        email,
        emailVerified: false,
        displayName: session.display_name,
        avatarUrl: null,
        role: session.role,
        twitchId: null,
        stats: { create: {} },
      },
      select,
    })
    return { ok: true, state }
  } catch (e) {
    console.error('[auth][email] Prisma user sync failed', e)
    return { ok: false, error: 'SERVER_ERROR' }
  }
}

function toPublicUser(session: SessionUser, verification?: EmailVerificationState | null): GlobalAuthUser {
  const email = verification?.email ?? session.email
  return {
    id: session.id,
    displayName: session.display_name,
    provider: 'email',
    ...(email ? { email } : {}),
    ...(email ? { emailVerified: verification?.emailVerified ?? false } : {}),
    ...(verification?.emailVerifiedAt ? { emailVerifiedAt: verification.emailVerifiedAt.toISOString() } : {}),
    role: session.role,
  }
}

function sendSession(
  res: Response,
  session: SessionUser,
  created: boolean,
  status: number,
  verification?: EmailVerificationState | null,
): void {
  const token = signSession(session, NADLE_SESSION_MAX_AGE_SEC)
  setGlobalSessionCookie(res, token)
  res.status(status).json({
    ok: true,
    created,
    user: toPublicUser(session, verification),
  })
}


export async function handleEmailRegister(req: Request, res: Response): Promise<void> {
  
  
  const ipCheck = registerIpLimiter.tryConsume(`ip:${getClientIp(req)}`)
  if (!ipCheck.allowed) {
    denyRateLimited(res, ipCheck.retryAfterSec)
    return
  }
  const parsed = registerBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION' })
    return
  }
  const { email, password, displayName } = parsed.data
  const normalized = normalizeEmail(email)
  
  
  const emailCheck = registerEmailLimiter.tryConsume(`email:${normalized}`)
  if (!emailCheck.allowed) {
    denyRateLimited(res, emailCheck.retryAfterSec)
    return
  }
  if (findUserByEmail(normalized)) {
    res.status(409).json({ error: 'EMAIL_TAKEN' })
    return
  }
  try {
    const owner = await prismaEmailOwner(normalized)
    if (owner) {
      res.status(409).json({ error: 'ACCOUNT_LINK_REQUIRED' })
      return
    }
  } catch (e) {
    console.error('[auth][email] register Prisma preflight failed', e)
    res.status(500).json({ error: 'SERVER_ERROR' })
    return
  }
  const disp =
    typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName.trim()
      : normalized.includes('@')
        ? normalized.split('@')[0]!
        : 'User'
  try {
    const row = createEmailUser(normalized, password, disp)
    const session = rowToSessionUser(row)
    const verification = await ensurePrismaEmailUser(row, session)
    if (!verification.ok) {
      res.status(verification.error === 'ACCOUNT_LINK_REQUIRED' ? 409 : 500).json({ error: verification.error })
      return
    }
    sendSession(res, session, true, 201, verification.state)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'EMAIL_TAKEN' })
      return
    }
    console.error('[auth][email] register', e)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
}


export async function handleEmailLogin(req: Request, res: Response): Promise<void> {
  
  const ipCheck = loginIpLimiter.tryConsume(`ip:${getClientIp(req)}`)
  if (!ipCheck.allowed) {
    denyRateLimited(res, ipCheck.retryAfterSec)
    return
  }
  const parsed = loginBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION' })
    return
  }
  const { email, password } = parsed.data
  const normalized = normalizeEmail(email)
  
  
  const emailCheck = loginEmailLimiter.tryConsume(`email:${normalized}`)
  if (!emailCheck.allowed) {
    denyRateLimited(res, emailCheck.retryAfterSec)
    return
  }
  const row = findUserByEmail(normalized)
  if (!row || !verifyPassword(row, password)) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    return
  }
  const session = rowToSessionUser(row)
  const verification = await ensurePrismaEmailUser(row, session)
  if (!verification.ok) {
    res.status(verification.error === 'ACCOUNT_LINK_REQUIRED' ? 409 : 500).json({ error: verification.error })
    return
  }
  
  
  loginIpLimiter.reset(`ip:${getClientIp(req)}`)
  loginEmailLimiter.reset(`email:${normalized}`)
  sendSession(res, session, false, 200, verification.state)
}
