import type { Request, Response } from 'express'
import { prisma } from '../../prisma'
import {
  resolvePrismaUserIdFromSession,
  resolveNadleStreamerContextForUserId,
  resolveUserStreamerContext,
} from '../resolvePrismaUserFromSession'
import { readSessionFromCookie } from './sessionJwt'
import { sessionToGlobalAuthUser, sessionToLegacyApiUser } from './globalUser'
import type { FeaturePermission, SystemRole, UserRole } from './types'

function buildSystemRoles(role: UserRole, hasStreamer: boolean): SystemRole[] {
  const roles: SystemRole[] = ['USER']
  if (role === 'admin') {
    roles.push('ADMIN')
  }
  if (hasStreamer) {
    roles.push('STREAMER')
  }
  return roles
}

function buildFeaturePermissions(dbRole: string | null): FeaturePermission[] | undefined {
  return dbRole === 'host' ? ['EAT_FIRST_OPERATOR'] : undefined
}


export async function handleGetApiAuthMe(req: Request, res: Response): Promise<void> {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ authenticated: false })
    return
  }
  try {
    const prismaUserId = await resolvePrismaUserIdFromSession(session)
    let dbRole: string | null = null
    let dbEmail: string | null = null
    let dbEmailVerified: boolean | null = null
    let dbEmailVerifiedAt: Date | null = null
    if (prismaUserId) {
      const row = await prisma.user.findUnique({
        where: { id: prismaUserId },
        select: { role: true, email: true, emailVerified: true, emailVerifiedAt: true },
      })
      dbRole = row?.role ?? null
      dbEmail = row?.email ?? null
      dbEmailVerified = row?.emailVerified ?? null
      dbEmailVerifiedAt = row?.emailVerifiedAt ?? null
    }
    const base = sessionToGlobalAuthUser(session, dbRole)
    const email = dbEmail ?? base.email
    const emailVerified =
      typeof dbEmailVerified === 'boolean'
        ? dbEmailVerified
        : typeof email === 'string' && email.length > 0
          ? false
          : undefined
    const streamer =
      prismaUserId != null ? await resolveUserStreamerContext(prismaUserId) : null
    const nadleStreamer =
      prismaUserId != null ? await resolveNadleStreamerContextForUserId(prismaUserId) : null
    const permissions = buildFeaturePermissions(dbRole)
    res.json({
      authenticated: true,
      user: {
        ...base,
        roles: buildSystemRoles(base.role, streamer != null),
        ...(typeof email === 'string' && email.length > 0 ? { email } : {}),
        ...(typeof emailVerified === 'boolean' ? { emailVerified } : {}),
        ...(dbEmailVerifiedAt ? { emailVerifiedAt: dbEmailVerifiedAt.toISOString() } : {}),
        ...(permissions ? { permissions } : {}),
        ...(streamer ? { streamer } : {}),
        ...(prismaUserId ? { dbUserId: prismaUserId } : {}),
        ...(nadleStreamer
          ? {
              nadleStreamerId: nadleStreamer.nadleStreamerId,
              nadleStreamerName: nadleStreamer.nadleStreamerName,
            }
          : {}),
      },
    })
  } catch (e) {
    console.error('[auth] GET /api/auth/me enrichment failed', e)
    res.json({ authenticated: true, user: sessionToGlobalAuthUser(session) })
  }
}


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




export function handleGetNadleMe(req: Request, res: Response): void {
  const session = readSessionFromCookie(req.headers.cookie)
  if (!session) {
    res.status(401).json({ authenticated: false })
    return
  }
  res.json(sessionToLegacyApiUser(session))
}
