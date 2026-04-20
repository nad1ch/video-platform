/**
 * Prefer AUTH_JWT_SECRET; otherwise `NADLE_JWT_SECRET`.
 */
export function authJwtSecret(): string {
  const s = process.env.AUTH_JWT_SECRET ?? process.env.NADLE_JWT_SECRET
  if (typeof s === 'string' && s.length >= 16) {
    return s
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET or NADLE_JWT_SECRET must be set (>= 16 chars) in production')
  }
  return 'dev-nadle-secret-change-me'
}
