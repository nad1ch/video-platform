import type { Request, Response } from 'express'
import { prisma } from '../../prisma'
import { resolvePrismaUserIdFromSession, resolveWordleStreamerContextForUserId } from '../resolvePrismaUserFromSession'
import { readSessionFromCookie } from './sessionJwt'
import { sessionToGlobalAuthUser, sessionToLegacyApiUser } from './globalUser'

/** GET /api/auth/me — global camelCase user. */
export async function handleGetApiAuthMe(req: Request, res: Response): Promise<void> {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ authenticated: false })
    return
  }
  try {
    const prismaUserId = await resolvePrismaUserIdFromSession(session)
    let dbRole: string | null = null
    if (prismaUserId) {
      const row = await prisma.user.findUnique({
        where: { id: prismaUserId },
        select: { role: true },
      })
      dbRole = row?.role ?? null
    }
    const base = sessionToGlobalAuthUser(session, dbRole)
    const wordle =
      prismaUserId != null ? await resolveWordleStreamerContextForUserId(prismaUserId) : null
    res.json({
      authenticated: true,
      user: {
        ...base,
        ...(prismaUserId ? { dbUserId: prismaUserId } : {}),
        ...(wordle
          ? { wordleStreamerId: wordle.wordleStreamerId, wordleStreamerName: wordle.wordleStreamerName }
          : {}),
      },
    })
  } catch (e) {
    console.error('[auth] GET /api/auth/me enrichment failed', e)
    res.json({ authenticated: true, user: sessionToGlobalAuthUser(session) })
  }
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
