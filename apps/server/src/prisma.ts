import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const isProd = process.env.NODE_ENV === 'production'

export function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}


export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    
    log: isProd ? ['error'] : ['error', 'warn'],
  })

if (!isProd) {
  globalForPrisma.prisma = prisma
}
