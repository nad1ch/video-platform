import { isDatabaseConfigured, prisma } from '../prisma'
import { normalizeTwitchLogin } from '../streamerIdentity'
import { resolveUserRole } from './resolveUserRole'
import type { GoogleProfileForSession } from './googleOAuth'
import type { TwitchProfileForSession, TwitchStreamStatus } from './twitchClient'

const STREAMER_OWNER_ROLE = 'OWNER'

export type PersistTwitchOAuthUserOptions = {
  streamStatus?: TwitchStreamStatus | null
}





export async function persistTwitchOAuthUser(
  profile: TwitchProfileForSession,
  options: PersistTwitchOAuthUserOptions = {},
): Promise<void> {
  if (!isDatabaseConfigured()) {
    return
  }
  try {
    const login = normalizeTwitchLogin(profile.login) ?? normalizeTwitchLogin(profile.display_name)
    if (!login) {
      throw new Error(`Invalid Twitch login for profile ${profile.id}`)
    }
    const displayName = profile.display_name.trim() || login
    const profileImageUrl = profile.profile_image_url?.trim() ? profile.profile_image_url : null
    const streamStatus = options.streamStatus ?? null
    const allowlistRole = resolveUserRole({
      provider: 'twitch',
      id: profile.id,
      twitchId: profile.id,
    })
    const existing = await prisma.user.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'twitch',
          providerUserId: profile.id,
        },
      },
      select: { role: true },
    })
    let storedRole: string = allowlistRole
    if (existing?.role === 'host' && allowlistRole === 'user') {
      storedRole = 'host'
    }
    const user = await prisma.user.upsert({
      where: {
        provider_providerUserId: {
          provider: 'twitch',
          providerUserId: profile.id,
        },
      },
      create: {
        provider: 'twitch',
        providerUserId: profile.id,
        email: null,
        displayName,
        avatarUrl: profileImageUrl,
        role: storedRole,
        twitchId: profile.id,
        stats: { create: {} },
      },
      update: {
        displayName,
        avatarUrl: profileImageUrl,
        role: storedRole,
        twitchId: profile.id,
      },
      select: { id: true },
    })
    const existingStreamerByTwitch = await prisma.streamer.findUnique({
      where: { twitchId: profile.id },
      select: { id: true },
    })
    const existingStreamer =
      existingStreamerByTwitch ??
      (await prisma.streamer.findFirst({
        where: { OR: [{ username: login }, { name: login }] },
        select: { id: true },
      }))
    const streamerData = {
      twitchId: profile.id,
      username: login,
      name: login,
      displayName,
      profileImageUrl,
      broadcasterType: profile.broadcaster_type || null,
      currentOnline: streamStatus?.currentOnline ?? null,
      isLive: streamStatus?.isLive ?? false,
      lastSyncAt: new Date(),
      ownerId: user.id,
      isActive: true,
    }
    const streamer = existingStreamer
      ? await prisma.streamer.update({
          where: { id: existingStreamer.id },
          data: streamerData,
          select: { id: true },
        })
      : await prisma.streamer.create({
          data: {
            ...streamerData,
            followersCount: null,
            avgOnline7d: null,
            tier: null,
          },
          select: { id: true },
        })
    await prisma.user.update({
      where: { id: user.id },
      data: { streamerId: streamer.id },
    })
    await prisma.streamerMember.upsert({
      where: {
        userId_streamerId: {
          userId: user.id,
          streamerId: streamer.id,
        },
      },
      create: {
        userId: user.id,
        streamerId: streamer.id,
        role: STREAMER_OWNER_ROLE,
      },
      update: {
        role: STREAMER_OWNER_ROLE,
      },
    })
  } catch (e) {
    console.error('[auth][persist] Twitch upsert failed', e)
  }
}

export async function persistGoogleOAuthUser(profile: GoogleProfileForSession): Promise<void> {
  if (!isDatabaseConfigured()) {
    return
  }
  try {
    const email = profile.email ?? null
    const allowlistRole = resolveUserRole({
      provider: 'google',
      id: profile.id,
      email: profile.email,
    })
    const existing = await prisma.user.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'google',
          providerUserId: profile.id,
        },
      },
      select: { role: true, emailVerified: true },
    })
    let storedRole: string = allowlistRole
    if (existing?.role === 'host' && allowlistRole === 'user') {
      storedRole = 'host'
    }
    const googleEmailVerified = profile.email_verified === true
    const markEmailVerified =
      googleEmailVerified && existing?.emailVerified !== true
        ? { emailVerified: true, emailVerifiedAt: new Date() }
        : {}
    await prisma.user.upsert({
      where: {
        provider_providerUserId: {
          provider: 'google',
          providerUserId: profile.id,
        },
      },
      create: {
        provider: 'google',
        providerUserId: profile.id,
        email,
        ...(googleEmailVerified ? { emailVerified: true, emailVerifiedAt: new Date() } : {}),
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url?.trim() ? profile.profile_image_url : null,
        role: storedRole,
        twitchId: null,
        stats: { create: {} },
      },
      update: {
        ...(email ? { email } : {}),
        ...markEmailVerified,
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url?.trim() ? profile.profile_image_url : null,
        role: storedRole,
      },
    })
  } catch (e) {
    console.error('[auth][persist] Google upsert failed', e)
  }
}
