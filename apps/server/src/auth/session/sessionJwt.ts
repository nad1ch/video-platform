import jwt from 'jsonwebtoken'
import { authJwtSecret } from './jwtSecret'
import type { SessionUser, UserRole } from './types'

const COOKIE_NAME = 'nadle_session'

export type SessionPayload = SessionUser & { iat?: number; exp?: number }

export function signSession(user: SessionUser, maxAgeSec: number): string {
  const payload: Record<string, unknown> = {
    id: user.id,
    display_name: user.display_name,
    profile_image_url: user.profile_image_url,
    role: user.role,
  }
  if (user.provider) {
    payload.provider = user.provider
  }
  if (typeof user.email === 'string' && user.email.length > 0) {
    payload.email = user.email
  }
  if (typeof user.twitch_id === 'string' && user.twitch_id.length > 0) {
    payload.twitch_id = user.twitch_id
  }
  return jwt.sign(payload, authJwtSecret(), { expiresIn: maxAgeSec })
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, authJwtSecret()) as SessionPayload
    if (
      typeof decoded.id !== 'string' ||
      typeof decoded.display_name !== 'string' ||
      typeof decoded.profile_image_url !== 'string'
    ) {
      return null
    }
    const p = decoded.provider
    if (p !== undefined && p !== 'twitch' && p !== 'google' && p !== 'apple' && p !== 'email') {
      return null
    }
    const r = decoded.role
    const role: UserRole = r === 'admin' || r === 'user' ? r : 'user'
    decoded.role = role
    if (decoded.email !== undefined && typeof decoded.email !== 'string') {
      return null
    }
    if (decoded.twitch_id !== undefined && typeof decoded.twitch_id !== 'string') {
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

/** Cookie name kept for non-breaking browser sessions. */
export const NADLE_SESSION_COOKIE = COOKIE_NAME
export const NADLE_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

const OAUTH_STATE_TYP = 'oauth_return'
const OAUTH_STATE_MAX_AGE_SEC = 600

export function signOAuthReturnPath(redirectPath: string): string {
  return jwt.sign({ typ: OAUTH_STATE_TYP, r: redirectPath }, authJwtSecret(), {
    expiresIn: OAUTH_STATE_MAX_AGE_SEC,
  })
}

export function verifyOAuthReturnPath(state: string | undefined): string {
  if (!state || typeof state !== 'string') {
    return '/'
  }
  try {
    const decoded = jwt.verify(state, authJwtSecret()) as { typ?: string; r?: unknown }
    if (decoded.typ !== OAUTH_STATE_TYP || typeof decoded.r !== 'string') {
      return '/'
    }
    return decoded.r
  } catch {
    return '/'
  }
}
