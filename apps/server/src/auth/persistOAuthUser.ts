import { prisma } from '../prisma'
import { resolveUserRole } from './resolveUserRole'
import type { GoogleProfileForSession } from './googleOAuth'
import type { TwitchProfileForSession } from './twitchClient'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

/**
 * Upsert OAuth user in Postgres. Failures are logged only — JWT/session must still succeed without DB.
 * If `DATABASE_URL` is unset, skips persistence (local dev without Postgres).
 */
export async function persistTwitchOAuthUser(profile: TwitchProfileForSession): Promise<void> {
  if (!isDatabaseConfigured()) {
    return
  }
  try {
    const role = resolveUserRole({
      provider: 'twitch',
      id: profile.id,
      twitchId: profile.id,
    })
    await prisma.user.upsert({
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
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url || null,
        role,
        twitchId: profile.id,
        stats: { create: {} },
      },
      update: {
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url || null,
        role,
        twitchId: profile.id,
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
    const role = resolveUserRole({
      provider: 'google',
      id: profile.id,
      email: profile.email,
    })
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
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url?.trim() ? profile.profile_image_url : null,
        role,
        twitchId: null,
        stats: { create: {} },
      },
      update: {
        ...(email ? { email } : {}),
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url?.trim() ? profile.profile_image_url : null,
        role,
      },
    })
  } catch (e) {
    console.error('[auth][persist] Google upsert failed', e)
  }
}
