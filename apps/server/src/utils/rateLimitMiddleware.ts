import type { NextFunction, Request, Response } from 'express'
import { createRateLimiter, getClientIp, type RateLimiter } from './rateLimit'

/**
 * Express middleware factory that applies IP-based rate limiting using the
 * shared {@link createRateLimiter} primitive. Audit S7 mandates limits on
 * state-mutating HTTP routes that currently lack one; this helper keeps the
 * pattern consistent (same key shape, same 429 envelope, same Retry-After
 * header) without duplicating boilerplate per router.
 *
 * Limits are intentionally generous for legitimate stream usage: a host
 * mid-stream may legitimately issue dozens of mutating requests per minute
 * (Eat First reroll, vote clear, settings sync). The point is to blunt
 * scripted abuse, not to throttle real gameplay.
 */
export type IpRateLimitOptions = {
  label: string
  windowMs: number
  limit: number
}

export type RateLimitMiddlewareOptions = {
  /**
   * Optional key derivation. Defaults to `ip:<getClientIp>`. Routes that
   * authenticate first may key by user id instead.
   */
  keyOf?: (req: Request) => string
}

export function createIpRateLimitMiddleware(
  options: IpRateLimitOptions,
  middlewareOptions: RateLimitMiddlewareOptions = {},
): {
  middleware: (req: Request, res: Response, next: NextFunction) => void
  limiter: RateLimiter
} {
  const limiter = createRateLimiter({
    label: options.label,
    windowMs: options.windowMs,
    limit: options.limit,
  })
  const keyOf = middlewareOptions.keyOf ?? ((req: Request): string => `ip:${getClientIp(req)}`)

  function middleware(req: Request, res: Response, next: NextFunction): void {
    const result = limiter.tryConsume(keyOf(req))
    if (result.allowed) {
      next()
      return
    }
    res.setHeader('Retry-After', String(result.retryAfterSec))
    res.status(429).json({ error: 'RATE_LIMITED', retryAfterSec: result.retryAfterSec })
  }

  return { middleware, limiter }
}
