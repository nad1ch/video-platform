import { prisma } from '../prisma'
import { resolveUserStreamerContext } from './resolvePrismaUserFromSession'
import type { FeaturePermission, SystemRole } from './session/types'

export const SYSTEM_ROLES = ['USER', 'ADMIN', 'STREAMER'] as const satisfies readonly SystemRole[]
export const FEATURE_PERMISSIONS = ['EAT_FIRST_OPERATOR'] as const satisfies readonly FeaturePermission[]
export type ManagedSystemRole = (typeof SYSTEM_ROLES)[number]
export type ManagedFeaturePermission = (typeof FEATURE_PERMISSIONS)[number]

const STREAMER_OWNER_ROLE = 'OWNER'

export type UserRoleContext = {
  roles: ManagedSystemRole[]
  permissions: ManagedFeaturePermission[]
  streamerId: string | null
}

export function parseSystemRoles(raw: unknown): ManagedSystemRole[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const roles = new Set<ManagedSystemRole>(['USER'])
  for (const value of raw) {
    if (!SYSTEM_ROLES.includes(value as ManagedSystemRole)) {
      return null
    }
    roles.add(value as ManagedSystemRole)
  }
  return [...roles]
}

export function parseFeaturePermissions(raw: unknown): ManagedFeaturePermission[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const permissions = new Set<ManagedFeaturePermission>()
  for (const value of raw) {
    if (!FEATURE_PERMISSIONS.includes(value as ManagedFeaturePermission)) {
      return null
    }
    permissions.add(value as ManagedFeaturePermission)
  }
  return [...permissions]
}

export async function getUserRoles(userId: string): Promise<UserRoleContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user) {
    return null
  }
  const streamer = await resolveUserStreamerContext(userId)
  const roles: ManagedSystemRole[] = ['USER']
  const permissions: ManagedFeaturePermission[] = []
  if (user.role === 'admin') {
    roles.push('ADMIN')
  } else if (user.role === 'host') {
    permissions.push('EAT_FIRST_OPERATOR')
  }
  if (streamer) {
    roles.push('STREAMER')
  }
  return { roles, permissions, streamerId: streamer?.id ?? null }
}

export async function setUserRoles(input: {
  actorUserId: string | null
  userId: string
  roles: ManagedSystemRole[]
  permissions?: ManagedFeaturePermission[]
  streamerId?: string | null
}): Promise<
  | { ok: true; roles: ManagedSystemRole[]; permissions: ManagedFeaturePermission[]; streamerId: string | null }
  | {
      ok: false
      status: 400 | 403 | 404
      error:
        | 'invalid_role'
        | 'invalid_role_combination'
        | 'cannot_remove_self_admin'
        | 'cannot_remove_last_admin'
        | 'streamer_required'
        | 'streamer_not_found'
        | 'not_found'
    }
> {
  const wanted = new Set(input.roles)
  wanted.add('USER')
  const wantedPermissions = new Set(input.permissions ?? [])
  if (wanted.has('ADMIN') && wantedPermissions.has('EAT_FIRST_OPERATOR')) {
    return { ok: false, status: 400, error: 'invalid_role_combination' }
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, twitchId: true },
  })
  if (!user) {
    return { ok: false, status: 404, error: 'not_found' }
  }

  const removesAdmin = user.role === 'admin' && !wanted.has('ADMIN')
  if (removesAdmin && input.actorUserId === input.userId) {
    return { ok: false, status: 403, error: 'cannot_remove_self_admin' }
  }
  if (removesAdmin) {
    const otherAdminCount = await prisma.user.count({
      where: { role: 'admin', NOT: { id: input.userId } },
    })
    if (otherAdminCount === 0) {
      return { ok: false, status: 403, error: 'cannot_remove_last_admin' }
    }
  }

  const nextRole = wanted.has('ADMIN') ? 'admin' : wantedPermissions.has('EAT_FIRST_OPERATOR') ? 'host' : 'user'
  let targetStreamerId: string | null = null

  if (wanted.has('STREAMER')) {
    const currentStreamer = await resolveUserStreamerContext(input.userId)
    targetStreamerId = currentStreamer?.id ?? input.streamerId ?? null
    if (!targetStreamerId && user.twitchId) {
      const byTwitch = await prisma.streamer.findFirst({
        where: { twitchId: user.twitchId, isActive: true },
        select: { id: true },
      })
      targetStreamerId = byTwitch?.id ?? null
    }
    if (!targetStreamerId) {
      return { ok: false, status: 400, error: 'streamer_required' }
    }
    const streamer = await prisma.streamer.findFirst({
      where: { id: targetStreamerId, isActive: true },
      select: { id: true },
    })
    if (!streamer) {
      return { ok: false, status: 400, error: 'streamer_not_found' }
    }
    targetStreamerId = streamer.id
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { role: nextRole },
  })

  if (wanted.has('STREAMER') && targetStreamerId) {
    await prisma.streamer.update({
      where: { id: targetStreamerId },
      data: { ownerId: input.userId },
    })
    await prisma.user.update({
      where: { id: input.userId },
      data: { streamerId: targetStreamerId },
    })
    await prisma.streamerMember.upsert({
      where: {
        userId_streamerId: {
          userId: input.userId,
          streamerId: targetStreamerId,
        },
      },
      create: {
        userId: input.userId,
        streamerId: targetStreamerId,
        role: STREAMER_OWNER_ROLE,
      },
      update: {
        role: STREAMER_OWNER_ROLE,
      },
    })
  } else {
    await prisma.streamerMember.deleteMany({
      where: { userId: input.userId, role: STREAMER_OWNER_ROLE },
    })
    await prisma.streamer.updateMany({
      where: { ownerId: input.userId },
      data: { ownerId: null },
    })
    await prisma.user.update({
      where: { id: input.userId },
      data: { streamerId: null },
    })
  }

  const next = await getUserRoles(input.userId)
  return {
    ok: true,
    roles: next?.roles ?? ['USER'],
    permissions: next?.permissions ?? [],
    streamerId: next?.streamerId ?? null,
  }
}
