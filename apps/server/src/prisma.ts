import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const isProd = process.env.NODE_ENV === 'production'

/** Singleton Prisma client (avoid exhausting connections in dev hot-reload). */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Production: errors only. Dev: warn helps catch schema/client mismatches without query spam.
    log: isProd ? ['error'] : ['error', 'warn'],
  })

if (!isProd) {
  globalForPrisma.prisma = prisma
}
