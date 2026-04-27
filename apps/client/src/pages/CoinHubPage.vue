<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import CoinHubHero from '@/components/coinhub/CoinHubHero.vue'
import DailyCard from '@/components/coinhub/DailyCard.vue'
import SpinModule from '@/components/coinhub/SpinModule.vue'
import CaseCard from '@/components/coinhub/CaseCard.vue'
import CaseOpeningModal from '@/components/coinhub/CaseOpeningModal.vue'
import BoostCard from '@/components/coinhub/BoostCard.vue'
import StreamerCard from '@/components/coinhub/StreamerCard.vue'
import CoinHubUpgradePanel from '@/components/coinhub/CoinHubUpgradePanel.vue'
import { useAdminMode } from '@/composables/useAdminMode'
import { useCoinHubAdminUi } from '@/composables/useCoinHubAdminUi'
import { useCoinHubPageRuntime } from '@/composables/useCoinHubPageRuntime'
import { useCoinHubStore } from '@/stores/coinHub'
import type { CoinHubCaseState } from '@/types/coinHub'
import { formatMmSsRemaining } from '@/utils/coinHub/coinHubFormat'
import '@/styles/coinhub-design-system.css'

const { t } = useI18n()
const { isAdmin } = useAdminMode()
const coinHub = useCoinHubStore()
const {
  pending,
  freeCaseState,
  subscriberCaseState,
  caseStates,
  spinNextAvailableAtIso,
  caseRewards,
  spinPayout,
  caseGridCooldownUntilIso,
  freeCaseCooldownUntilIso,
  subscriberCaseCooldownUntilIso,
  lastError,
  lastErrorKind,
  lastAction,
  hubLoading,
  initialHydrated,
  openingCaseId,
  lastOpenedCaseRewardLine,
} = storeToRefs(coinHub)

const hasPending = computed(() => pending.value > 0)
const flowFocal = computed(() => (hasPending.value ? 'claim' : 'daily'))

/** Minimum time the first-load ring is visible — avoids a sub-100ms flash when the API is very fast. */
const COINHUB_FIRST_LOAD_MIN_MS = 500

/**
 * True while the first GET has not completed. Initialized from the store so the first client paint
 * can show the overlay *over* the already-mounted route (not an empty area before the page exists).
 */
const showPageLoader = ref(!initialHydrated.value)
const firstLoadStartedAt = ref<number | null>(!initialHydrated.value ? Date.now() : null)
let firstLoadMinHoldTimer: ReturnType<typeof setTimeout> | null = null

function clearFirstLoadMinHold() {
  if (firstLoadMinHoldTimer) {
    clearTimeout(firstLoadMinHoldTimer)
    firstLoadMinHoldTimer = null
  }
}

