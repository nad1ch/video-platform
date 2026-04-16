import fs from 'node:fs'
import path from 'node:path'

function applyDotEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eq = trimmed.indexOf('=')
    if (eq <= 0) {
      continue
    }

    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1)

    if (!key) {
      continue
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

// Prefer apps/server/.env regardless of where the process is started from.
const repoRelative = path.resolve(process.cwd(), 'apps', 'server', '.env')
const hereRelative = path.resolve(__dirname, '..', '.env')
const cwdRelative = path.resolve(process.cwd(), '.env')

applyDotEnvFile(repoRelative)
applyDotEnvFile(hereRelative)
applyDotEnvFile(cwdRelative)

// Optional local overrides (host Prisma + `npm run dev`); same paths with `.env.local`.
const repoLocal = path.resolve(process.cwd(), 'apps', 'server', '.env.local')
const hereLocal = path.resolve(__dirname, '..', '.env.local')
const cwdLocal = path.resolve(process.cwd(), '.env.local')
applyDotEnvFile(repoLocal)
applyDotEnvFile(hereLocal)
applyDotEnvFile(cwdLocal)
