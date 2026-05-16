import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { getCoinHub, postCoinHubCaseOpen, postCoinHubClaim, postCoinHubSpin, } from '@/api/coinHubApi';
import { classifyCoinHubError } from '@/utils/coinHub/coinHubErrorKind';
const LUCK_CASE_IDS = ['luck-0', 'luck-1', 'luck-2', 'luck-3'];
function asCaseState(s) {
    if (s === 'available' || s === 'locked' || s === 'cooldown')
        return s;
    return 'available';
}
function mapRewardToLine(r) {
    if (r == null)
        return null;
    if (r.kind === 'coins' && Number.isFinite(r.amount)) {
        return `+${r.amount}`;
    }
    return null;
}
function applyCoinHubToRefs(raw, refs) {
    refs.balance.value = raw.balance;
    refs.pending.value = raw.pending;
    refs.dailySpinAvailable.value = raw.spin.available;
    refs.spinNextAvailableAtIso.value = raw.spin.nextAvailableAt;
    const lr = raw.spin.lastReward;
    if (lr && lr.kind === 'coins' && Number.isFinite(lr.amount)) {
        refs.spinPayout.value = lr.amount;
    }
    else {
        refs.spinPayout.value = 0;
    }
    const byId = new Map(raw.cases.map((c) => [c.id, c]));
    refs.caseStates.value = LUCK_CASE_IDS.map((id) => asCaseState(byId.get(id)?.state ?? 'available'));
    refs.caseRewards.value = LUCK_CASE_IDS.map((id) => mapRewardToLine(byId.get(id)?.displayReward ?? null));
    refs.caseGridCooldownUntilIso.value = LUCK_CASE_IDS.map((id) => {
        const c = byId.get(id);
        if (c?.state === 'cooldown' && c.cooldownUntil)
            return c.cooldownUntil;
        return null;
    });
    const free = byId.get('free');
    refs.freeCaseState.value = asCaseState(free?.state ?? 'available');
    refs.freeCaseCooldownUntilIso.value =
        free?.state === 'cooldown' && free.cooldownUntil ? free.cooldownUntil : null;
    const sub = byId.get('subscriber');
    refs.subscriberCaseState.value = asCaseState(sub?.state ?? 'locked');
    refs.subscriberCaseCooldownUntilIso.value =
        sub?.state === 'cooldown' && sub.cooldownUntil ? sub.cooldownUntil : null;
}
export const useCoinHubStore = defineStore('coinHub', () => {
    const balance = ref(0);
    const pending = ref(0);
    const dailySpinAvailable = ref(true);
    const freeCaseState = ref('available');
    const subscriberCaseState = ref('locked');
    const caseStates = ref(['available', 'available', 'locked', 'cooldown']);
    const caseRewards = ref([null, null, null, null]);
    const caseGridCooldownUntilIso = ref([null, null, null, null]);
    const freeCaseCooldownUntilIso = ref(null);
    const subscriberCaseCooldownUntilIso = ref(null);
    const spinPayout = ref(0);
    const spinNextAvailableAtIso = ref(null);
    const lastError = ref(null);
    const lastErrorKind = ref(null);
    const lastAction = ref(null);
    const lastOpenCaseId = ref(null);
    const lastOpenedCaseRewardLine = ref(null);
    const hubLoading = ref(false);
    const refreshing = ref(false);
    const initialHydrated = ref(false);
    const claimInFlight = ref(false);
    const spinInFlight = ref(false);
    const openingCaseId = shallowRef(null);
    const loadInflight = shallowRef(null);
    /**
     * When `true` before `balance` is bumped, the next `balance` change should not yank
     * `displayAmount` in the hero — `consumeBalanceSkipForPremiumCountUp` handles count-up.
     * Client-only path for fake / placeholder premium purchase rewards.
     */
    const premiumBalanceDisplaySkip = ref(false);
    const balanceCelebrationPulse = ref(0);
    const premiumCelebrationHeroLift = ref(false);
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
    };
    function clearActionError() {
        lastError.value = null;
        lastErrorKind.value = null;
        lastAction.value = null;
    }
    function applySnapshot(raw) {
        applyCoinHubToRefs(raw, refs);
    }
    function setActionErrorLocal(e, action) {
        const c = classifyCoinHubError(e);
        lastErrorKind.value = c.kind;
        lastError.value = c.message;
        lastAction.value = action;
    }
    /**
     * @param background When true, never shows full-page load; failures do not overwrite user-facing errors.
     */
    function loadSnapshot(opts) {
        if (loadInflight.value) {
            return loadInflight.value;
        }
        const bg = opts?.background === true;
        const p = (async () => {
            if (bg) {
                refreshing.value = true;
            }
            else {
                if (!initialHydrated.value) {
                    hubLoading.value = true;
                }
                clearActionError();
            }
            try {
                const { coinHub } = await getCoinHub();
                applySnapshot(coinHub);
                clearActionError();
            }
            catch (e) {
                if (!bg) {
                    setActionErrorLocal(e, 'load');
                }
            }
            finally {
                if (!bg) {
                    hubLoading.value = false;
                }
                refreshing.value = false;
                initialHydrated.value = true;
                loadInflight.value = null;
            }
        })();
        loadInflight.value = p;
        return p;
    }
    async function claimPending() {
        if (claimInFlight.value) {
            return;
        }
        if (pending.value <= 0) {
            return;
        }
        claimInFlight.value = true;
        clearActionError();
        try {
            const { coinHub } = await postCoinHubClaim();
            applySnapshot(coinHub);
        }
        catch (e) {
            setActionErrorLocal(e, 'claim');
            throw e;
        }
        finally {
            claimInFlight.value = false;
        }
    }
    async function spin() {
        if (spinInFlight.value) {
            return false;
        }
        spinInFlight.value = true;
        clearActionError();
        try {
            const { coinHub } = await postCoinHubSpin();
            applySnapshot(coinHub);
            return true;
        }
        catch (e) {
            setActionErrorLocal(e, 'spin');
            return false;
        }
        finally {
            spinInFlight.value = false;
        }
    }
    async function openCase(caseId) {
        if (openingCaseId.value != null) {
            return false;
        }
        lastOpenCaseId.value = caseId;
        openingCaseId.value = caseId;
        lastOpenedCaseRewardLine.value = null;
        clearActionError();
        try {
            const { coinHub, opened } = await postCoinHubCaseOpen(caseId);
            applySnapshot(coinHub);
            lastOpenedCaseRewardLine.value = mapRewardToLine(opened?.reward);
            return true;
        }
        catch (e) {
            setActionErrorLocal(e, 'open');
            return false;
        }
        finally {
            openingCaseId.value = null;
        }
    }
    function applyLocalPremiumBonus(amt) {
        const a = Math.max(0, Math.floor(amt));
        if (a <= 0) {
            return;
        }
        premiumBalanceDisplaySkip.value = true;
        balance.value += a;
    }
    function consumeBalanceSkipForPremiumCountUp() {
        if (!premiumBalanceDisplaySkip.value) {
            return false;
        }
        premiumBalanceDisplaySkip.value = false;
        return true;
    }
    function requestBalanceCelebrationPulse() {
        balanceCelebrationPulse.value += 1;
    }
    async function retryLastAction() {
        const a = lastAction.value;
        if (a == null) {
            return;
        }
        if (a === 'load') {
            await loadSnapshot();
            return;
        }
        if (a === 'claim') {
            await claimPending();
            return;
        }
        if (a === 'spin') {
            await spin();
            return;
        }
        if (a === 'open') {
            const id = lastOpenCaseId.value;
            if (id) {
                await openCase(id);
            }
        }
    }
    /**
     * Reset every per-user piece of CoinHub state back to initial. Called from
     * `useAuth.logout()` so the next user logging in on the same browser does
     * not see the previous user's balance, case rewards, cooldowns, or the
     * "spin in flight" UI flag.
     *
     * Inflight promise refs (`loadInflight`) are cleared, but any in-flight
     * fetch will simply land into a future store instance — its `applySnapshot`
     * call after reset is harmless: it will just reflect the new user's state
     * (or 401 → not applied at all in `loadSnapshot`'s catch).
     */
    function reset() {
        balance.value = 0;
        pending.value = 0;
        dailySpinAvailable.value = true;
        freeCaseState.value = 'available';
        subscriberCaseState.value = 'locked';
        caseStates.value = ['available', 'available', 'locked', 'cooldown'];
        caseRewards.value = [null, null, null, null];
        caseGridCooldownUntilIso.value = [null, null, null, null];
        freeCaseCooldownUntilIso.value = null;
        subscriberCaseCooldownUntilIso.value = null;
        spinPayout.value = 0;
        spinNextAvailableAtIso.value = null;
        lastError.value = null;
        lastErrorKind.value = null;
        lastAction.value = null;
        lastOpenCaseId.value = null;
        lastOpenedCaseRewardLine.value = null;
        hubLoading.value = false;
        refreshing.value = false;
        initialHydrated.value = false;
        claimInFlight.value = false;
        spinInFlight.value = false;
        openingCaseId.value = null;
        loadInflight.value = null;
        premiumBalanceDisplaySkip.value = false;
        balanceCelebrationPulse.value = 0;
        premiumCelebrationHeroLift.value = false;
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
        reset,
    };
});
