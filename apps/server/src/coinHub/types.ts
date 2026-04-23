/**
 * API reward payload (JSON stored in `Spin.lastReward` / `CoinCase.lastReward`).
 */
export type CoinRewardJson = {
  kind: 'coins'
  amount: number
}

export type CaseState = 'available' | 'locked' | 'cooldown'

export type ApiCoinCase = {
  id: string
  state: CaseState
  cooldownUntil: string | null
  displayReward: CoinRewardJson | null
}

export type ApiCoinHub = {
  balance: number
  pending: number
  spin: {
    available: boolean
    nextAvailableAt: string | null
    lastReward: CoinRewardJson | null
  }
  cases: ApiCoinCase[]
}

export type GetCoinHubResponse = { coinHub: ApiCoinHub }

export type OpenCaseResponse = { coinHub: ApiCoinHub; opened: { caseId: string; reward: CoinRewardJson } }
