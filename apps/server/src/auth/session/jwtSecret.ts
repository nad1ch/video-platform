/**
 * JWT signing secret resolver for the session cookie and OAuth state JWTs.
 *
 * Hard rules (audit #40, #42):
 * - Minimum length is 32 chars (raised from 16).
 * - Production REQUIRES `AUTH_JWT_SECRET` (or legacy `NADLE_JWT_SECRET`); no
 *   fallback is ever permitted in production.
 * - The dev fallback string is only returned when `ALLOW_DEV_JWT_SECRET=1`
 *   AND `NODE_ENV !== 'production'`. This prevents a misconfigured staging
 *   or preview environment from silently signing tokens with the public
 *   dev placeholder.
 */
const MIN_AUTH_JWT_SECRET_LEN = 32
const DEV_FALLBACK_SECRET = 'dev-nadle-secret-change-me-32chars-min'

export function authJwtSecret(): string {
  const s = process.env.AUTH_JWT_SECRET ?? process.env.NADLE_JWT_SECRET
  if (typeof s === 'string' && s.length >= MIN_AUTH_JWT_SECRET_LEN) {
    return s
  }
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    throw new Error(
      `AUTH_JWT_SECRET (or NADLE_JWT_SECRET) must be set with length >= ${MIN_AUTH_JWT_SECRET_LEN} in production`,
    )
  }
  if (process.env.ALLOW_DEV_JWT_SECRET === '1') {
    return DEV_FALLBACK_SECRET
  }
  throw new Error(
    `AUTH_JWT_SECRET (or NADLE_JWT_SECRET) must be set with length >= ${MIN_AUTH_JWT_SECRET_LEN}. ` +
      'For local development without setting a real secret, export ALLOW_DEV_JWT_SECRET=1 (never in production).',
  )
}
