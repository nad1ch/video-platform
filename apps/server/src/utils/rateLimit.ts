import type { Request } from 'express'

/**
 * Tiny in-memory rolling-window rate limiter with a periodic reaper.
 *
 * - Each call to `tryConsume(key)` returns `allowed` + the seconds until the
 *   window resets. Counter starts fresh when the previous window expires.
 * - Buckets are pruned by a single interval per limiter; interval `.unref()`ed
 *   so it never keeps the process alive.
 * - Intended for auth / OAuth / password-reset style low-volume endpoints.
 *   For very high-volume RPC paths, prefer Redis-backed limits.
 *
 * Known infra limitation (multi-instance deployments):
 *   Buckets are per-process. If the API is horizontally scaled behind a load
 *   balancer, the effective limit becomes `limit × instanceCount` because each
 *   instance tracks its own counter. This is acceptable for enumeration-blunting
 *   use cases (IP-level caps remain meaningful), but NOT sufficient as a hard
 *   security boundary. For a hard cap across instances, migrate to a shared
 *   store (Redis `INCR` + `EXPIRE`, SQL `SELECT ... FOR UPDATE`, etc.) — no
 *   such store is wired into this codebase today, which is why this file is
 *   in-memory only.
 *
 * Keys are opaque — callers build them by composing (kind, value), e.g.
 * `ip:1.2.3.4` or `email:user@example.com`. Always normalize the value
 * component before keying (e.g. `normalizeEmail`) so logical aliases collapse.
 */

const DEFAULT_REAP_MIN_MS = 60_000

type Bucket = { count: number; resetAt: number }

export type RateLimitOptions = {
  
  windowMs: number
  
  limit: number
  
  label: string
  
  reapEveryMs?: number
}

export type RateLimitResult =
  | { allowed: true; retryAfterSec: 0 }
  | { allowed: false; retryAfterSec: number }

export type RateLimiter = {
  tryConsume(key: string): RateLimitResult
  
  reset(key: string): void
  
  stop(): void
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const windowMs = Math.max(1_000, Math.floor(options.windowMs))
  const limit = Math.max(1, Math.floor(options.limit))
  const reapEveryMs = Math.max(
    DEFAULT_REAP_MIN_MS,
    Math.floor(options.reapEveryMs ?? windowMs),
  )
  const buckets = new Map<string, Bucket>()

  const reaper = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) {
        buckets.delete(k)
      }
    }
  }, reapEveryMs)
  if (typeof reaper.unref === 'function') {
    reaper.unref()
  }

  function tryConsume(key: string): RateLimitResult {
    const now = Date.now()
    const current = buckets.get(key)
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return { allowed: true, retryAfterSec: 0 }
    }
    current.count += 1
    if (current.count <= limit) {
      return { allowed: true, retryAfterSec: 0 }
    }
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[rate-limit] ${options.label} denied`, {
        key: key.slice(0, 80),
        count: current.count,
        limit,
        retryAfterSec,
      })
    }
    return { allowed: false, retryAfterSec }
  }

  function reset(key: string): void {
    buckets.delete(key)
  }

  function stop(): void {
    clearInterval(reaper)
    buckets.clear()
  }

  return { tryConsume, reset, stop }
}

/**
 * Best-effort client IP for rate-limit keys. Honors the first `x-forwarded-for`
 * entry when set (matches reverse-proxy deployments); falls back to `req.ip`.
 * Returns `'unknown'` when nothing is available.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (typeof raw === 'string' && raw.length > 0) {
    const first = raw.split(',')[0]?.trim()
    if (first && first.length > 0) {
      return first
    }
  }
  const ip = typeof req.ip === 'string' ? req.ip.trim() : ''
  return ip.length > 0 ? ip : 'unknown'
}
