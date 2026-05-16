import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import type { Request, Response } from 'express'
import { isAuthCookieProduction } from '../sessionCookie'

/**
 * Per-flow nonce cookie that binds an OAuth authorization request to its
 * callback (audit S5). The OAuth state JWT carries SHA-256(nonce); the
 * browser carries the raw nonce in this short-lived HttpOnly cookie. The
 * callback must see both and match — otherwise the state was either forged
 * or replayed cross-browser, and we reject before issuing a session.
 *
 * Lifetime is 5 minutes — slightly less than the OAuth state JWT (10 min),
 * so an abandoned flow expires quickly without leaving stale binding data.
 */
const OAUTH_NONCE_COOKIE = 'sa_oauth_nonce'
const OAUTH_NONCE_MAX_AGE_MS = 5 * 60 * 1000

function nonceCookieOptions(maxAgeMs?: number): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge?: number
} {
  const base: {
    httpOnly: true
    secure: boolean
    sameSite: 'lax'
    path: '/'
    maxAge?: number
  } = {
    httpOnly: true,
    secure: isAuthCookieProduction(),
    sameSite: 'lax',
    path: '/',
  }
  if (typeof maxAgeMs === 'number') {
    base.maxAge = maxAgeMs
  }
  return base
}

export function issueOAuthNonce(res: Response): string {
  const nonce = randomBytes(32).toString('base64url')
  res.cookie(OAUTH_NONCE_COOKIE, nonce, nonceCookieOptions(OAUTH_NONCE_MAX_AGE_MS))
  return nonce
}

export function readOAuthNonceCookie(req: Request): string | undefined {
  const raw = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[OAUTH_NONCE_COOKIE]
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

export function clearOAuthNonceCookie(res: Response): void {
  res.clearCookie(OAUTH_NONCE_COOKIE, nonceCookieOptions())
}

export function hashOAuthNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('base64url')
}

/**
 * Constant-time compare of a stored nonce hash (from the state JWT) against
 * the hash of the nonce read from the browser cookie. Length mismatch is an
 * immediate `false`; otherwise we compare via `timingSafeEqual` so an
 * attacker can't infer the prefix from response timing.
 */
export function nonceHashMatches(expectedHash: string, cookieNonce: string): boolean {
  const candidate = hashOAuthNonce(cookieNonce)
  if (candidate.length !== expectedHash.length) {
    return false
  }
  try {
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(expectedHash))
  } catch {
    return false
  }
}
