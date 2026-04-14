import jwt from 'jsonwebtoken'
import type { SessionUser } from './types'

const COOKIE_NAME = 'wordle_session'

function jwtSecret(): string {
  const s = process.env.WORDLE_JWT_SECRET
  if (typeof s === 'string' && s.length >= 16) {
    return s
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WORDLE_JWT_SECRET must be set (>= 16 chars) in production')
  }
  return 'dev-wordle-secret-change-me'
}

export type SessionPayload = SessionUser & { iat?: number; exp?: number }

export function signSession(user: SessionUser, maxAgeSec: number): string {
  return jwt.sign(
    {
      id: user.id,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url,
    },
    jwtSecret(),
    { expiresIn: maxAgeSec },
  )
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret()) as SessionPayload
    if (
      typeof decoded.id !== 'string' ||
      typeof decoded.display_name !== 'string' ||
      typeof decoded.profile_image_url !== 'string'
    ) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

export function readSessionFromCookie(cookieHeader: string | undefined): SessionPayload | null {
  if (!cookieHeader) {
    return null
  }
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx === -1) {
      continue
    }
    const name = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (name === COOKIE_NAME && val) {
      return verifySessionToken(decodeURIComponent(val))
    }
  }
  return null
}

export const WORDLE_SESSION_COOKIE = COOKIE_NAME
export const WORDLE_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7
