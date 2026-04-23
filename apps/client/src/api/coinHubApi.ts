import { apiFetch } from '@/utils/apiFetch'

export type ApiCoinReward = {
  kind: 'coins'
  amount: number
}

export type ApiCoinCase = {
  id: string
  state: 'available' | 'locked' | 'cooldown'
  cooldownUntil: string | null
  displayReward: ApiCoinReward | null
}

export type ApiCoinHub = {
  balance: number
  pending: number
  spin: {
    available: boolean
    nextAvailableAt: string | null
    lastReward: ApiCoinReward | null
  }
  cases: ApiCoinCase[]
}

export type GetCoinHubResponse = { coinHub: ApiCoinHub }

export type OpenCaseResponse = {
  coinHub: ApiCoinHub
  opened: { caseId: string; reward: ApiCoinReward }
}

export class CoinHubApiError extends Error {
  override name = 'CoinHubApiError'
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function parseError(res: Response): Promise<CoinHubApiError> {
  try {
    const b = (await res.json()) as { error?: { code?: string; message?: string } }
    return new CoinHubApiError(
      res.status,
      b?.error?.code ?? 'HTTP',
      (b?.error?.message ?? res.statusText) || 'Request failed',
    )
  } catch {
    return new CoinHubApiError(res.status, 'HTTP', res.statusText || 'Request failed')
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw await parseError(res)
  }
  return (await res.json()) as T
}

export async function getCoinHub(): Promise<GetCoinHubResponse> {
  const r = await apiFetch('/api/coinhub')
  return parseJson<GetCoinHubResponse>(r)
}

export async function postCoinHubClaim(): Promise<GetCoinHubResponse> {
  const r = await apiFetch('/api/coinhub/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  return parseJson<GetCoinHubResponse>(r)
}

export async function postCoinHubSpin(): Promise<GetCoinHubResponse> {
  const r = await apiFetch('/api/coinhub/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  return parseJson<GetCoinHubResponse>(r)
}

export async function postCoinHubCaseOpen(caseId: string): Promise<OpenCaseResponse> {
  const r = await apiFetch('/api/coinhub/case/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId }),
  })
  return parseJson<OpenCaseResponse>(r)
}
