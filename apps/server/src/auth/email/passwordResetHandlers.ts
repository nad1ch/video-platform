import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { isDatabaseConfigured, prisma } from '../../prisma'
import { clientPublicOrigin } from '../clientOrigin'
import { resolveUserRole } from '../resolveUserRole'
import { findUserByEmail, normalizeEmail, updateEmailUserPassword } from './emailUserService'
import { sendPasswordResetEmail } from './emailVerificationMailer'

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

function requestOrigin(req: Request): string {
  const configured = process.env.EMAIL_VERIFICATION_ORIGIN ?? process.env.API_ORIGIN
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, '')
  }
  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || req.header('host')
  if (host) {
    return `${forwardedProto || req.protocol}://${host}`.replace(/\/$/, '')
  }
  return clientPublicOrigin()
}

function buildResetUrl(req: Request, token: string): string {
  const url = new URL('/auth', clientPublicOrigin())
  url.searchParams.set('mode', 'reset')
  url.searchParams.set('token', token)
  const apiOrigin = requestOrigin(req)
  if (apiOrigin.length === 0) {
    return url.toString()
  }
  return url.toString()
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

  try {
    const row = findUserByEmail(parsed.data.email)
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
      resetUrl: buildResetUrl(req, rawToken),
      expiresInMinutes: TOKEN_TTL_MINUTES,
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
