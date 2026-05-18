import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import {
  getTransactions,
  getWalletMe,
  postClaimAll,
  postClaimById,
  postClaimDaily,
  type EconomyApiError,
  type TransactionRow,
  type WalletSnapshotDto,
} from '../api/economyApi'

/**
 * Pinia store for the Viewer Economy viewer surface. The server is the
 * source of truth — every action re-syncs with a server snapshot. The
 * only "optimistic" UI state here is the per-action in-flight flag.
 *
 * Existing CoinHub store (`stores/coinHub.ts`) is unchanged; this store
 * layers on top with XP/level/pending breakdown and the new claim flows.
 */
export const useEconomyStore = defineStore('economy', () => {
  const wallet = shallowRef<WalletSnapshotDto | null>(null)
  const walletLoading = ref(false)
  const walletError = ref<EconomyApiError | null>(null)
  const walletInflight = shallowRef<Promise<void> | null>(null)

  const claimAllInflight = ref(false)
  const claimDailyInflight = ref(false)
  const claimByIdInflight = ref<string | null>(null)
  const lastActionError = ref<EconomyApiError | null>(null)
  const lastClaimedAmount = ref<{ coins: number; xp: number } | null>(null)

  const transactions = ref<TransactionRow[]>([])
  const transactionsCursor = ref<string | null>(null)
  const transactionsLoading = ref(false)
  const transactionsHasMore = ref(true)
  const transactionsError = ref<EconomyApiError | null>(null)
  const transactionsKind = ref<'all' | 'coin' | 'xp'>('all')

  function applyError(slot: 'wallet' | 'action' | 'transactions', err: unknown): void {
    const e: EconomyApiError =
      err && typeof err === 'object' && 'status' in (err as Record<string, unknown>)
        ? (err as EconomyApiError)
        : { status: 0, code: 'NETWORK', message: (err as Error)?.message ?? 'Network error' }
    if (slot === 'wallet') walletError.value = e
    else if (slot === 'action') lastActionError.value = e
    else transactionsError.value = e
  }

  async function loadWallet(opts?: { silent?: boolean }): Promise<void> {
    if (walletInflight.value) return walletInflight.value
    const silent = opts?.silent === true
    if (!silent) walletLoading.value = true
    walletError.value = null
    const p = (async () => {
      try {
        const snap = await getWalletMe()
        wallet.value = snap
      } catch (err) {
        applyError('wallet', err)
      } finally {
        walletLoading.value = false
        walletInflight.value = null
      }
    })()
    walletInflight.value = p
    return p
  }

  async function claimAll(): Promise<boolean> {
    if (claimAllInflight.value) return false
    claimAllInflight.value = true
    lastActionError.value = null
    lastClaimedAmount.value = null
    try {
      const r = await postClaimAll()
      wallet.value = r.wallet
      if (r.summary.claimId) {
        lastClaimedAmount.value = { coins: r.summary.coinTotal, xp: r.summary.xpTotal }
      }
      return r.summary.claimId !== null
    } catch (err) {
      applyError('action', err)
      return false
    } finally {
      claimAllInflight.value = false
    }
  }

  async function claimById(pendingRewardId: string): Promise<boolean> {
    if (claimByIdInflight.value) return false
    claimByIdInflight.value = pendingRewardId
    lastActionError.value = null
    lastClaimedAmount.value = null
    try {
      const r = await postClaimById(pendingRewardId)
      wallet.value = r.wallet
      if (r.summary.claimId) {
        lastClaimedAmount.value = { coins: r.summary.coinTotal, xp: r.summary.xpTotal }
      }
      return r.summary.claimId !== null
    } catch (err) {
      applyError('action', err)
      return false
    } finally {
      claimByIdInflight.value = null
    }
  }

  async function claimDaily(): Promise<{ granted: boolean; alreadyClaimedToday: boolean }> {
    if (claimDailyInflight.value) return { granted: false, alreadyClaimedToday: false }
    claimDailyInflight.value = true
    lastActionError.value = null
    try {
      const r = await postClaimDaily()
      wallet.value = r.wallet
      const granted = r.daily.granted === true
      const alreadyClaimedToday =
        r.daily.granted === false && r.daily.reason === 'already_claimed_today'
      return { granted, alreadyClaimedToday }
    } catch (err) {
      applyError('action', err)
      return { granted: false, alreadyClaimedToday: false }
    } finally {
      claimDailyInflight.value = false
    }
  }

  async function loadTransactions(opts?: {
    reset?: boolean
    kind?: 'all' | 'coin' | 'xp'
  }): Promise<void> {
    if (transactionsLoading.value) return
    const kind = opts?.kind ?? transactionsKind.value
    const isReset = opts?.reset === true || kind !== transactionsKind.value
    transactionsKind.value = kind
    if (isReset) {
      transactions.value = []
      transactionsCursor.value = null
      transactionsHasMore.value = true
    }
    if (!transactionsHasMore.value && !isReset) return
    transactionsLoading.value = true
    transactionsError.value = null
    try {
      const r = await getTransactions({
        cursor: transactionsCursor.value,
        kind,
        limit: 25,
      })
      const seen = new Set(transactions.value.map((x) => `${x.kind}:${x.id}`))
      const fresh = r.rows.filter((row) => !seen.has(`${row.kind}:${row.id}`))
      transactions.value = isReset ? r.rows : [...transactions.value, ...fresh]
      transactionsCursor.value = r.nextCursor
      transactionsHasMore.value = r.nextCursor !== null
    } catch (err) {
      applyError('transactions', err)
    } finally {
      transactionsLoading.value = false
    }
  }

  function reset(): void {
    wallet.value = null
    walletLoading.value = false
    walletError.value = null
    walletInflight.value = null
    claimAllInflight.value = false
    claimDailyInflight.value = false
    claimByIdInflight.value = null
    lastActionError.value = null
    lastClaimedAmount.value = null
    transactions.value = []
    transactionsCursor.value = null
    transactionsLoading.value = false
    transactionsHasMore.value = true
    transactionsError.value = null
    transactionsKind.value = 'all'
  }

  return {
    wallet,
    walletLoading,
    walletError,
    claimAllInflight,
    claimDailyInflight,
    claimByIdInflight,
    lastActionError,
    lastClaimedAmount,
    transactions,
    transactionsCursor,
    transactionsLoading,
    transactionsHasMore,
    transactionsError,
    transactionsKind,
    loadWallet,
    claimAll,
    claimById,
    claimDaily,
    loadTransactions,
    reset,
  }
})
