/**
 * Runs `npx prisma generate` with retries after removing a stale `.prisma` folder.
 * Helps on Windows when EPERM blocks renaming `query_engine-windows.dll.node`.
 *
 * Run from repo root: `npm run db:generate:server`
 * Or from apps/server: `node scripts/prisma-generate-retry.cjs`
 */
const fs = require('fs')
const path = require('path')
const { spawnSync, execSync } = require('child_process')
const { setTimeout: sleep } = require('timers/promises')

const serverRoot = path.join(__dirname, '..')
const prismaClientDir = path.join(serverRoot, 'node_modules', '.prisma')
const prismaClientNested = path.join(prismaClientDir, 'client')
/** Hoisted workspace install may also place engines under repo root. */
const workspaceRoot = path.join(serverRoot, '..', '..')
const rootPrismaDir = path.join(workspaceRoot, 'node_modules', '.prisma')

function tryRemoveTmpEngines() {
  if (!fs.existsSync(prismaClientNested)) {
    return
  }
  for (const name of fs.readdirSync(prismaClientNested)) {
    if (/^query_engine.*\.tmp\d*$/i.test(name) || name.endsWith('.tmp')) {
      try {
        fs.unlinkSync(path.join(prismaClientNested, name))
      } catch {
        /* ignore */
      }
    }
  }
}

/** Drop read-only so `rd` / Prisma rename are less likely to hit EPERM. */
function clearReadOnlyWin(dir) {
  if (process.platform !== 'win32' || !fs.existsSync(dir)) {
    return
  }
  try {
    execSync(`cmd.exe /c attrib -r "${dir}\\*.*" /s /d`, { stdio: 'ignore', windowsHide: true })
  } catch {
    /* ignore */
  }
}

/**
 * Windows: Node's fs.rmSync often loses to AV/IDE locks on `.dll.node`; `rd /s /q` sometimes wins after dev servers stop.
 */
function forceRemoveDir(dir) {
  if (!fs.existsSync(dir)) {
    return
  }
  if (process.platform === 'win32') {
    clearReadOnlyWin(dir)
    const quoted = `"${dir}"`
    try {
      execSync(`cmd.exe /c if exist ${quoted} rd /s /q ${quoted}`, {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      /* fall through */
    }
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

function scrubPrismaArtifacts() {
  tryRemoveTmpEngines()
  forceRemoveDir(prismaClientDir)
  if (fs.existsSync(rootPrismaDir)) {
    forceRemoveDir(rootPrismaDir)
  }
}

/** Avoid Git Bash–spawned shells; use cmd.exe + local prisma (matches double-click / CI). */
function runPrismaGenerate() {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/c', 'npm exec -- prisma generate'], {
      cwd: serverRoot,
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
    })
  }
  return spawnSync('npx', ['prisma', 'generate'], {
    cwd: serverRoot,
    stdio: 'inherit',
    shell: true,
  })
}

async function run() {
  const maxAttempts = 6
  console.log(
    '[prisma-generate-retry] Stop ALL Node dev servers first (Ctrl+C on dev:all). Cursor/Defender can lock query_engine — see .vscode/settings.json watcherExclude.\n',
  )
  if (process.platform === 'win32' && process.env.MSYSTEM) {
    console.warn(
      '[prisma-generate-retry] You are in Git Bash. If EPERM persists, run **from cmd.exe or PowerShell**: npm run db:generate:server\n',
    )
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const waitMs = Math.min(10_000, 2000 * attempt)
      console.warn(`[prisma-generate-retry] attempt ${attempt - 1} failed, cleaning and waiting ${waitMs}ms…`)
      await sleep(waitMs)
    }

    scrubPrismaArtifacts()
    await sleep(process.platform === 'win32' ? 2000 : 200)

    const r = runPrismaGenerate()
    if (r.status === 0) {
      process.exit(0)
    }
  }

  console.error(
    '\n[prisma-generate-retry] Still EPERM? Try in order:\n' +
      '  1) Open **cmd.exe** (not Git Bash), cd to repo root, run: npm run db:generate:server\n' +
      '  2) Task Manager → end every "Node.js" process (or close Cursor), retry\n' +
      '  3) Windows Security → exclusions → add your repo folder\n' +
      '  4) Docker (if installed): from repo root, Linux avoids Windows file rename quirks:\n' +
      '     docker run --rm -v "%CD%:/w" -w /w/apps/server node:20-bookworm-slim npm exec -- prisma generate\n',
  )
  process.exit(1)
}

void run()
