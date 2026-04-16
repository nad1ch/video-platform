/**
 * Minimal local seed: one Prisma `User` row used with ADMIN_EMAILS (Google OAuth same email).
 * Run: `npm run db:seed` from `apps/server` (after migrations; DATABASE_URL must be set).
 */
const fs = require('fs')
const path = require('path')

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq <= 0) {
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const serverRoot = path.join(__dirname, '..')
applyEnvFile(path.join(serverRoot, '.env'))
applyEnvFile(path.join(serverRoot, '.env.local'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: {
      provider_providerUserId: { provider: 'google', providerUserId: 'local-seed-admin' },
    },
    create: {
      provider: 'google',
      providerUserId: 'local-seed-admin',
      email: 'admin@local.streamassist',
      displayName: 'Local Admin (seed)',
      role: 'admin',
      stats: { create: {} },
    },
    update: {
      displayName: 'Local Admin (seed)',
      role: 'admin',
      email: 'admin@local.streamassist',
    },
  })
  console.log(
    '[seed] Upserted Prisma user admin@local.streamassist. Admin APIs use ADMIN_EMAILS allowlist + matching OAuth session.',
  )
}

main()
  .catch((e) => {
    const msg = String(e?.message ?? e)
    const code = e && typeof e === 'object' && 'code' in e ? String((e).code) : ''
    if (code === 'P1001' || msg.includes("Can't reach database server") || msg.includes('P1001')) {
      console.error(
        '[seed] Database is not reachable. Start Postgres on DATABASE_URL (e.g. `docker compose -f docker/docker-compose.local.yml up -d db`), then run migrations and seed again.',
      )
      process.exit(1)
    }
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
