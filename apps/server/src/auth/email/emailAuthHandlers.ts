import type { Request, Response } from 'express'
import { z } from 'zod'
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

function toPublicUser(session: SessionUser): GlobalAuthUser {
  return {
    id: session.id,
    displayName: session.display_name,
    provider: 'email',
    role: session.role,
  }
}

function sendSession(res: Response, session: SessionUser, created: boolean, status: number): void {
  const token = signSession(session, NADLE_SESSION_MAX_AGE_SEC)
  setGlobalSessionCookie(res, token)
  res.status(status).json({
    ok: true,
    created,
    user: toPublicUser(session),
  })
}

/** POST /api/auth/register */
export function handleEmailRegister(req: Request, res: Response): void {
  const parsed = registerBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION' })
    return
  }
  const { email, password, displayName } = parsed.data
  const normalized = normalizeEmail(email)
  if (findUserByEmail(normalized)) {
    res.status(409).json({ error: 'EMAIL_TAKEN' })
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
    sendSession(res, session, true, 201)
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

/** POST /api/auth/login */
export function handleEmailLogin(req: Request, res: Response): void {
  const parsed = loginBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION' })
    return
  }
  const { email, password } = parsed.data
  const row = findUserByEmail(email)
  if (!row || !verifyPassword(row, password)) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    return
  }
  const session = rowToSessionUser(row)
  sendSession(res, session, false, 200)
}
