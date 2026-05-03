/**
 * Minimal monobank Personal API wrapper.
 *
 * Spec: https://api.monobank.ua/docs/ (Monobank "Personal API" docs)
 *
 * One endpoint used by the MVP Jar matcher:
 *   GET  /personal/statement/{account}/{from}/{to}
 *
 * Important constraints (from monobank docs):
 *   - Authentication via `X-Token` (personal token from id.bank.gov.ua).
 *   - Statement window is bounded to ~31 days; the server passes a small window.
 *   - Rate limit: at most one request per 60 seconds per account.
 *
 * Server-only — `MONO_PERSONAL_TOKEN` MUST NEVER be sent to the frontend or
 * embedded in client bundles. Routers must read from this module, not from
 * `process.env` directly, so the token surface stays narrow.
 */

const DEFAULT_API_URL = 'https://api.monobank.ua'

/**
 * Per-account 60-second cool-down enforced *in process* so repeated "I paid"
 * clicks or webhook bursts don't exceed monobank's rate limit. This is a soft
 * guard; if the API still returns 429 we simply skip matching this round and
 * leave the request in `checking`.
 */
const STATEMENT_RATE_LIMIT_MS = 60_000
const lastFetchAtByAccount = new Map<string, number>()

function monoApiUrl(): string {
  const raw = process.env.MONO_PERSONAL_API_URL ?? process.env.MONO_API_URL
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : DEFAULT_API_URL
}

export type MonoPersonalConfig = {
  token: string
  accountId: string
}

/**
 * Returns the Personal API config when both env vars are present, or `null`
 * (NOT a throw). Routers/services use this to gracefully degrade to manual
 * review mode when the token/account aren't configured.
 */
export function readPersonalConfig(): MonoPersonalConfig | null {
  const token = (process.env.MONO_PERSONAL_TOKEN ?? '').trim()
  const accountId = (process.env.MONO_ACCOUNT_ID ?? '').trim()
  if (token.length === 0 || accountId.length === 0) {
    return null
  }
  return { token, accountId }
}


export type RawMonoStatementItem = {
  id: string
  time: number
  description: string | null
  
  amount: number
  operationAmount: number
  
  currencyCode: number
  commissionRate: number
  cashbackAmount: number
  balance: number
  hold: boolean
  receiptId?: string
  comment?: string
}


export type NormalizedStatementItem = {
  monoTransactionId: string
  
  amount: number
  
  direction: 'incoming' | 'outgoing'
  
  currency: string
  description: string | null
  operationTime: Date
  
  raw: Record<string, unknown>
}

function ccyToAlpha(code: number): string {
  // We deliberately do not over-engineer this — the matcher only auto-matches
  
  if (code === 980) return 'UAH'
  return `ISO-${code}`
}

function normalizeItem(raw: RawMonoStatementItem): NormalizedStatementItem | null {
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount)) return null
  if (typeof raw.time !== 'number' || !Number.isFinite(raw.time)) return null
  const direction: 'incoming' | 'outgoing' = raw.amount >= 0 ? 'incoming' : 'outgoing'
  return {
    monoTransactionId: raw.id,
    amount: Math.abs(Math.trunc(raw.amount)),
    direction,
    currency: ccyToAlpha(raw.currencyCode),
    description:
      typeof raw.description === 'string' && raw.description.length > 0 ? raw.description : null,
    operationTime: new Date(raw.time * 1000),
    raw: raw as unknown as Record<string, unknown>,
  }
}

export type FetchStatementOk = {
  ok: true
  items: NormalizedStatementItem[]
}

export type FetchStatementSkipped = {
  ok: false
  
  reason: 'not_configured' | 'rate_limited' | 'error'
  message?: string
}

export type FetchStatementResult = FetchStatementOk | FetchStatementSkipped

/**
 * Fetches a small recent window of statement items. Returns a structured result
 * — never throws on missing env or transient network failure. Callers (matcher,
 * `mark-paid` polling) treat both `skipped` outcomes the same way: leave the
 * payment request in its current eligible state, optionally retry on next event.
 *
 * `force: true` bypasses the in-process 60 s cool-down. Reserved for the
 * admin-only "poll-mono now" endpoint so an operator can manually re-trigger
 * a fetch+match after fixing config; the cool-down timestamp is still updated
 * so subsequent automatic calls keep their normal pacing.
 */
export async function fetchRecentStatement(opts?: {
  windowSeconds?: number
  
  now?: () => number
  
  force?: boolean
}): Promise<FetchStatementResult> {
  const cfg = readPersonalConfig()
  if (!cfg) {
    return { ok: false, reason: 'not_configured' }
  }
  const nowMs = (opts?.now ?? Date.now)()
  const lastAt = lastFetchAtByAccount.get(cfg.accountId) ?? 0
  if (!opts?.force && nowMs - lastAt < STATEMENT_RATE_LIMIT_MS) {
    return { ok: false, reason: 'rate_limited' }
  }
  lastFetchAtByAccount.set(cfg.accountId, nowMs)

  
  
  
  const windowSeconds = Math.max(60, Math.min(31 * 24 * 60 * 60, opts?.windowSeconds ?? 30 * 60))
  const fromUnix = Math.floor(nowMs / 1000) - windowSeconds
  const toUnix = Math.floor(nowMs / 1000)

  const url = `${monoApiUrl()}/personal/statement/${encodeURIComponent(cfg.accountId)}/${fromUnix}/${toUnix}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Token': cfg.token,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return { ok: false, reason: 'error', message: (err as Error).message }
  }

  if (res.status === 429) {
    
    return { ok: false, reason: 'rate_limited' }
  }

  const text = await res.text()
  if (!res.ok) {
    return { ok: false, reason: 'error', message: `mono /statement ${res.status}: ${text.slice(0, 256)}` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, reason: 'error', message: 'mono /statement: non-JSON body' }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: 'error', message: 'mono /statement: expected array' }
  }
  const items: NormalizedStatementItem[] = []
  for (const entry of parsed) {
    const norm = normalizeItem(entry as RawMonoStatementItem)
    if (norm) items.push(norm)
  }
  return { ok: true, items }
}

/**
 * Normalizes a single StatementItem (as delivered via webhook body
 * `data.statementItem` + outer `data.account`). Webhook is treated as a
 * notification trigger — the matcher re-runs against the persisted row so
 * activation logic never depends on attacker-controllable fields.
 */
export function normalizeWebhookStatementItem(rawBody: unknown): {
  accountId: string | null
  item: NormalizedStatementItem | null
} {
  if (!rawBody || typeof rawBody !== 'object') return { accountId: null, item: null }
  const body = rawBody as Record<string, unknown>
  const data = (body.data as Record<string, unknown> | undefined) ?? null
  if (!data) return { accountId: null, item: null }
  const accountIdRaw = data.account
  const accountId =
    typeof accountIdRaw === 'string' && accountIdRaw.length > 0 ? accountIdRaw : null
  const stmt = data.statementItem as RawMonoStatementItem | undefined
  if (!stmt || typeof stmt !== 'object') return { accountId, item: null }
  return { accountId, item: normalizeItem(stmt) }
}

export const __testing = {
  resetRateLimit(): void {
    lastFetchAtByAccount.clear()
  },
}