watch(
  () => ({ hydrated: initialHydrated.value, loading: hubLoading.value }),
  ({ hydrated, loading }) => {
    const inFirstFetch = !hydrated && loading
    if (inFirstFetch) {
      clearFirstLoadMinHold()
      if (firstLoadStartedAt.value == null) {
        firstLoadStartedAt.value = Date.now()
      }
      showPageLoader.value = true
      return
    }
    if (hydrated) {
      if (firstLoadStartedAt.value == null) {
        showPageLoader.value = false
        return
      }
      const t0 = firstLoadStartedAt.value
      const elapsed = Date.now() - t0
      if (elapsed >= COINHUB_FIRST_LOAD_MIN_MS) {
        showPageLoader.value = false
        firstLoadStartedAt.value = null
        return
      }
      clearFirstLoadMinHold()
      const remaining = COINHUB_FIRST_LOAD_MIN_MS - elapsed
      firstLoadMinHoldTimer = setTimeout(() => {
        firstLoadMinHoldTimer = null
        showPageLoader.value = false
        firstLoadStartedAt.value = null
      }, remaining)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearFirstLoadMinHold()
})

const errorHeadline = computed(() => {
  const k = lastErrorKind.value
  if (k === 'auth') return t('coinHub.errorAuth')
  if (k === 'network') return t('coinHub.errorNetwork')
  if (k === 'http') return t('coinHub.errorHttp')
  return t('coinHub.errorHttp')
})

function luckCaseId(i: number): string {
  return `luck-${i}`
}

function cooldownDetail(iso: string | null, state: CoinHubCaseState, now: number): string | null {
  if (state !== 'cooldown' || !iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  return formatMmSsRemaining(end - now)
}

const { nowMs } = useCoinHubPageRuntime({
  onBackgroundLoad: () => {
    void coinHub.loadSnapshot({ background: true })
  },
  shouldRefreshOnCooldownEdge: (now) => {
    if (isAdmin.value) {
      return false
    }
    const isos: (string | null | undefined)[] = [
      ...caseGridCooldownUntilIso.value,
      freeCaseCooldownUntilIso.value,
      subscriberCaseCooldownUntilIso.value,
      spinNextAvailableAtIso.value,
    ]
    for (const iso of isos) {
      if (iso == null) continue
      const end = new Date(iso).getTime()
      if (Number.isNaN(end)) continue
      const rem = end - now
      if (rem <= 0 && rem > -3_000) {
        return true
      }
    }
    return false
  },
})

const {
  effectiveDailySpinAvailable,
  effectiveFreeCaseState,
  effectiveSubscriberCaseState,
  effectiveCaseStates,
  effectiveSpinCooldownHint,
} = useCoinHubAdminUi(isAdmin, nowMs)

const luckCaseDetail = computed(() =>
  caseStates.value.map((state, i) => cooldownDetail(caseGridCooldownUntilIso.value[i] ?? null, state, nowMs.value)),
)

const freeCaseDetail = computed(() =>
  cooldownDetail(freeCaseCooldownUntilIso.value, freeCaseState.value, nowMs.value),
)
const subscriberCaseDetail = computed(() =>
  cooldownDetail(subscriberCaseCooldownUntilIso.value, subscriberCaseState.value, nowMs.value),
)

onMounted(() => {
  void coinHub.loadSnapshot()
})

/**
 * When the first load finishes, the full page (including hero) mounts at once. Scroll anchoring
 * can bump `window.scrollY` — reset to top after the loader hides.
 */
watch(showPageLoader, (loading) => {
  if (loading) {
    return
  }
  void nextTick().then(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
  })
})

function onRetry() {
  void coinHub.retryLastAction()
}

const caseModalOpen = ref(false)
const caseModalResolving = ref(false)
const caseModalReward = ref<string | null>(null)
const caseModalTitle = ref('')

function onCaseModalUpdateOpen(v: boolean) {
  caseModalOpen.value = v
  if (!v) {
    caseModalResolving.value = false
    caseModalReward.value = null
    caseModalTitle.value = ''
  }
}

async function onLuckCaseOpen(index: number) {
  if (!isAdmin.value && caseStates.value[index] !== 'available') {
    return
  }
  if (openingCaseId.value) {
    return
  }
  caseModalTitle.value = t('coinHub.casePlaceholder')
  caseModalOpen.value = true
  caseModalResolving.value = true
  caseModalReward.value = null
  const id = luckCaseId(index)
  const ok = await coinHub.openCase(id)
  caseModalResolving.value = false
  if (!ok) {
    caseModalOpen.value = false
    caseModalReward.value = null
    return
  }
  caseModalReward.value = caseRewards.value[index] ?? lastOpenedCaseRewardLine.value ?? t('coinHub.caseRewardDemo')
}

async function onDailyCaseOpen(kind: 'free' | 'subscriber') {
  const state = kind === 'free' ? effectiveFreeCaseState.value : effectiveSubscriberCaseState.value
  if (!isAdmin.value && state !== 'available') {
    return
  }
  if (openingCaseId.value) {
    return
  }
  caseModalTitle.value = kind === 'free' ? t('coinHub.freeCase') : t('coinHub.subscriberCase')
  caseModalOpen.value = true
  caseModalResolving.value = true
  caseModalReward.value = null
  const id = kind === 'free' ? 'free' : 'subscriber'
  const ok = await coinHub.openCase(id)
  caseModalResolving.value = false
  if (!ok) {
    caseModalOpen.value = false
    caseModalReward.value = null
    return
  }
  caseModalReward.value = lastOpenedCaseRewardLine.value ?? t('coinHub.caseRewardDemo')
}

const luckCasePriceLabels = computed(() => [
  t('coinHub.casePriceCommon'),
  t('coinHub.casePriceRare'),
  t('coinHub.casePriceEpic'),
  t('coinHub.casePriceLegendary'),
])

const luckCaseRarityTitles = [
  'coinHub.caseRarity0',
  'coinHub.caseRarity1',
  'coinHub.caseRarity2',
  'coinHub.caseRarity3',
] as const

function luckCaseTitle(index: number): string {
  const k = luckCaseRarityTitles[index]
  return k ? t(k) : t('coinHub.casePlaceholder')
}
</script>

<template>
  <div
    class="page-route coin-hub coin-hub--game-ui ch-ds-root relative min-h-0 w-full flex-1"
    :aria-busy="showPageLoader"
    :inert="showPageLoader || undefined"
  >
    <div
        class="coinhub-hero-and-upgrade w-full min-w-0 flex flex-col gap-0 md:mx-auto md:grid md:max-w-[1320px] md:grid-cols-[1.4fr_1fr] md:items-stretch md:gap-6 md:px-4 md:pt-5 md:pb-5"
      >
        <div class="min-w-0 min-h-0">
          <CoinHubHero
            :balance-label="t('coinHub.heroBalance')"
            :pending-label="t('coinHub.pending')"
            :claim-label="t('coinHub.claim')"
            :is-focal-target="flowFocal === 'claim'"
            :admin-dev-label="isAdmin ? t('coinHub.adminDevMode') : undefined"
          />
        </div>
        <CoinHubUpgradePanel
          class="max-md:hidden min-h-0 h-full"
          inline-with-hero
        />
      </div>
      <AppContainer
        class="coin-hub__inner flex min-h-0 flex-col gap-6 pb-8 pt-6 md:pb-8"
      >
        <div
          v-if="lastError"
          class="flex flex-col items-stretch gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div>
            <p class="text-sm font-medium text-amber-200/90">
              {{ errorHeadline }}
            </p>
            <p class="mt-0.5 text-xs text-amber-200/50">
              {{ lastError }}
            </p>
          </div>
          <button
            v-if="lastAction"
            type="button"
            class="shrink-0 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
            @click="onRetry"
          >
            {{ t('coinHub.retry') }}
          </button>
        </div>

        <section
          class="coinhub-roulette-section w-full min-w-0 px-4"
          :aria-label="t('coinHub.dailySpin')"
        >
          <div class="mx-auto w-full max-w-[1300px] min-w-0">
            <!-- :section-description="t('coinHub.dailySectionHint')" -->
            <SpinModule
              variant="hero"
              :tag-label="t('coinHub.labelDaily')"
              :title="t('coinHub.dailySpin')"
              :action-label="t('coinHub.ctaSpin')"
              :is-focal-target="flowFocal === 'daily'"
              :show-availability-pulse="flowFocal === 'daily' && effectiveDailySpinAvailable"
              :state-label-available="t('coinHub.stateAvailable')"
              :target-payout="spinPayout"
              :spin-available="effectiveDailySpinAvailable"
              :spin-cooldown-hint="effectiveSpinCooldownHint"
              :omit-hero-heading="true"
            />
          </div>
        </section>

        <section
          class="coinhub-daily-cases-block hidden w-full min-w-0 px-4"
          :aria-label="t('coinHub.dailyCasesTitle')"
        >
          <div
            class="coinhub-daily-cases-block__inner ch-ds-card ch-ds-card--alt ch-ds-card--interactive mx-auto max-w-[1300px] flex min-w-0 flex-col gap-4 p-6 sm:p-8"
          >
            <div>
              <p
                class="ch-ds-text-label text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]"
              >
                {{ t('coinHub.dailyAreaLabel') }}
              </p>
              <h2 class="ch-ds-text-section mt-1 text-[22px] sm:text-[28px]">
                {{ t('coinHub.dailyCasesTitle') }}
              </h2>
            </div>
            <div
              class="coinhub-daily-cases__stack flex min-h-0 min-w-0 flex-1 flex-col gap-6"
            >
              <DailyCard
                visual-tier="free"
                :tag-label="t('coinHub.labelFree')"
                :title="t('coinHub.freeCase')"
                :action-label="t('coinHub.ctaOpen')"
                :state="effectiveFreeCaseState"
                :detail-label="effectiveFreeCaseState === 'cooldown' ? (freeCaseDetail || t('coinHub.cooldownSample')) : undefined"
                :state-label-available="t('coinHub.stateAvailable')"
                :state-label-locked="t('coinHub.stateLocked')"
                :state-label-cooldown="t('coinHub.stateCooldown')"
                @open="onDailyCaseOpen('free')"
              />
              <DailyCard
                visual-tier="subscriber"
                :tag-label="t('coinHub.labelSubscriber')"
                :title="t('coinHub.subscriberCase')"
                :action-label="t('coinHub.ctaOpen')"
                :state="effectiveSubscriberCaseState"
                :detail-label="effectiveSubscriberCaseState === 'cooldown' ? (subscriberCaseDetail || t('coinHub.cooldownSample')) : undefined"
                :state-label-available="t('coinHub.stateAvailable')"
                :state-label-locked="t('coinHub.stateLocked')"
                :state-label-cooldown="t('coinHub.stateCooldown')"
                @open="onDailyCaseOpen('subscriber')"
              />
            </div>
          </div>
        </section>

        <div
          class="coinhub-lower-grid hidden grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6 lg:items-start"
        >
          <section
            class="coinhub-panel coinhub-panel--secondary coinhub-lower__luck ch-ds-card ch-ds-card--interactive p-8 lg:col-span-5"
            :aria-label="t('coinHub.sectionLuck')"
          >
            <header class="coinhub-sec-h coinhub-sec-h--secondary mb-6 md:mb-7">
              <h2 class="ch-ds-text-section text-[24px] sm:text-[28px]">
                {{ t('coinHub.sectionLuck') }}
              </h2>
              <p class="ch-ds-text-muted mt-2 text-sm">
                {{ t('coinHub.luckSectionHint') }}
              </p>
            </header>
            <div
              class="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
            >
              <CaseCard
                v-for="(state, index) in effectiveCaseStates"
                :key="`case-${index}`"
                :title="luckCaseTitle(index)"
                :action-label="t('coinHub.caseCta')"
                :price-label="luckCasePriceLabels[index] ?? undefined"
                :state="state"
                :rarity-id="index"
                :detail-label="
                  state === 'cooldown' ? (luckCaseDetail[index] || t('coinHub.cooldownSample')) : undefined
                "
                :state-label-locked="t('coinHub.stateLocked')"
                :state-label-cooldown="t('coinHub.stateCooldown')"
                :is-remote-busy="openingCaseId === luckCaseId(index)"
                @open="onLuckCaseOpen(index)"
              />
            </div>
          </section>

          <div class="coinhub-lower__mid flex flex-col gap-6 lg:col-span-4">
            <section
              class="coinhub-panel coinhub-panel--tertiary ch-ds-card ch-ds-card--interactive p-8"
              :aria-label="t('coinHub.sectionBoosts')"
            >
              <header class="coinhub-sec-h coinhub-sec-h--tertiary mb-5">
                <h2 class="ch-ds-text-section text-[24px] sm:text-[28px]">
                  {{ t('coinHub.sectionBoosts') }}
                </h2>
                <p class="ch-ds-text-label mt-2">
                  {{ t('coinHub.activeBoosts') }}
                </p>
                <p class="ch-ds-text-muted mt-1.5 text-sm">
                  {{ t('coinHub.spendSectionHint') }}
                </p>
              </header>
              <div class="flex flex-col gap-4">
                <BoostCard
                  :label="t('coinHub.boostMoney')"
                  variant="money"
                />
                <BoostCard
                  :label="t('coinHub.boostSpeed')"
                  variant="speed"
                />
                <BoostCard
                  :label="t('coinHub.boostLuck')"
                  variant="luck"
                />
              </div>
            </section>

            <CoinHubUpgradePanel
              class="md:hidden"
            />
          </div>

          <section
            class="coinhub-panel coinhub-panel--tertiary coinhub-lower__live ch-ds-card ch-ds-card--interactive p-8 lg:col-span-3"
            :aria-label="t('coinHub.sectionLive')"
          >
            <header class="coinhub-sec-h coinhub-sec-h--tertiary mb-5">
              <h2 class="ch-ds-text-section text-[24px] sm:text-[28px]">
                {{ t('coinHub.sectionLive') }}
              </h2>
              <p class="ch-ds-text-muted mt-2 text-sm">
                {{ t('coinHub.liveSectionHint') }}
              </p>
            </header>
            <div class="flex flex-col gap-4">
              <StreamerCard
                :name="t('coinHub.streamerPlaceholder')"
                :viewers-label="t('coinHub.streamerViewersSample1')"
                live
              />
              <StreamerCard
                :name="t('coinHub.streamerPlaceholder')"
                :viewers-label="t('coinHub.streamerViewersSample2')"
                live
              />
              <StreamerCard
                :name="t('coinHub.streamerPlaceholder')"
                :viewers-label="t('coinHub.streamerViewersSample3')"
                live
              />
            </div>
          </section>
        </div>
    </AppContainer>

    <AppFullPageLoader
      :visible="showPageLoader"
      :aria-label="t('app.routeLoadingAria')"
      :teleport="false"
      label=""
    />

    <CaseOpeningModal
      :open="caseModalOpen"
      :title="caseModalTitle || t('coinHub.casePlaceholder')"
      :resolving="caseModalResolving"
      :reward-line="caseModalReward"
      @update:open="onCaseModalUpdateOpen"
    />
  </div>
</template>

<style scoped>
.coin-hub--game-ui {
  isolation: isolate;
  /* With large blocks mounting above the fold, default scroll anchoring can fight explicit scroll. */
  overflow-anchor: none;
}
.coin-hub--game-ui :deep(.coin-hub__inner) {
  position: relative;
  z-index: 1;
}
.coinhub-panel {
  z-index: 1;
}
.coinhub-sec-h--primary {
  border-bottom: 1px solid var(--ch-border, rgba(255, 255, 255, 0.06));
  padding-bottom: 1.25rem;
}
.coinhub-sec-h--secondary {
  border-bottom: 1px solid var(--ch-border, rgba(255, 255, 255, 0.06));
  padding-bottom: 1rem;
}
.coinhub-sec-h--tertiary {
  border-bottom: 1px solid var(--ch-border, rgba(255, 255, 255, 0.06));
  padding-bottom: 0.85rem;
}
.coinhub-sec-h--hero-daily {
  border-bottom: 1px solid var(--ch-border, rgba(255, 255, 255, 0.06));
}

.coinhub-roulette-section {
  margin: clamp(2.25rem, 0, 3.75rem) 0;
  position: relative;
  z-index: 1;
}

.coinhub-daily-cases-block {
  margin: 0 0 clamp(2rem, 4vw, 3rem);
  position: relative;
  z-index: 1;
}

/* One row with upgrade: align with grid padding; no double horizontal margin on hero */
@media (min-width: 768px) {
  .coinhub-hero-and-upgrade :deep(.hero-wrapper) {
    margin-top: 0;
    margin-bottom: 0;
    max-width: none;
    padding-left: 0;
    padding-right: 0;
  }
}
</style>
