import type { Response } from 'express'
import { sessionCookieClearOptions, sessionCookieSetOptions } from '../sessionCookie'
import { NADLE_SESSION_COOKIE, NADLE_SESSION_MAX_AGE_SEC } from './sessionJwt'

export function setGlobalSessionCookie(res: Response, token: string): void {
  res.cookie(NADLE_SESSION_COOKIE, token, sessionCookieSetOptions(NADLE_SESSION_MAX_AGE_SEC * 1000))
}

export function clearGlobalSessionCookie(res: Response): void {
  res.clearCookie(NADLE_SESSION_COOKIE, sessionCookieClearOptions())
}
