/**
 * Runs `npx prisma generate` with retries after removing a stale `.prisma` folder.
 * Helps on Windows when EPERM blocks renaming `query_engine-windows.dll.node`.
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { setTimeout: sleep } = require('timers/promises')

const serverRoot = path.join(__dirname, '..')
const prismaClientDir = path.join(serverRoot, 'node_modules', '.prisma')

async function run() {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = spawnSync('npx', ['prisma', 'generate'], {
      cwd: serverRoot,
      stdio: 'inherit',
      shell: true,
    })
    if (r.status === 0) {
      process.exit(0)
    }
    try {
      fs.rmSync(prismaClientDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    if (attempt < maxAttempts) {
      console.warn(`[prisma-generate-retry] attempt ${attempt} failed, retrying after short delay…`)
      await sleep(2000)
    }
  }
  process.exit(1)
}

void run()
