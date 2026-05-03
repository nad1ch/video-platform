import type { Request } from 'express'
import { clientPublicOrigin } from '../clientOrigin'

/**
 * Resolve the origin used to build outgoing email links (verification /
 * password-reset). In production this MUST NOT trust client-controlled
 * `x-forwarded-host` / `x-forwarded-proto` / `Host` headers, because a
 * request-smuggling or misconfigured-proxy attacker could inject a hostile
 * host into the email and steal single-use tokens from the victim's click.
 *
 * Precedence:
 *   1. `EMAIL_VERIFICATION_ORIGIN` or `API_ORIGIN` env (trusted).
 *   2. Production: `clientPublicOrigin()` (requires `BASE_URL` /
 *      `NADLE_CLIENT_ORIGIN`; throws loudly at boot/send-time if unset so
 *      the issue surfaces in deploy rather than in spoofed emails).
 *   3. Dev/test: forwarded headers / Host header for local-proxy convenience.
 *      These are ONLY safe outside production.
 */
export function resolveEmailRequestOrigin(req: Request): string {
  const configured = process.env.EMAIL_VERIFICATION_ORIGIN ?? process.env.API_ORIGIN
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'production') {
    return clientPublicOrigin()
  }
  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || req.header('host')
  if (host) {
    return `${forwardedProto || req.protocol}://${host}`.replace(/\/$/, '')
  }
  return clientPublicOrigin()
}
