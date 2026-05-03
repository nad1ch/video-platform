import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { isDatabaseConfigured, prisma } from '../../prisma'
import { clientPublicOrigin } from '../clientOrigin'
import { resolvePrismaUserIdFromSession } from '../resolvePrismaUserFromSession'
import { readSessionFromCookie } from '../session/sessionJwt'
import { sendVerificationEmail } from './emailVerificationMailer'
import { resolveEmailRequestOrigin } from './emailRequestOrigin'
import { resolveEmailLocale } from './emailTemplates'

const TOKEN_BYTES = 32
const TOKEN_TTL_MINUTES = 30
const TOKEN_TTL_MS = TOKEN_TTL_MINUTES * 60 * 1000
const SEND_COOLDOWN_MS = 5 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function createRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function buildVerificationUrl(req: Request, token: string): string {
  const url = new URL('/api/auth/email-verification/verify', resolveEmailRequestOrigin(req))
  url.searchParams.set('token', token)
  return url.toString()
}

function requestLocale(req: Request): 'en' | 'uk' {
  const body = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}
  return resolveEmailLocale({
    locale: (body as { locale?: unknown }).locale,
    acceptLanguage: req.header('accept-language'),
  })
}

function redirectToApp(res: Response, query: Record<string, string>): void {
  const url = new URL('/app', clientPublicOrigin())
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  res.redirect(302, url.toString())
}

/** POST /api/auth/email-verification/send */
export async function handleSendEmailVerification(req: Request, res: Response): Promise<void> {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ ok: false, error: 'UNAUTHENTICATED' })
    return
  }
  if (!isDatabaseConfigured()) {
    res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' })
    return
  }

  const userId = await resolvePrismaUserIdFromSession(session)
  if (!userId) {
    res.status(400).json({ ok: false, error: 'EMAIL_UNAVAILABLE' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      displayName: true,
    },
  })
  if (!user?.email) {
    res.status(400).json({ ok: false, error: 'EMAIL_UNAVAILABLE' })
    return
  }
  if (user.emailVerified) {
    res.json({ ok: true })
    return
  }

  const latest = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (latest && Date.now() - latest.createdAt.getTime() < SEND_COOLDOWN_MS) {
    res.json({ ok: true })
    return
  }

  const rawToken = createRawToken()
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })

  try {
    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl: buildVerificationUrl(req, rawToken),
      expiresInMinutes: TOKEN_TTL_MINUTES,
      locale: requestLocale(req),
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('[auth][email-verification] send failed', e)
    res.status(503).json({ ok: false, error: 'EMAIL_SEND_FAILED' })
  }
}

/** GET /api/auth/email-verification/verify?token=... */
export async function handleVerifyEmail(req: Request, res: Response): Promise<void> {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
  if (token.length < 24 || token.length > 256) {
    redirectToApp(res, { emailVerification: 'failed' })
    return
  }

  if (!isDatabaseConfigured()) {
    redirectToApp(res, { emailVerification: 'failed' })
    return
  }

  const tokenHash = hashToken(token)
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    redirectToApp(res, { emailVerification: 'failed' })
    return
  }

  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    const updatedToken = await tx.emailVerificationToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })
    if (updatedToken.count !== 1) {
      return false
    }
    await tx.user.update({
      where: { id: row.userId },
      data: { emailVerified: true, emailVerifiedAt: now },
    })
    return true
  })

  redirectToApp(res, result ? { emailVerified: '1' } : { emailVerification: 'failed' })
}
