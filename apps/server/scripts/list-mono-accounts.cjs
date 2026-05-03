#!/usr/bin/env node
/**
 * Dev-only helper: list monobank accounts visible to MONO_PERSONAL_TOKEN.
 *
 * Use this once after creating a Personal API token at id.bank.gov.ua to find
 * the correct `MONO_ACCOUNT_ID` for your StreamAssist Pro Jar/Banka. Set it in
 * `apps/server/.env.local` (gitignored) — never commit the value.
 *
 * Run from repo root:
 *   MONO_PERSONAL_TOKEN=<token> node apps/server/scripts/list-mono-accounts.cjs
 *
 * Or if you already set MONO_PERSONAL_TOKEN in apps/server/.env.local:
 *   node apps/server/scripts/list-mono-accounts.cjs
 *
 * Safety guards:
 *   - Refuses to run when NODE_ENV=production.
 *   - Never prints the token (truncated mask only on `--debug`).
 *   - Backend-only: not exposed via HTTP.
 *   - Honours monobank's 60s rate limit (single GET per invocation).
 *
 * Output columns:
 *   accountId · type · currencyCode · balance(UAH) · maskedPan
 */

const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')

const DEFAULT_API_URL = 'https://api.monobank.ua'

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error(
    '[list-mono-accounts] Refusing to run with NODE_ENV=production.\n' +
      'This is a dev/admin-only helper. Run on a workstation, not in production.',
  )
  process.exit(2)
}

function applyDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1)
    if (!key) continue
    const existing = process.env[key]
    if (existing === undefined || existing === '') {
      process.env[key] = value
    }
  }
}


const serverRoot = path.resolve(__dirname, '..')
applyDotEnvFile(path.join(serverRoot, '.env'))
applyDotEnvFile(path.join(serverRoot, '.env.local'))
applyDotEnvFile(path.resolve(process.cwd(), '.env'))
applyDotEnvFile(path.resolve(process.cwd(), '.env.local'))

const token = (process.env.MONO_PERSONAL_TOKEN || '').trim()
if (!token) {
  console.error(
    '[list-mono-accounts] MONO_PERSONAL_TOKEN is not set. Either:\n' +
      '  1) Add it to apps/server/.env.local (preferred), or\n' +
      '  2) Pass it inline:  MONO_PERSONAL_TOKEN=<token> node apps/server/scripts/list-mono-accounts.cjs',
  )
  process.exit(1)
}

const apiUrl = (process.env.MONO_PERSONAL_API_URL || process.env.MONO_API_URL || DEFAULT_API_URL)
  .trim()
  .replace(/\/$/, '')

if (process.argv.includes('--debug')) {
  
  const masked = token.length > 4 ? `${token.slice(0, 2)}***${token.slice(-2)}` : '***'
  console.error(`[list-mono-accounts] Using token: ${masked} · api: ${apiUrl}`)
}

function getJson(urlString, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search || ''}`,
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (!res.statusCode || res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode || '?'} from ${u.pathname} :: ${body.slice(0, 256)}`,
              ),
            )
            return
          }
          try {
            resolve(JSON.parse(body))
          } catch (err) {
            reject(new Error(`Non-JSON body from ${u.pathname}: ${err.message}`))
          }
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(15_000, () => req.destroy(new Error('Request timeout (15s)')))
    req.end()
  })
}

function fmtBalance(kopecks) {
  if (typeof kopecks !== 'number' || !Number.isFinite(kopecks)) return '—'
  return (kopecks / 100).toFixed(2)
}

function ccyAlpha(code) {
  if (code === 980) return 'UAH'
  if (code === 840) return 'USD'
  if (code === 978) return 'EUR'
  return `ISO-${code}`
}

function main() {
  return getJson(`${apiUrl}/personal/client-info`, { 'X-Token': token })
    .then((info) => {
      const accounts = Array.isArray(info?.accounts) ? info.accounts : []
      if (accounts.length === 0) {
        console.warn('[list-mono-accounts] No accounts returned. Token may be wrong or revoked.')
        return
      }
      const rows = accounts.map((a) => ({
        id: typeof a.id === 'string' ? a.id : '?',
        type: typeof a.type === 'string' ? a.type : '?',
        ccy: ccyAlpha(typeof a.currencyCode === 'number' ? a.currencyCode : -1),
        balance: fmtBalance(a.balance),
        maskedPan: Array.isArray(a.maskedPan) && a.maskedPan.length > 0 ? a.maskedPan[0] : '—',
      }))
      console.log('\nMonobank accounts visible to this token:\n')
      const header = ['accountId', 'type', 'currency', 'balance', 'maskedPan']
      const widths = header.map((h, i) =>
        Math.max(
          h.length,
          ...rows.map((r) => String(Object.values(r)[i]).length),
        ),
      )
      const fmtRow = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')
      console.log(fmtRow(header))
      console.log(widths.map((w) => '─'.repeat(w)).join('  '))
      for (const r of rows) {
        console.log(fmtRow([r.id, r.type, r.ccy, r.balance, r.maskedPan]))
      }
      console.log(
        '\nSet MONO_ACCOUNT_ID in apps/server/.env.local to the id of the account/jar where billing payments LAND.',
      )
      console.log(
        'For Banka/Jar billing (StreamAssist Pro): use the JAR id from the list below — NOT a personal card id.',
      )
      console.log(
        'Each jar is a separate monobank account in the Personal API; deposits via send.monobank.ua land directly on the jar.\n',
      )
      
      if (Array.isArray(info?.jars) && info.jars.length > 0) {
        console.log(
          'Jars (use the jar id below as MONO_ACCOUNT_ID for jar-based billing):',
        )
        for (const j of info.jars) {
          const balance = fmtBalance(j.balance)
          const goal = fmtBalance(j.goal)
          const ccy = ccyAlpha(j.currencyCode)
          console.log(
            `  · ${j.id} · ${j.title || '(no title)'} · ${balance} ${ccy} / goal ${goal} ${ccy}`,
          )
        }
        console.log('')
      }
    })
    .catch((err) => {
      console.error(`[list-mono-accounts] Failed: ${err.message}`)
      console.error(
        '\nCheck:\n' +
          '  1) MONO_PERSONAL_TOKEN is correct and not revoked at id.bank.gov.ua\n' +
          '  2) Network can reach api.monobank.ua\n' +
          '  3) Mono rate limit is 1 request / 60s per token — wait and retry\n',
      )
      process.exit(1)
    })
}

void main()
