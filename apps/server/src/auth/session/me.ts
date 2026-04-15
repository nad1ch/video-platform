import type { Request, Response } from 'express'
import { readSessionFromCookie } from './sessionJwt'
import { sessionToGlobalAuthUser, sessionToLegacyApiUser } from './globalUser'

/** GET /api/auth/me — global camelCase user. */
export function handleGetApiAuthMe(req: Request, res: Response): void {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ authenticated: false })
    return
  }
  res.json({
    authenticated: true,
    user: sessionToGlobalAuthUser(session),
  })
}

/** GET /api/me — deprecated shape; kept for backward compatibility. */
export function handleGetApiMeLegacy(req: Request, res: Response): void {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ authenticated: false })
    return
  }
  res.json({
    authenticated: true,
    user: sessionToLegacyApiUser(session),
  })
}

/**
 * GET /api/wordle/me — historical flat body (no `authenticated` wrapper).
 */
export function handleGetWordleMe(req: Request, res: Response): void {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ authenticated: false })
    return
  }
  res.json(sessionToLegacyApiUser(session))
}
