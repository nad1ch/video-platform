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
const OAUTH_STATE_MAX_AGE_MS = OAUTH_STATE_MAX_AGE_SEC * 1000

export function signOAuthReturnPath(redirectPath: string): string {
  return jwt.sign({ typ: OAUTH_STATE_TYP, r: redirectPath }, authJwtSecret(), {
    expiresIn: OAUTH_STATE_MAX_AGE_SEC,
  })
}

/**
 * Single-use marker for `verifyOAuthReturnPath`. A state that validates once
 * is recorded here with its expiry; a second verify of the same string falls
 * back to the default redirect (treated as an invalid state).
 *
 * The map is bounded: a periodic reaper drops expired entries, and the map
 * would reach steady state at ~one entry per concurrent in-flight OAuth
 * login within the 10-minute window.
 */
const seenOAuthStates = new Map<string, number>()

const OAUTH_STATE_REAP_INTERVAL_MS = 60_000
const oauthStateReaper = setInterval(() => {
  const now = Date.now()
  for (const [k, expiresAt] of seenOAuthStates) {
    if (expiresAt <= now) {
      seenOAuthStates.delete(k)
    }
  }
}, OAUTH_STATE_REAP_INTERVAL_MS)
if (typeof oauthStateReaper.unref === 'function') {
  oauthStateReaper.unref()
}

export function verifyOAuthReturnPath(state: string | undefined): string {
  if (!state || typeof state !== 'string') {
    return '/'
  }
  try {
    const decoded = jwt.verify(state, authJwtSecret()) as {
      typ?: string
      r?: unknown
      exp?: number
    }
    if (decoded.typ !== OAUTH_STATE_TYP || typeof decoded.r !== 'string') {
      return '/'
    }
    // Single-use replay guard. A legitimate OAuth login consumes the state
    // exactly once; a replay from a captured state string falls back to the
    // safe default path. `exp` is in seconds; we cache up to the same window
    // so the entry cannot outlive the JWT expiry.
    if (seenOAuthStates.has(state)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth][oauth] rejected state replay')
      }
      return '/'
    }
    const expMs =
      typeof decoded.exp === 'number'
        ? decoded.exp * 1000
        : Date.now() + OAUTH_STATE_MAX_AGE_MS
    seenOAuthStates.set(state, expMs)
    return decoded.r
  } catch {
    return '/'
  }
}
