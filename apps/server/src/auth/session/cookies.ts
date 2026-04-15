import type { Response } from 'express'
import { sessionCookieClearOptions, sessionCookieSetOptions } from '../sessionCookie'
import { WORDLE_SESSION_COOKIE, WORDLE_SESSION_MAX_AGE_SEC } from './sessionJwt'

export function setGlobalSessionCookie(res: Response, token: string): void {
  res.cookie(WORDLE_SESSION_COOKIE, token, sessionCookieSetOptions(WORDLE_SESSION_MAX_AGE_SEC * 1000))
}

export function clearGlobalSessionCookie(res: Response): void {
  res.clearCookie(WORDLE_SESSION_COOKIE, sessionCookieClearOptions())
}
