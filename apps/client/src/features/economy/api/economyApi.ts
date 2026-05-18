import { apiFetch } from '@/utils/apiFetch'

/**
 * Thin client over the Viewer Economy backend (`/api/economy/*`,
 * `/api/streamers/:id/economy/*`, `/api/admin/economy/*`). Types mirror the
 * server response shapes — DO NOT recompute amounts here.
 *
 * Every mutating call uses POST/PATCH so it goes through the global
 * CSRF + Origin guard. `apiFetch` already injects credentials +
 * `X-Requested-With`.
 */

export type EconomyApiError = {
  status: number
  code: string
  message: string
}

async function parseError(res: Response): Promise<EconomyApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    return {
      status: res.status,
      code: body?.error?.code ?? 'HTTP',
      message: body?.error?.message ?? res.statusText ?? 'Request failed',
    }
  } catch {
    return { status: res.status, code: 'HTTP', message: res.statusText || 'Request failed' }
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw await parseError(res)
  }
  return (await res.json()) as T
}

function postJson(path: string, body: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

function patchJson(path: string, body: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

// ──────────────────────────────────────────────────────────────────────────
// Wallet snapshot
// ──────────────────────────────────────────────────────────────────────────

export type PendingRewardDto = {
  id: string
  kind: string
  coinAmount: number
  xpAmount: number
  streamerId: string | null
  sourceRef: string | null
  expiresAt: string
  createdAt: string
}

export type WalletSnapshotDto = {
  coinBalance: number
  xpBalance: number
  level: number
  currentLevelXp: number
  nextLevelXp: number
  progressToNextLevel: number
  pendingCoins: number
  pendingXp: number
  pending: PendingRewardDto[]
  boosts: {
    plan: 'basic' | 'pro' | null
    coinsMultiplier: number
    xpMultiplier: number
  }
}

export function getWalletMe(): Promise<WalletSnapshotDto> {
  return apiFetch('/api/economy/wallet/me').then(parseJson<WalletSnapshotDto>)
}

// ──────────────────────────────────────────────────────────────────────────
// Claims
// ──────────────────────────────────────────────────────────────────────────

export type ClaimSummary = {
  coinTotal: number
  xpTotal: number
  consumedPendingIds: string[]
  claimId: string | null
}

export type ClaimResponse = {
  summary: ClaimSummary
  wallet: WalletSnapshotDto
}

export function postClaimAll(): Promise<ClaimResponse> {
  return postJson('/api/economy/claims/all', {}).then(parseJson<ClaimResponse>)
}

export function postClaimById(pendingRewardId: string): Promise<ClaimResponse> {
  return postJson('/api/economy/claims/by-id', { pendingRewardId }).then(parseJson<ClaimResponse>)
}

export type DailyClaimResult =
  | { granted: true; pendingRewardId: string; coinAmount: number; xpAmount: number }
  | { granted: false; reason: 'already_claimed_today'; pendingRewardId: string }

export type DailyClaimResponse = {
  daily: DailyClaimResult
  wallet: WalletSnapshotDto
}

export function postClaimDaily(): Promise<DailyClaimResponse> {
  return postJson('/api/economy/claims/daily', {}).then(parseJson<DailyClaimResponse>)
}

// ──────────────────────────────────────────────────────────────────────────
// Transactions
// ──────────────────────────────────────────────────────────────────────────

export type TransactionRow = {
  kind: 'coin' | 'xp'
  id: string
  delta: number
  balanceBefore: number
  balanceAfter: number
  source: string
  sourceRef: string | null
  createdAt: string
}

export type TransactionsResponse = {
  rows: TransactionRow[]
  nextCursor: string | null
}

export function getTransactions(params: {
  cursor?: string | null
  limit?: number
  kind?: 'coin' | 'xp' | 'all'
}): Promise<TransactionsResponse> {
  const qs = new URLSearchParams()
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.kind && params.kind !== 'all') qs.set('kind', params.kind)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch(`/api/economy/transactions${suffix}`).then(parseJson<TransactionsResponse>)
}

// ──────────────────────────────────────────────────────────────────────────
// Cases catalog + open
// ──────────────────────────────────────────────────────────────────────────

export type CatalogReward = {
  id: string
  weight: number
  kind: 'coins' | 'xp' | 'badge' | 'cosmetic' | 'fragment'
  value: number
  referenceId: string | null
  minPityCount: number
  oddsApprox: number
}

export type CatalogCase = {
  slug: string
  displayName: string
  rarityTier: string
  isActive: boolean
  guaranteedMinCoins: number
  pityFloorCount: number
  streamerId: string | null
  rewards: CatalogReward[]
}

export type CasesCatalogResponse = { cases: CatalogCase[] }

export function getCasesCatalog(opts?: { streamerId?: string | null }): Promise<CasesCatalogResponse> {
  const qs = opts?.streamerId ? `?streamerId=${encodeURIComponent(opts.streamerId)}` : ''
  return apiFetch(`/api/economy/cases/catalog${qs}`).then(parseJson<CasesCatalogResponse>)
}

export type OpenCaseResult = {
  caseSlug: string
  reward: {
    rewardId: string
    kind: CatalogReward['kind']
    value: number
    referenceId: string | null
  }
  pityCountBefore: number
  pityCountAfter: number
  pityTriggered: boolean
  coinTransactionId: string | null
  xpTransactionId: string | null
  inventoryRemaining: number
  openingId: string
}

export type OpenCaseResponse = { result: OpenCaseResult; wallet: WalletSnapshotDto }

export function postCaseOpen(slug: string): Promise<OpenCaseResponse> {
  return postJson(`/api/economy/cases/${encodeURIComponent(slug)}/open`, {}).then(
    parseJson<OpenCaseResponse>,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Predictions
// ──────────────────────────────────────────────────────────────────────────

export type PredictionOptionDto = {
  id: string
  label: string
  totalStakes: number
  position: number
}

export type PredictionDto = {
  id: string
  title: string
  status: 'open' | 'locked' | 'resolved' | 'cancelled'
  lockAt: string
  minStake: number
  maxStake: number
  totalPool: number
  totalPaidOut: number
  winningOptionId: string | null
  options: PredictionOptionDto[]
}

export function listPredictions(streamerId: string, status?: string): Promise<{ predictions: PredictionDto[] }> {
  const qs = new URLSearchParams({ streamerId })
  if (status) qs.set('status', status)
  return apiFetch(`/api/economy/predictions?${qs.toString()}`).then(
    parseJson<{ predictions: PredictionDto[] }>,
  )
}

export type CreatePredictionPayload = {
  streamerId: string
  title: string
  options: string[]
  durationMs: number
  minStake?: number
  maxStake?: number
}

export function createPrediction(payload: CreatePredictionPayload): Promise<{ predictionId: string }> {
  return postJson('/api/economy/predictions', payload).then(parseJson<{ predictionId: string }>)
}

export function joinPrediction(
  predictionId: string,
  optionId: string,
  stake: number,
): Promise<{ entryId: string; stake: number; coinBalanceAfter: number }> {
  return postJson(`/api/economy/predictions/${encodeURIComponent(predictionId)}/join`, {
    optionId,
    stake,
  }).then(parseJson<{ entryId: string; stake: number; coinBalanceAfter: number }>)
}

export function lockPrediction(predictionId: string): Promise<{ status: string }> {
  return postJson(`/api/economy/predictions/${encodeURIComponent(predictionId)}/lock`, {}).then(
    parseJson<{ status: string }>,
  )
}

export function resolvePrediction(
  predictionId: string,
  winningOptionId: string,
): Promise<{ status: string; totalPool: number; totalPaidOut: number; winners: number }> {
  return postJson(`/api/economy/predictions/${encodeURIComponent(predictionId)}/resolve`, {
    winningOptionId,
  }).then(parseJson<{ status: string; totalPool: number; totalPaidOut: number; winners: number }>)
}

export function cancelPrediction(predictionId: string): Promise<{ status: string; refunded: number }> {
  return postJson(`/api/economy/predictions/${encodeURIComponent(predictionId)}/cancel`, {}).then(
    parseJson<{ status: string; refunded: number }>,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Streamer economy settings + summary
// ──────────────────────────────────────────────────────────────────────────

export type StreamerEconomySettingsDto = {
  streamerId: string
  chatRewardsEnabled: boolean
  predictionsEnabled: boolean
  caseDropsEnabled: boolean
  maxCoinsPerViewerPerStream: number
  maxPredictionStake: number
  maxActivePredictions: number
}

export function getStreamerSettings(streamerId: string): Promise<{ settings: StreamerEconomySettingsDto }> {
  return apiFetch(`/api/streamers/${encodeURIComponent(streamerId)}/economy/settings`).then(
    parseJson<{ settings: StreamerEconomySettingsDto }>,
  )
}

export function patchStreamerSettings(
  streamerId: string,
  patch: Partial<Omit<StreamerEconomySettingsDto, 'streamerId'>>,
): Promise<{ settings: StreamerEconomySettingsDto }> {
  return patchJson(`/api/streamers/${encodeURIComponent(streamerId)}/economy/settings`, patch).then(
    parseJson<{ settings: StreamerEconomySettingsDto }>,
  )
}

export type StreamerEconomySummaryDto = {
  streamerId: string
  topEarners: Array<{ userId: string; displayName: string; coins: number }>
  recentPredictions: Array<{
    id: string
    title: string
    status: string
    totalPool: number
    totalPaidOut: number
    createdAt: string
  }>
  chatRewardCoinsLast30d: number
  participationCoinsLast30d: number
}

export function getStreamerSummary(streamerId: string): Promise<{ summary: StreamerEconomySummaryDto }> {
  return apiFetch(`/api/streamers/${encodeURIComponent(streamerId)}/economy/summary`).then(
    parseJson<{ summary: StreamerEconomySummaryDto }>,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Admin economy
// ──────────────────────────────────────────────────────────────────────────

export type AdminMutationPayload = {
  coinAmount?: number
  xpAmount?: number
  reason?: string | null
  idempotencyKey?: string | null
}

export type AdminMutationResult = {
  userId: string
  coinDelta: number
  xpDelta: number
  coinBalanceAfter: number
  xpBalanceAfter: number
  coinTransactionId: string | null
  xpTransactionId: string | null
  idempotentReplay: boolean
}

export function adminGrant(userId: string, payload: AdminMutationPayload): Promise<AdminMutationResult> {
  return postJson(`/api/admin/economy/users/${encodeURIComponent(userId)}/grant`, payload).then(
    parseJson<AdminMutationResult>,
  )
}

export function adminRevoke(userId: string, payload: AdminMutationPayload): Promise<AdminMutationResult> {
  return postJson(`/api/admin/economy/users/${encodeURIComponent(userId)}/revoke`, payload).then(
    parseJson<AdminMutationResult>,
  )
}

export type AdminHistoryRow = TransactionRow

export function adminUserHistory(
  userId: string,
  params: { cursor?: string | null; limit?: number },
): Promise<{ rows: AdminHistoryRow[]; nextCursor: string | null }> {
  const qs = new URLSearchParams()
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch(
    `/api/admin/economy/users/${encodeURIComponent(userId)}/history${suffix}`,
  ).then(parseJson<{ rows: AdminHistoryRow[]; nextCursor: string | null }>)
}

export type AdminPredictionRow = {
  id: string
  streamerId: string
  title: string
  status: string
  totalPool: number
  totalPaidOut: number
  createdAt: string
}

export function adminPredictions(params: {
  status?: string
  cursor?: string | null
  limit?: number
}): Promise<{ rows: AdminPredictionRow[]; nextCursor: string | null }> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch(`/api/admin/economy/predictions${suffix}`).then(
    parseJson<{ rows: AdminPredictionRow[]; nextCursor: string | null }>,
  )
}
