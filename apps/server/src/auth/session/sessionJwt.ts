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
    const decoded = jwt.verify(token, authJwtSecret(), { algorithms: ['HS256'] }) as SessionPayload
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


export const NADLE_SESSION_COOKIE = COOKIE_NAME
export const NADLE_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

const OAUTH_STATE_TYP = 'oauth_return'
const OAUTH_STATE_MAX_AGE_SEC = 600
const OAUTH_STATE_MAX_AGE_MS = OAUTH_STATE_MAX_AGE_SEC * 1000

/**
 * Single-use marker for {@link verifyOAuthState}. A state that validates once
 * is recorded here with its expiry; a second verify of the same string is
 * rejected. The map is bounded by the 10-minute state JWT TTL and reaped on
 * a 60s interval.
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

export function signOAuthReturnPath(redirectPath: string, nonceHash?: string): string {
  const payload: { typ: string; r: string; n?: string } = { typ: OAUTH_STATE_TYP, r: redirectPath }
  if (typeof nonceHash === 'string' && nonceHash.length > 0) {
    payload.n = nonceHash
  }
  return jwt.sign(payload, authJwtSecret(), {
    expiresIn: OAUTH_STATE_MAX_AGE_SEC,
  })
}

export type VerifiedOAuthState =
  | { ok: true; redirectPath: string; nonceHash: string | undefined }
  | { ok: false }

/**
 * Strict verifier used by the OAuth callbacks (audit S5). Returns
 * `{ ok: false }` for any of: missing state, bad signature/expiry, wrong
 * `typ`, missing path, or replay. Callers must reject the request with 400
 * in that case.
 *
 * Nonce-cookie binding is enforced *outside* this function — the router
 * reads the nonce cookie, hashes it, and compares against `nonceHash`
 * from the returned state. We surface `nonceHash` here rather than
 * passing the cookie in to keep this module pure and testable.
 */
export function verifyOAuthState(state: string | undefined): VerifiedOAuthState {
  if (!state || typeof state !== 'string') {
    return { ok: false }
  }
  try {
    const decoded = jwt.verify(state, authJwtSecret(), { algorithms: ['HS256'] }) as {
      typ?: string
      r?: unknown
      n?: unknown
      exp?: number
    }
    if (decoded.typ !== OAUTH_STATE_TYP || typeof decoded.r !== 'string') {
      return { ok: false }
    }
    if (seenOAuthStates.has(state)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth][oauth] rejected state replay')
      }
      return { ok: false }
    }
    const expMs =
      typeof decoded.exp === 'number'
        ? decoded.exp * 1000
        : Date.now() + OAUTH_STATE_MAX_AGE_MS
    seenOAuthStates.set(state, expMs)
    return {
      ok: true,
      redirectPath: decoded.r,
      nonceHash: typeof decoded.n === 'string' ? decoded.n : undefined,
    }
  } catch {
    return { ok: false }
  }
}
