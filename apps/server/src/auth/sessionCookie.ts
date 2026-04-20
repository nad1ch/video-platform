/**
 * Session cookie flags for `nadle_session` (app shell + nadle share the same cookie name).
 * Production cross-subdomain / SPA↔API setups need SameSite=None + Secure.
 */
export function isAuthCookieProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function sessionCookieBaseOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax' | 'none'
  path: '/'
} {
  const prod = isAuthCookieProduction()
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? 'none' : 'lax',
    path: '/',
  }
}

export function sessionCookieSetOptions(maxAgeMs: number): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax' | 'none'
  path: '/'
  maxAge: number
} {
  return {
    ...sessionCookieBaseOptions(),
    maxAge: maxAgeMs,
  }
}

/** Must match every attribute used in `set` so the browser actually removes the cookie. */
export function sessionCookieClearOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax' | 'none'
  path: '/'
} {
  return sessionCookieBaseOptions()
}
