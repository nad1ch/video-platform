import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import {
  getCoinHub,
  postCoinHubCaseOpen,
  postCoinHubClaim,
  postCoinHubSpin,
  type ApiCoinHub,
} from '@/api/coinHubApi'
import type { CoinHubCaseState } from '@/types/coinHub'
import type { CoinHubErrorKind } from '@/utils/coinHub/coinHubErrorKind'
import { classifyCoinHubError } from '@/utils/coinHub/coinHubErrorKind'

const LUCK_CASE_IDS: readonly string[] = ['luck-0', 'luck-1', 'luck-2', 'luck-3']

export type CoinHubLastAction = 'load' | 'claim' | 'spin' | 'open'

function asCaseState(s: string): CoinHubCaseState {
  if (s === 'available' || s === 'locked' || s === 'cooldown') return s
  return 'available'
}

function mapRewardToLine(r: { kind: string; amount: number } | null | undefined): string | null {
  if (r == null) return null
  if (r.kind === 'coins' && Number.isFinite(r.amount)) {
    return `+${r.amount}`
  }
  return null
}

function applyCoinHubToRefs(raw: ApiCoinHub, refs: {
  balance: { value: number }
  pending: { value: number }
  dailySpinAvailable: { value: boolean }
  freeCaseState: { value: CoinHubCaseState }
  subscriberCaseState: { value: CoinHubCaseState }
  caseStates: { value: CoinHubCaseState[] }
  caseRewards: { value: (string | null)[] }
  caseGridCooldownUntilIso: { value: (string | null)[] }
  freeCaseCooldownUntilIso: { value: string | null }
  subscriberCaseCooldownUntilIso: { value: string | null }
  spinPayout: { value: number }
  spinNextAvailableAtIso: { value: string | null }
}): void {
  refs.balance.value = raw.balance
  refs.pending.value = raw.pending
  refs.dailySpinAvailable.value = raw.spin.available
  refs.spinNextAvailableAtIso.value = raw.spin.nextAvailableAt
  const lr = raw.spin.lastReward
  if (lr && lr.kind === 'coins' && Number.isFinite(lr.amount)) {
    refs.spinPayout.value = lr.amount
  } else {
    refs.spinPayout.value = 0
  }
  const byId = new Map(raw.cases.map((c) => [c.id, c]))
  refs.caseStates.value = LUCK_CASE_IDS.map((id) => asCaseState(byId.get(id)?.state ?? 'available'))
  refs.caseRewards.value = LUCK_CASE_IDS.map((id) => mapRewardToLine(byId.get(id)?.displayReward ?? null))
  refs.caseGridCooldownUntilIso.value = LUCK_CASE_IDS.map((id) => {
    const c = byId.get(id)
    if (c?.state === 'cooldown' && c.cooldownUntil) return c.cooldownUntil
    return null
  })
  const free = byId.get('free')
  refs.freeCaseState.value = asCaseState(free?.state ?? 'available')
  refs.freeCaseCooldownUntilIso.value =
    free?.state === 'cooldown' && free.cooldownUntil ? free.cooldownUntil : null
  const sub = byId.get('subscriber')
  refs.subscriberCaseState.value = asCaseState(sub?.state ?? 'locked')
  refs.subscriberCaseCooldownUntilIso.value =
    sub?.state === 'cooldown' && sub.cooldownUntil ? sub.cooldownUntil : null
}

/**
 * Coin Hub: mirrors GET `/api/coinhub` and POST mutations.
 */
