/**
 * Prefer AUTH_JWT_SECRET; WORDLE_JWT_SECRET remains supported for existing deployments.
 */
export function authJwtSecret(): string {
  const s = process.env.AUTH_JWT_SECRET ?? process.env.WORDLE_JWT_SECRET
  if (typeof s === 'string' && s.length >= 16) {
    return s
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET or WORDLE_JWT_SECRET must be set (>= 16 chars) in production')
  }
  return 'dev-wordle-secret-change-me'
}
