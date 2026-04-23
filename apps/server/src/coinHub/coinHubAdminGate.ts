import { resolveUserRole } from '../auth/resolveUserRole'
import { prisma } from '../prisma'

/**
 * Users who may bypass Coin Hub mutation limits: DB `User.role === 'admin'`, or the same
 * env allowlists as auth (`ADMIN_TWITCH_IDS` / `ADMIN_EMAILS` via `resolveUserRole`) when
 * the stored row is stale (`user` in DB but allowlist says admin).
 */
export async function isCoinHubApiAdminUser(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, provider: true, email: true, twitchId: true, providerUserId: true },
  })
  if (!u) {
    return false
  }
  if (u.role === 'admin') {
    return true
  }
  const pr = u.provider
  if (pr === 'twitch') {
    const tid = typeof u.twitchId === 'string' && u.twitchId.length > 0 ? u.twitchId : u.providerUserId
    return (
      resolveUserRole({
        provider: 'twitch',
        id: tid,
        twitchId: typeof u.twitchId === 'string' && u.twitchId.length > 0 ? u.twitchId : undefined,
      }) === 'admin'
    )
  }
  if (pr === 'google' || pr === 'apple' || pr === 'email') {
    return (
      resolveUserRole({
        provider: pr,
        id: u.providerUserId,
        email: u.email ?? undefined,
      }) === 'admin'
    )
  }
  return false
}

/**
 * Local / non-prod: `COINHUB_MUTATION_BYPASS=1|true` and `NODE_ENV !== 'production'`.
 * (`ts-node-dev` often leaves `NODE_ENV` unset — if we required `=== 'development'`, the
 * bypass would never run.) Production must set `NODE_ENV=production`; never enable there.
 */
export function isCoinHubDevMutationBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  const v = process.env.COINHUB_MUTATION_BYPASS
  return v === '1' || v === 'true'
}

export async function shouldBypassCoinHubMutations(
  userId: string,
): Promise<boolean> {
  if (isCoinHubDevMutationBypassEnabled()) {
    return true
  }
  return isCoinHubApiAdminUser(userId)
}