export const useCoinHubStore = defineStore('coinHub', () => {
  const balance = ref(0)
  const pending = ref(0)
  const dailySpinAvailable = ref(true)
  const freeCaseState = ref<CoinHubCaseState>('available')
  const subscriberCaseState = ref<CoinHubCaseState>('locked')
  const caseStates = ref<CoinHubCaseState[]>(['available', 'available', 'locked', 'cooldown'])
  const caseRewards = ref<(string | null)[]>([null, null, null, null])
  const caseGridCooldownUntilIso = ref<(string | null)[]>([null, null, null, null])
  const freeCaseCooldownUntilIso = ref<string | null>(null)
  const subscriberCaseCooldownUntilIso = ref<string | null>(null)
  const spinPayout = ref(0)
  const spinNextAvailableAtIso = ref<string | null>(null)
  const lastError = ref<string | null>(null)
  const lastErrorKind = ref<CoinHubErrorKind | null>(null)
  const lastAction = ref<CoinHubLastAction | null>(null)
  const lastOpenCaseId = ref<string | null>(null)
  /** Set from `opened` in POST `/api/coinhub/case/open` (for modal copy). */
  const lastOpenedCaseRewardLine = ref<string | null>(null)
  const hubLoading = ref(false)
  const refreshing = ref(false)
  const initialHydrated = ref(false)
  const claimInFlight = ref(false)
  const spinInFlight = ref(false)
  const openingCaseId = shallowRef<string | null>(null)
  const loadInflight = shallowRef<Promise<void> | null>(null)

  /**
   * When `true` before `balance` is bumped, the next `balance` change should not yank
   * `displayAmount` in the hero — `consumeBalanceSkipForPremiumCountUp` handles count-up.
   * Client-only path for fake / placeholder premium purchase rewards.
   */
  const premiumBalanceDisplaySkip = ref(false)

  /** Incremented to trigger a one-off hero balance “celebration” scale pulse (premium reward UX). */
  const balanceCelebrationPulse = ref(0)

  /** Lifts the Coin Hub hero above the teleported premium celebration overlay (body stacking). Toggled from PremiumPlansModal. */
  const premiumCelebrationHeroLift = ref(false)

  const refs = {
    balance,
    pending,
    dailySpinAvailable,
    freeCaseState,
    subscriberCaseState,
    caseStates,
    caseRewards,
    caseGridCooldownUntilIso,
    freeCaseCooldownUntilIso,
    subscriberCaseCooldownUntilIso,
    spinPayout,
    spinNextAvailableAtIso,
  }

  function clearActionError() {
    lastError.value = null
    lastErrorKind.value = null
    lastAction.value = null
  }

  function applySnapshot(raw: ApiCoinHub) {
    applyCoinHubToRefs(raw, refs)
  }

  function setActionErrorLocal(e: unknown, action: CoinHubLastAction) {
    const c = classifyCoinHubError(e)
    lastErrorKind.value = c.kind
    lastError.value = c.message
    lastAction.value = action
  }

  /**
   * @param background When true, never shows full-page load; failures do not overwrite user-facing errors.
   */
  function loadSnapshot(opts?: { background?: boolean }): Promise<void> {
    if (loadInflight.value) {
      return loadInflight.value
    }
    const bg = opts?.background === true
    const p = (async () => {
      if (bg) {
        refreshing.value = true
      } else {
        if (!initialHydrated.value) {
          hubLoading.value = true
        }
        clearActionError()
      }
      try {
        const { coinHub } = await getCoinHub()
        applySnapshot(coinHub)
        clearActionError()
      } catch (e) {
        if (!bg) {
          setActionErrorLocal(e, 'load')
        }
      } finally {
        if (!bg) {
          hubLoading.value = false
        }
        refreshing.value = false
        initialHydrated.value = true
        loadInflight.value = null
      }
    })()
    loadInflight.value = p
    return p
  }

  async function claimPending(): Promise<void> {
    if (claimInFlight.value) {
      return
    }
    if (pending.value <= 0) {
      return
    }
    claimInFlight.value = true
    clearActionError()
    try {
      const { coinHub } = await postCoinHubClaim()
      applySnapshot(coinHub)
    } catch (e) {
      setActionErrorLocal(e, 'claim')
      throw e
    } finally {
      claimInFlight.value = false
    }
  }

  async function spin(): Promise<boolean> {
    if (spinInFlight.value) {
      return false
    }
    spinInFlight.value = true
    clearActionError()
    try {
      const { coinHub } = await postCoinHubSpin()
      applySnapshot(coinHub)
      return true
    } catch (e) {
      setActionErrorLocal(e, 'spin')
      return false
    } finally {
      spinInFlight.value = false
    }
  }

  async function openCase(caseId: string): Promise<boolean> {
    if (openingCaseId.value != null) {
      return false
    }
    lastOpenCaseId.value = caseId
    openingCaseId.value = caseId
    lastOpenedCaseRewardLine.value = null
    clearActionError()
    try {
      const { coinHub, opened } = await postCoinHubCaseOpen(caseId)
      applySnapshot(coinHub)
      lastOpenedCaseRewardLine.value = mapRewardToLine(opened?.reward)
      return true
    } catch (e) {
      setActionErrorLocal(e, 'open')
      return false
    } finally {
      openingCaseId.value = null
    }
  }

  /**
   * Adds coins locally (no API). Real billing should replace this; hero animates the bump.
   */
  function applyLocalPremiumBonus(amt: number) {
    const a = Math.max(0, Math.floor(amt))
    if (a <= 0) {
      return
    }
    premiumBalanceDisplaySkip.value = true
    balance.value += a
  }

  function consumeBalanceSkipForPremiumCountUp(): boolean {
    if (!premiumBalanceDisplaySkip.value) {
      return false
    }
    premiumBalanceDisplaySkip.value = false
    return true
  }

  function requestBalanceCelebrationPulse() {
    balanceCelebrationPulse.value += 1
  }

  async function retryLastAction(): Promise<void> {
    const a = lastAction.value
    if (a == null) {
      return
    }
    if (a === 'load') {
      await loadSnapshot()
      return
    }
    if (a === 'claim') {
      await claimPending()
      return
    }
    if (a === 'spin') {
      await spin()
      return
    }
    if (a === 'open') {
      const id = lastOpenCaseId.value
      if (id) {
        await openCase(id)
      }
    }
  }

  return {
    balance,
    pending,
    dailySpinAvailable,
    freeCaseState,
    subscriberCaseState,
    caseStates,
    caseRewards,
    caseGridCooldownUntilIso,
    freeCaseCooldownUntilIso,
    subscriberCaseCooldownUntilIso,
    spinPayout,
    spinNextAvailableAtIso,
    lastError,
    lastErrorKind,
    lastAction,
    lastOpenCaseId,
    lastOpenedCaseRewardLine,
    hubLoading,
    refreshing,
    initialHydrated,
    claimInFlight,
    spinInFlight,
    openingCaseId,
    clearActionError,
    loadSnapshot,
    claimPending,
    spin,
    openCase,
    retryLastAction,
    applyLocalPremiumBonus,
    consumeBalanceSkipForPremiumCountUp,
    balanceCelebrationPulse,
    requestBalanceCelebrationPulse,
    premiumCelebrationHeroLift,
  }
})
