import type { Prisma } from '@prisma/client'

/**
 * Idempotent badge grant — re-granting `(userId, badgeSlug)` is a no-op via
 * the composite primary key. Must run inside an existing Prisma transaction
 * so the grant lands atomically with the trigger (case opening / event
 * reward / admin grant).
 */
export async function grantBadge(
  tx: Prisma.TransactionClient,
  userId: string,
  badgeSlug: string,
): Promise<{ acquired: boolean }> {
  const existing = await tx.userBadge.findUnique({
    where: { userId_badgeSlug: { userId, badgeSlug } },
    select: { userId: true },
  })
  if (existing) return { acquired: false }
  // Validate the catalog row exists + is active before granting.
  const badge = await tx.badge.findUnique({
    where: { slug: badgeSlug },
    select: { isActive: true },
  })
  if (!badge || !badge.isActive) return { acquired: false }
  await tx.userBadge.create({ data: { userId, badgeSlug } })
  return { acquired: true }
}

export async function grantCosmetic(
  tx: Prisma.TransactionClient,
  userId: string,
  cosmeticSlug: string,
): Promise<{ acquired: boolean }> {
  const existing = await tx.userCosmetic.findUnique({
    where: { userId_cosmeticSlug: { userId, cosmeticSlug } },
    select: { userId: true },
  })
  if (existing) return { acquired: false }
  const cosmetic = await tx.cosmetic.findUnique({
    where: { slug: cosmeticSlug },
    select: { isActive: true },
  })
  if (!cosmetic || !cosmetic.isActive) return { acquired: false }
  await tx.userCosmetic.create({ data: { userId, cosmeticSlug } })
  return { acquired: true }
}

/**
 * Equip a cosmetic the user already owns. `kind` is derived from the
 * cosmetic catalog row so the caller cannot equip a chat_color into the
 * frame slot. Returns `false` if the user does not own the cosmetic or it
 * is inactive.
 */
export async function equipCosmetic(
  tx: Prisma.TransactionClient,
  userId: string,
  cosmeticSlug: string,
): Promise<{ equipped: boolean }> {
  const cosmetic = await tx.cosmetic.findUnique({
    where: { slug: cosmeticSlug },
    select: { kind: true, isActive: true },
  })
  if (!cosmetic || !cosmetic.isActive) return { equipped: false }
  const owned = await tx.userCosmetic.findUnique({
    where: { userId_cosmeticSlug: { userId, cosmeticSlug } },
    select: { userId: true },
  })
  if (!owned) return { equipped: false }
  await tx.equippedCosmetic.upsert({
    where: { userId_kind: { userId, kind: cosmetic.kind } },
    create: { userId, kind: cosmetic.kind, cosmeticSlug },
    update: { cosmeticSlug },
  })
  return { equipped: true }
}
