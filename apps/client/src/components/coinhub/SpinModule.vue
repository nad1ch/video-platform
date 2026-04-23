<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import CoinHubStripRoll from '@/components/coinhub/CoinHubStripRoll.vue'
import { useAdminMode } from '@/composables/useAdminMode'
import { useCoinHubStore } from '@/stores/coinHub'
import {
  playCoinCollect,
  playSpinStart,
  playStripResolving,
  playWinByRarity,
} from '@/utils/coinHub/coinHubAudioStub'
import '@/styles/coinhub-design-system.css'
import { buildSpinStripCells, getSpinRarity } from '@/utils/coinHub/coinHubStripMath'
import { SPIN_BIG_WIN_MIN_COINS } from '@/utils/coinHub/coinHubSpinReel'
import type { SpinStripCell } from '@/utils/coinHub/coinHubStripMath'

type StripMeta = {
  remainingMainMs: number
  rawU: number
  scrollPos: number
  preWin: boolean
  heartbeat: boolean
  inMainPhase: boolean
}

const props = withDefaults(
  defineProps<{
    tagLabel: string
    title: string
    actionLabel: string
    stateLabelAvailable: string
    showAvailabilityPulse?: boolean
    isFocalTarget?: boolean
    targetPayout?: number
    spinAvailable?: boolean
    spinCooldownHint?: string
    /** Cinematic main reel on Coin Hub (`lg` strip + frame). */
    variant?: 'default' | 'hero'
    /**
     * When `variant` is `hero`, omit tag + title — parent `CoinHubPage` provides section chrome
     * (roulette is embedded in a dedicated full-width block).
     */
    omitHeroHeading?: boolean
    /** Short line under the title (e.g. daily section hint). Hero layout only. */
    sectionDescription?: string
  }>(),
  {
    showAvailabilityPulse: false,
    isFocalTarget: false,
    targetPayout: 0,
    spinAvailable: true,
    variant: 'default',
    omitHeroHeading: false,
    sectionDescription: undefined,
  },
)

const { t } = useI18n()
const { isAdmin } = useAdminMode()
const coinHub = useCoinHubStore()
const { spinPayout: spinPayoutFromStore } = storeToRefs(coinHub)

type Phase = 'idle' | 'resolving' | 'rolling' | 'result'

const phase = ref<Phase>('idle')
const impactHold = ref(false)
const winBurst = ref(false)
const showWinPill = ref(false)
const rewardPop = ref(false)
let winTimers: number[] = []
const DRY_STREAK_KEY = 'coinhub:spin-dry-streak'

function readDryStreak(): number {
  if (typeof sessionStorage === 'undefined') {
    return 0
  }
  const raw = sessionStorage.getItem(DRY_STREAK_KEY)
  if (!raw) {
    return 0
  }
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? Math.min(999, n) : 0
}

function writeDryStreak(n: number) {
  if (typeof sessionStorage === 'undefined') {
    return
  }
  sessionStorage.setItem(DRY_STREAK_KEY, String(n))
}

/** Spins since last ≥ {@link SPIN_BIG_WIN_MIN_COINS} coin result; nudges filler weights (session). Admin: not persisted — each spin uses a “fresh” streak for strip theatre. */
const spinsSinceBigWin = ref(0)

function syncDryStreakFromStorage() {
  if (isAdmin.value) {
    spinsSinceBigWin.value = 0
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(DRY_STREAK_KEY)
    }
    return
  }
  spinsSinceBigWin.value = readDryStreak()
}

onMounted(() => {
  syncDryStreakFromStorage()
})

watch(isAdmin, () => {
  syncDryStreakFromStorage()
})

const rollCells = ref<(string | SpinStripCell)[]>(['—'])
const rollLand = ref(0)

type SpinFlyCoin = {
  id: string
  x: number
  y: number
  tx: number
  ty: number
  delay: string
  duration: string
}

const SPIN_FLY_COUNT = 16
const SPIN_FLY_STAGGER_MS = 36
const SPIN_FLY_TOTAL_MS = 900 + (SPIN_FLY_COUNT - 1) * SPIN_FLY_STAGGER_MS + 200

function makeSpinFlyCoins(sx: number, sy: number, ex: number, ey: number, count: number): SpinFlyCoin[] {
  const ddx = ex - sx
  const ddy = ey - sy
  return Array.from({ length: count }, (_, i) => {
    const jx = (Math.random() - 0.5) * 40
    const jy = (Math.random() - 0.5) * 40
    return {
      id: `spin-fly-${i}-${Date.now()}`,
      x: sx + jx,
      y: sy + jy,
      tx: ddx - jx,
      ty: ddy - jy,
      delay: `${i * SPIN_FLY_STAGGER_MS}ms`,
      duration: `${0.78 + Math.random() * 0.2}s`,
    }
  })
}

const spinReelFlySourceRef = ref<HTMLElement | null>(null)
const spinFlyActive = ref(false)
const spinFlyCoins = ref<SpinFlyCoin[]>([])
let spinFlyEndTimer: ReturnType<typeof setTimeout> | null = null

/** API truth from Pinia — avoids stale `props.targetPayout` one frame after `await spin()`. */
const finalPayout = computed(() => spinPayoutFromStore.value)
const wonLineAria = computed(() => t('coinHub.spinWon', { n: finalPayout.value }))
const rewardRarity = computed(() => getSpinRarity(finalPayout.value))

/** Single gold-tier frame pulse on win (no per-rarity rainbow). */
const heroWinFrameClass = computed(() => {
  if (!isHero.value || phase.value !== 'result') {
    return null
  }
  const r = getSpinRarity(finalPayout.value)
  if (r === 'legendary') {
    return 'slot-machine--win-gold slot-machine--win-gold--intense'
  }
  if (r === 'epic' || r === 'rare') {
    return 'slot-machine--win-gold slot-machine--win-gold--mid'
  }
  return 'slot-machine--win-gold'
})

/** Prevents double API spin + double onRollComplete if complete fires twice. */
const spinInteractionLock = ref(false)
const rollCompleteHandled = ref(false)

const stripMeta = ref<StripMeta>({
  remainingMainMs: 9999,
  rawU: 0,
  scrollPos: 0,
  preWin: false,
  heartbeat: false,
  inMainPhase: false,
})
const displayAmount = ref(0)
const camSnap = ref(false)
let countAnimRaf = 0

const useReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const cameraIn = computed(
  () =>
    phase.value === 'rolling' &&
    stripMeta.value.rawU >= 0.38 &&
    stripMeta.value.rawU < 0.999 &&
    stripMeta.value.inMainPhase,
)

const isHero = computed(() => props.variant === 'hero')
const stripItemW = computed(() => (isHero.value ? 90 : 72))
const stripSize = computed(() => (isHero.value ? 'lg' : 'md') as 'md' | 'lg')
/** Tighter, casino-style main reel timing on the large hero block. */
/** Longer main phase on hero reel so decel + bounce read as physical inertia, not a quick fade. */
/** Hero: ~10s main travel (fast → inertia decel) + short overshoot; default strip shorter. */
const spinStripDurationMs = computed(() => (isHero.value ? 10_000 : 3200))

const rollIsPlaceholder = computed(
  () => rollCells.value.length === 1 && rollCells.value[0] === '—',
)
/** “Attract” mode: slow infinite strip before the first spin (or after a failed request). */
const stripIdleAutoplay = computed(
  () =>
    isHero.value &&
    phase.value === 'idle' &&
    rollIsPlaceholder.value &&
    !coinHub.spinInFlight,
)

function clearWinTimers() {
  if (spinFlyEndTimer) {
    clearTimeout(spinFlyEndTimer)
    spinFlyEndTimer = null
  }
  winTimers.forEach((id) => {
    clearTimeout(id)
  })
  winTimers = []
}

async function onSpinCta() {
  if (spinInteractionLock.value) {
    return
  }
  if (!props.spinAvailable) {
    return
  }
  if (phase.value === 'resolving' || phase.value === 'rolling' || impactHold.value) {
    return
  }
  if (coinHub.spinInFlight) {
    return
  }

  spinInteractionLock.value = true
  rollCompleteHandled.value = false
  clearWinTimers()
  winBurst.value = false
  showWinPill.value = false
  rewardPop.value = false
  displayAmount.value = 0
  camSnap.value = false
  stripMeta.value = {
    remainingMainMs: 9999,
    rawU: 0,
    scrollPos: 0,
    preWin: false,
    heartbeat: false,
    inMainPhase: false,
  }
  playSpinStart()
  playStripResolving()
  phase.value = 'resolving'
  rollCells.value = ['—']
  rollLand.value = 0
  await nextTick()
  if (!useReducedMotion) {
    await new Promise<void>((r) => {
      window.setTimeout(r, 100)
    })
  }

  const ok = await coinHub.spin()
  if (!ok) {
    phase.value = 'idle'
    spinInteractionLock.value = false
    return
  }
  await nextTick()

  const { cells, landIndex } = buildSpinStripCells(spinPayoutFromStore.value, {
    spinsSinceBigWin: isAdmin.value ? 0 : spinsSinceBigWin.value,
  })
  rollCells.value = cells
  rollLand.value = landIndex
  phase.value = 'rolling'
  await nextTick()
  impactHold.value = false
}

function scheduleWinBurstEnd() {
  const tEndBurst = window.setTimeout(() => {
    winBurst.value = false
  }, 520)
  winTimers.push(tEndBurst)
}

function presentSpinWinImmediate() {
  phase.value = 'result'
  showWinPill.value = true
  rewardPop.value = true
  winBurst.value = true
  scheduleWinBurstEnd()
  coinHub.requestBalanceCelebrationPulse()
  playCoinCollect()
  spinInteractionLock.value = false
}

async function presentSpinWinWithFly() {
  await nextTick()
  const el = spinReelFlySourceRef.value
  const tEl = document.getElementById('coinhub-balance-fly-target')
  if (!el || !tEl) {
    presentSpinWinImmediate()
    return
  }
  const pr = el.getBoundingClientRect()
  const tr = tEl.getBoundingClientRect()
  const scx = pr.left + pr.width / 2
  const scy = pr.top + pr.height / 2
  const ecx = tr.left + tr.width / 2
  const ecy = tr.top + tr.height / 2
  spinFlyCoins.value = makeSpinFlyCoins(scx, scy, ecx, ecy, SPIN_FLY_COUNT)
  spinFlyActive.value = true
  phase.value = 'result'
  showWinPill.value = true
  rewardPop.value = true
  winBurst.value = true
  scheduleWinBurstEnd()
  spinFlyEndTimer = window.setTimeout(() => {
    spinFlyEndTimer = null
    spinFlyActive.value = false
    spinFlyCoins.value = []
    coinHub.requestBalanceCelebrationPulse()
    playCoinCollect()
  }, SPIN_FLY_TOTAL_MS)
  spinInteractionLock.value = false
}

function onRollComplete() {
  if (phase.value !== 'rolling') {
    return
  }
  if (rollCompleteHandled.value) {
    return
  }
  rollCompleteHandled.value = true
  const payout = finalPayout.value
  if (payout > 0) {
    playWinByRarity(getSpinRarity(payout))
  }
  if (!isAdmin.value) {
    if (payout >= SPIN_BIG_WIN_MIN_COINS) {
      spinsSinceBigWin.value = 0
    } else {
      spinsSinceBigWin.value += 1
    }
    writeDryStreak(spinsSinceBigWin.value)
  }
  clearWinTimers()
  impactHold.value = true
  winBurst.value = false
  showWinPill.value = false
  rewardPop.value = false

  const impactDelayMs = useReducedMotion ? 0 : 300
  const tImpact = window.setTimeout(() => {
    if (useReducedMotion || !isHero.value || payout <= 0) {
      presentSpinWinImmediate()
      return
    }
    void presentSpinWinWithFly()
  }, impactDelayMs)
  winTimers.push(tImpact)

  const tReleaseCta = window.setTimeout(
    () => {
      impactHold.value = false
    },
    useReducedMotion ? 400 : 950,
  )
  winTimers.push(tReleaseCta)
}

function onStripProgress(_scrollPos: number, meta: StripMeta) {
  stripMeta.value = meta
}

watch(showWinPill, (show) => {
  if (countAnimRaf) {
    cancelAnimationFrame(countAnimRaf)
    countAnimRaf = 0
  }
  if (!show) {
    displayAmount.value = 0
    return
  }
  const target = finalPayout.value
  if (useReducedMotion) {
    displayAmount.value = target
    return
  }
  const start = performance.now()
  const dur = 780 + Math.random() * 120
  function tick(now: number) {
    const u = Math.min(1, (now - start) / dur)
    const e = 1 - (1 - u) ** 3
    displayAmount.value = Math.round(target * e)
    if (u < 1) {
      countAnimRaf = requestAnimationFrame(tick)
    } else {
      displayAmount.value = target
      countAnimRaf = 0
    }
  }
  countAnimRaf = requestAnimationFrame(tick)
})

watch(winBurst, (v) => {
  if (v) {
    camSnap.value = true
    window.setTimeout(() => {
      camSnap.value = false
    }, 380)
  }
})

onBeforeUnmount(() => {
  clearWinTimers()
  if (countAnimRaf) {
    cancelAnimationFrame(countAnimRaf)
  }
})
</script>

<template>
  <!-- Hero: single “game UI” card with integrated slot window (Coin Hub main daily strip). -->
  <article
    v-if="isHero"
    :class="[
      'coinhub-spin daily-spin flex w-full min-w-0 flex-col',
      isFocalTarget && 'daily-spin--focal',
      spinAvailable && 'daily-spin--ready',
      !spinAvailable && 'daily-spin--locked',
    ]"
  >
    <div class="daily-spin__header">
      <div class="min-w-0">
        <p class="daily-spin__subtitle">
          {{ tagLabel }}
        </p>
        <h2 class="daily-spin__title">
          {{ title }}
        </h2>
        <p
          v-if="sectionDescription"
          class="daily-spin__desc"
        >
          {{ sectionDescription }}
        </p>
      </div>
      <div
        class="daily-spin__status"
        :class="!spinAvailable && 'daily-spin__status--off'"
        role="status"
      >
        <span
          v-if="showAvailabilityPulse"
          class="daily-spin__status-dot daily-spin__status-dot--pulse"
          aria-hidden="true"
        />
        <span
          v-else
          class="daily-spin__status-dot"
          :class="spinAvailable && 'daily-spin__status-dot--live'"
          aria-hidden="true"
        />
        <span class="daily-spin__status-text">{{
          spinAvailable ? stateLabelAvailable : (spinCooldownHint || t('coinHub.stateLocked'))
        }}</span>
      </div>
    </div>

    <div class="daily-spin__machine">
      <div
        :class="[
          'slot-machine',
          spinAvailable && 'slot-machine--live',
          (phase === 'rolling' || phase === 'resolving' || impactHold) && 'slot-machine--rolling',
          heroWinFrameClass,
        ]"
      >
        <div
          v-if="isHero && phase === 'result' && rewardRarity === 'legendary'"
          class="slot-machine__legendary-flash pointer-events-none"
          aria-hidden="true"
        />
        <div
          class="slot-machine__cap slot-machine__cap--left"
          aria-hidden="true"
        />
        <div
          class="slot-machine__cap slot-machine__cap--right"
          aria-hidden="true"
        />
        <div
          :class="[
            'slot daily-slot',
            spinAvailable && 'daily-slot--live',
            (phase === 'result' || winBurst) && 'daily-slot--result',
          ]"
        >
          <div
            class="daily-slot__particles"
            aria-hidden="true"
          />
          <div
            class="slot-machine__reel-assembly relative w-full min-w-0"
          >
            <div
              class="slot-pointer"
              aria-hidden="true"
            />
            <div
              :class="['coinhub-spin-stage daily-slot__stage relative w-full min-w-0', phase === 'rolling' && 'daily-slot__stage--rolling']"
            >
              <div
                v-if="winBurst || phase === 'result'"
                class="coinhub-win-vignette pointer-events-none absolute inset-[-4%] z-[25] rounded-[1.1rem] md:rounded-[1.25rem]"
                :class="winBurst && 'coinhub-win-vignette--hot'"
                aria-hidden="true"
              />
              <div
                :class="[
                  'coinhub-slot-bezel daily-slot__bezel relative z-[2] flex min-h-[120px] w-full min-w-0 items-stretch transition-[transform] duration-[220ms] ease-out will-change-transform',
                  'rounded-[20px] p-0',
                  spinAvailable && 'coinhub-slot-bezel--live',
                  cameraIn && 'coinhub-slot-cam--in',
                  camSnap && 'coinhub-slot-cam--snap',
                ]"
                role="status"
                :aria-live="phase === 'rolling' || impactHold ? 'polite' : 'off'"
              >
                <div
                  :class="[
                    'reel-window coinhub-slot-window coinhub-slot-window--fg relative z-[3] m-0 h-full min-h-[120px] w-full min-w-0 overflow-hidden rounded-2xl',
                    impactHold && 'coinhub-spin-surface--impact',
                    (phase === 'result' || winBurst) && 'coinhub-spin-surface--won',
                    winBurst && 'coinhub-spin-surface--win-burst',
                  ]"
                >
                  <div
                    class="reel-focus"
                    aria-hidden="true"
                  />
                  <div
                    class="reel-window__sweep"
                    aria-hidden="true"
                  />
                  <div
                    v-if="phase === 'rolling'"
                    class="reel-window__spin-motes"
                    :class="stripMeta.heartbeat && 'reel-window__spin-motes--hot'"
                    aria-hidden="true"
                  />
                  <div
                    :class="[
                      'coinhub-slot-heart relative z-[1] h-full min-h-[120px] w-full will-change-transform',
                      stripMeta.heartbeat && 'coinhub-slot-heart--on',
                    ]"
                  >
                    <div
                      v-if="winBurst"
                      class="coinhub-win-burst pointer-events-none absolute inset-0 z-[20]"
                      aria-hidden="true"
                    />
                    <div
                      v-if="winBurst"
                      class="coinhub-win-flash pointer-events-none absolute inset-0 z-[21] mix-blend-screen"
                      aria-hidden="true"
                    />
                    <div
                      v-if="winBurst"
                      class="coinhub-win-particles pointer-events-none absolute inset-0 z-[19]"
                      aria-hidden="true"
                    >
                      <span
                        v-for="n in 9"
                        :key="n"
                        class="coinhub-win-particle"
                        :style="{ '--ch-pa': `${n * 40}deg`, '--ch-pd': `${0.38 + (n % 4) * 0.1}` }"
                      />
                    </div>
                    <div
                      ref="spinReelFlySourceRef"
                      class="relative min-h-0 w-full"
                    >
                      <CoinHubStripRoll
                        class="daily-slot__strip"
                        :cells="rollCells"
                        :land-index="rollLand"
                        :item-width-px="stripItemW"
                        :size="stripSize"
                        :duration-ms="spinStripDurationMs"
                        :enable-idle-autoplay="stripIdleAutoplay"
                        :highlight-land-win="phase === 'result'"
                        daily-anticipation-easing
                        @progress="onStripProgress"
                        @complete="onRollComplete"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showWinPill"
      :class="[
        'coinhub-spin-win relative z-[40] flex flex-col items-center',
        isHero ? 'mt-5 coinhub-spin-win--hero' : 'mt-3',
      ]"
      role="status"
      :aria-label="wonLineAria"
    >
      <div
        :class="[
          'coinhub-reward-float group relative flex flex-col items-center gap-1.5 px-2',
          rewardPop && 'coinhub-reward-float--reveal',
        ]"
      >
        <p
          :class="[
            'coinhub-spin-win__eyebrow text-center font-extrabold uppercase text-amber-200/90',
            isHero ? 'text-[0.75rem] tracking-[0.32em] sm:text-[0.8rem]' : 'text-[0.7rem] tracking-[0.28em]',
          ]"
        >
          {{ t('coinHub.spinWinBadge') }}
        </p>
        <div
          v-if="isHero"
          :class="[
            'coinhub-reward-amount coinhub-spin-win__amount coinhub-spin-win__amount--hero-gold flex flex-col items-center tabular-nums',
            `coinhub-spin-win__amount--intensity-${rewardRarity}`,
          ]"
        >
          <div
            class="coinhub-spin-win__hero-amount flex items-baseline justify-center gap-0.5"
          >
            <span
              v-if="finalPayout > 0"
              class="coinhub-spin-win__hero-plus select-none"
              aria-hidden="true"
            >+</span>
            <span
              class="coinhub-reward-number coinhub-spin-win__hero-number"
            >{{ displayAmount }}</span>
          </div>
          <span
            class="coinhub-spin-win__hero-suffix font-semibold text-amber-200/95"
          >{{ t('coinHub.coinUnit') }}</span>
        </div>
        <div
          v-else
          :class="[
            'coinhub-reward-amount coinhub-spin-win__amount flex items-baseline justify-center gap-1.5 tabular-nums',
            `coinhub-spin-win__amount--rarity-${rewardRarity}`,
          ]"
        >
          <span
            class="coinhub-reward-number text-3xl font-black text-amber-50 sm:text-4xl"
          >{{ displayAmount }}</span>
          <span
            class="coinhub-reward-suffix text-sm font-semibold text-amber-200/90 sm:text-base"
          >{{ t('coinHub.coinUnit') }}</span>
        </div>
      </div>
    </div>

    <div class="relative mt-6 min-h-[3.5rem] w-full md:mt-7">
      <button
        type="button"
        :disabled="!spinAvailable || coinHub.spinInFlight || phase === 'resolving' || phase === 'rolling' || impactHold"
        :class="[
          'daily-spin__cta coinhub-spin-cta coinhub-spin-cta--arcade relative h-14 w-full cursor-pointer rounded-[14px] text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg',
          coinHub.spinInFlight && 'coinhub-cta--busy',
          spinAvailable && 'ch-ds-btn-purple coinhub-spin-cta--primary',
          !spinAvailable && 'bg-violet-950/80 text-slate-500',
        ]"
        @click="onSpinCta"
      >
        <template v-if="phase === 'resolving' || coinHub.spinInFlight || phase === 'rolling' || impactHold">
          {{ t('coinHub.spinningShort') }}
        </template>
        <template v-else-if="phase === 'result'">
          {{ t('coinHub.spinAgain') }}
        </template>
        <template v-else>
          {{ actionLabel }}
        </template>
        <span
          v-if="coinHub.spinInFlight"
          class="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="coinhub-spin-btn-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white/90" />
        </span>
      </button>
    </div>
  </article>

  <article
    v-else
    :class="[
      'coinhub-spin flex w-full min-w-0 flex-col',
      'coinhub-daily coinhub-daily--spin-article rounded-xl border border-violet-500/25 border-l-4 border-l-violet-500 bg-gradient-to-b from-slate-900/80 to-slate-950/95 p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]',
      isFocalTarget ? 'coinhub-daily--focal' : 'coinhub-daily--interactive',
      spinAvailable && 'coinhub-daily--spin-ready',
      !spinAvailable && 'coinhub-daily--spin-locked',
    ]"
  >
    <template v-if="!omitHeroHeading">
      <p
        class="ch-ds-text-label text-[0.65rem] font-semibold uppercase tracking-wider"
      >
        {{ tagLabel }}
      </p>

      <h3 class="mt-3 text-lg font-semibold leading-snug text-[#FFFFFF]">
        {{ title }}
      </h3>
    </template>
    <p
      v-if="sectionDescription"
      class="mt-2 text-sm text-violet-200/80"
    >
      {{ sectionDescription }}
    </p>

    <div
      :class="['flex flex-col gap-0.5', omitHeroHeading ? 'mt-0' : 'mt-2']"
    >
      <div class="flex items-center gap-2">
        <span
          v-if="showAvailabilityPulse"
          class="coinhub-daily-pulse-dot coinhub-daily-pulse-dot--violet"
          aria-hidden="true"
        />
        <p
          :class="['text-sm', isFocalTarget ? 'text-violet-200/90' : 'text-violet-400/85']"
        >
          {{ stateLabelAvailable }}
        </p>
      </div>
      <p
        v-if="spinCooldownHint"
        class="coinhub-spin-cd-timer text-xs font-semibold tabular-nums"
      >
        {{ spinCooldownHint }}
      </p>
    </div>

    <div
      class="coinhub-spin-machine mt-5 w-full"
    >
      <div
        class="coinhub-spin-stage relative w-full"
      >
        <div
          v-if="winBurst || phase === 'result'"
          class="coinhub-win-vignette pointer-events-none absolute inset-[-6%] z-[25] rounded-[1.25rem]"
          :class="winBurst && 'coinhub-win-vignette--hot'"
          aria-hidden="true"
        />
        <div
          :class="[
            'coinhub-slot-bezel relative z-[2] rounded-xl p-1.5 transition-[transform] duration-[220ms] ease-out will-change-transform',
            spinAvailable && 'coinhub-slot-bezel--live',
            cameraIn && 'coinhub-slot-cam--in',
            camSnap && 'coinhub-slot-cam--snap',
          ]"
          role="status"
          :aria-live="phase === 'rolling' || impactHold ? 'polite' : 'off'"
        >
          <div
            :class="[
              'coinhub-slot-window coinhub-slot-window--fg relative z-[3] overflow-hidden rounded-lg',
              impactHold && 'coinhub-spin-surface--impact',
              (phase === 'result' || winBurst) && 'coinhub-spin-surface--won',
              winBurst && 'coinhub-spin-surface--win-burst',
            ]"
          >
            <div
              :class="[
                'coinhub-slot-heart relative h-full w-full will-change-transform',
                stripMeta.heartbeat && 'coinhub-slot-heart--on',
              ]"
            >
              <div
                v-if="winBurst"
                class="coinhub-win-burst pointer-events-none absolute inset-0 z-[20]"
                aria-hidden="true"
              />
              <div
                v-if="winBurst"
                class="coinhub-win-flash pointer-events-none absolute inset-0 z-[21] mix-blend-screen"
                aria-hidden="true"
              />
              <div
                v-if="winBurst"
                class="coinhub-win-particles pointer-events-none absolute inset-0 z-[19]"
                aria-hidden="true"
              >
                <span
                  v-for="n in 9"
                  :key="n"
                  class="coinhub-win-particle"
                  :style="{ '--ch-pa': `${n * 40}deg`, '--ch-pd': `${0.38 + (n % 4) * 0.1}` }"
                />
              </div>
              <CoinHubStripRoll
                :cells="rollCells"
                :land-index="rollLand"
                :item-width-px="stripItemW"
                :size="stripSize"
                :duration-ms="spinStripDurationMs"
                :highlight-land-win="phase === 'result'"
                @progress="onStripProgress"
                @complete="onRollComplete"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="showWinPill"
      class="coinhub-spin-win relative z-[40] mt-3 flex flex-col items-center"
      role="status"
      :aria-label="wonLineAria"
    >
      <div
        :class="[
          'coinhub-reward-float group relative flex flex-col items-center gap-1.5 px-1',
          rewardPop && 'coinhub-reward-float--reveal',
        ]"
      >
        <p class="coinhub-spin-win__eyebrow text-center text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-amber-200/90">
          {{ t('coinHub.spinWinBadge') }}
        </p>
        <div
          :class="[
            'coinhub-reward-amount coinhub-spin-win__amount flex items-baseline justify-center gap-1.5 tabular-nums',
            `coinhub-spin-win__amount--rarity-${rewardRarity}`,
          ]"
        >
          <span
            class="coinhub-reward-number text-xl font-black text-amber-50 sm:text-2xl"
          >{{ displayAmount }}</span>
          <span
            class="coinhub-reward-suffix text-sm font-semibold text-amber-200/90 sm:text-base"
          >{{ t('coinHub.coinUnit') }}</span>
        </div>
      </div>
    </div>

    <div
      class="relative mt-5 min-h-[2.75rem] w-full"
    >
      <button
        type="button"
        :disabled="!spinAvailable || coinHub.spinInFlight || phase === 'resolving' || phase === 'rolling' || impactHold"
        :class="[
          'coinhub-spin-cta coinhub-spin-cta--arcade relative w-full cursor-pointer rounded-xl py-3.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50',
          coinHub.spinInFlight && 'coinhub-cta--busy',
          spinAvailable && 'ch-ds-btn-purple coinhub-spin-cta--primary',
          !spinAvailable && 'bg-violet-950/80 text-slate-500',
        ]"
        @click="onSpinCta"
      >
        <template v-if="phase === 'resolving' || coinHub.spinInFlight || phase === 'rolling' || impactHold">
          {{ t('coinHub.spinningShort') }}
        </template>
        <template v-else-if="phase === 'result'">
          {{ t('coinHub.spinAgain') }}
        </template>
        <template v-else>
          {{ actionLabel }}
        </template>
        <span
          v-if="coinHub.spinInFlight"
          class="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="coinhub-spin-btn-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white/90" />
        </span>
      </button>
    </div>
  </article>

  <Teleport to="body">
    <div
      v-show="isHero && spinFlyActive && spinFlyCoins.length > 0"
      class="spin-win-fly-layer"
      aria-hidden="true"
    >
      <span
        v-for="f in spinFlyCoins"
        :key="f.id"
        class="spin-win-fly-coin"
        :style="{
          left: f.x + 'px',
          top: f.y + 'px',
          animationDuration: f.duration,
          animationDelay: f.delay,
          '--ftx': f.tx + 'px',
          '--fty': f.ty + 'px',
        }"
      >🪙</span>
    </div>
  </Teleport>
</template>

<style scoped>
/* —— Coin Hub main daily spin: “slot window” card (hero) —— */
.daily-spin {
  padding: 32px;
  border-radius: 20px;
  background:
    radial-gradient(circle at 50% 0%, rgba(120, 60, 255, 0.25), transparent 60%),
    linear-gradient(180deg, #0b0f2a, #070a1f);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.6),
    inset 0 0 60px rgba(120, 60, 255, 0.08);
  transition:
    box-shadow 0.22s ease,
    border-color 0.22s ease,
    transform 0.18s ease;
}
/* .daily-spin--focal {
  box-shadow:
    0 0 0 1px rgba(100, 80, 160, 0.35),
    0 20px 60px rgba(0, 0, 0, 0.6),
    inset 0 0 60px rgba(120, 60, 255, 0.1);
} */
.daily-spin--ready:hover {
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.62),
    inset 0 0 72px rgba(120, 60, 255, 0.1);
}
.daily-spin--locked {
  opacity: 0.9;
}
.daily-spin__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}
.daily-spin__subtitle {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgb(148 163 184 / 0.95);
}
.daily-spin__title {
  margin: 0.35rem 0 0;
  font-size: clamp(1.25rem, 2.8vw, 1.65rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.02em;
  background: linear-gradient(90deg, #fff 0%, #d4b4ff 48%, #b99cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 14px rgba(150, 90, 255, 0.22));
}
.daily-spin__desc {
  margin: 0.5rem 0 0;
  max-width: 36rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: rgb(186 198 220 / 0.88);
}
.daily-spin__status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 12, 28, 0.65);
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(196 181 253 / 0.95);
  flex-shrink: 0;
}
.daily-spin__status--off {
  color: rgb(148 163 184 / 0.85);
  border-color: rgba(255, 255, 255, 0.05);
}
.daily-spin__status-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 9999px;
  background: rgb(100 116 139 / 0.85);
  flex-shrink: 0;
}
.daily-spin__status-dot--live {
  background: rgb(52 211 153 / 0.9);
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.45);
}
.daily-spin__status-dot--pulse {
  background: rgb(167 139 250 / 0.95) !important;
  box-shadow: 0 0 0 0 rgb(124 58 246 / 0.4) !important;
  animation: daily-spin-pulse-violet 2.2s ease-in-out infinite;
}
.daily-spin__status-text {
  max-width: 12rem;
  text-align: end;
  line-height: 1.25;
}
@media (min-width: 480px) {
  .daily-spin__status-text {
    max-width: none;
  }
}
.daily-spin__machine {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

/* Physical “capsule” shell: layered device body; `.reel-window` = glass inside. */
.slot-machine {
  position: relative;
  z-index: 0;
  width: 100%;
  max-width: 64rem;
  padding: 1.5rem 1.5rem 1.5rem;
  border-radius: 1.75rem;
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.08);
  /* Depth: speckle + existing noise + purple rim + dark base (no new hues). */
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.28'/%3E%3C/svg%3E")
      repeat,
    radial-gradient(circle at 50% 0%, rgba(120, 0, 255, 0.2), transparent 60%),
    linear-gradient(180deg, #0c0820 0%, #050310 100%);
  background-size:
    80px 80px,
    160px 160px,
    auto,
    auto;
  background-blend-mode: normal, soft-light, normal, normal;
  box-shadow:
    inset 0 0 40px rgba(255, 255, 255, 0.035),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 0 60px rgba(120, 0, 255, 0.22),
    0 16px 48px rgba(0, 0, 0, 0.55);
  transition: box-shadow 0.32s ease, filter 0.28s ease;
}
.slot-machine--live:hover {
  box-shadow:
    inset 0 0 44px rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 72px rgba(150, 60, 255, 0.28),
    0 0 36px rgba(200, 140, 255, 0.12),
    0 14px 42px rgba(0, 0, 0, 0.48);
  filter: brightness(1.04);
}
.slot-machine--rolling {
  box-shadow:
    inset 0 0 48px rgba(255, 255, 255, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    0 0 88px rgba(160, 80, 255, 0.32),
    0 0 44px rgba(255, 200, 100, 0.14),
    0 12px 40px rgba(0, 0, 0, 0.5);
  filter: brightness(1.05);
}

.slot-machine::before {
  content: '';
  position: absolute;
  inset: -3px;
  z-index: -1;
  border-radius: 1.85rem;
  background: linear-gradient(
    125deg,
    rgba(90, 40, 180, 0.55) 0%,
    rgba(40, 20, 90, 0.7) 45%,
    rgba(255, 190, 90, 0.22) 100%
  );
  filter: blur(22px);
  opacity: 0.38;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .slot-machine--win-gold {
    animation: ch-slot-win-gold-pop 0.72s cubic-bezier(0.34, 1.15, 0.2, 1) both;
  }
  .slot-machine--win-gold--mid {
    animation: ch-slot-win-gold-pop 0.78s cubic-bezier(0.34, 1.15, 0.2, 1) both;
  }
  .slot-machine--win-gold--intense {
    animation: ch-slot-win-gold-pop-strong 0.88s cubic-bezier(0.34, 1.2, 0.2, 1) both;
  }
}
@keyframes ch-slot-win-gold-pop {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  45% {
    transform: scale(1.02);
    filter: brightness(1.05);
  }
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}
@keyframes ch-slot-win-gold-pop-strong {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  35% {
    transform: scale(1.035);
    filter: brightness(1.08);
  }
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}

.slot-machine__legendary-flash {
  position: absolute;
  inset: -4%;
  z-index: 4;
  border-radius: 1.5rem;
  background: radial-gradient(ellipse 90% 80% at 50% 45%, rgba(255, 220, 100, 0.35) 0%, transparent 65%);
  mix-blend-mode: screen;
  animation: ch-legendary-flash-fade 1.1s ease-out both;
  pointer-events: none;
}
@keyframes ch-legendary-flash-fade {
  0% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
  }
}

.slot-machine__cap {
  position: absolute;
  top: 50%;
  z-index: 0;
  width: 1.1rem;
  max-width: 5vw;
  height: 58%;
  min-height: 3.4rem;
  border-radius: 12px;
  transform: translateY(-50%);
  background: linear-gradient(
    180deg,
    rgba(160, 100, 255, 0.45) 0%,
    rgba(90, 30, 200, 0.55) 40%,
    rgba(20, 6, 55, 0.95) 100%
  );
  box-shadow:
    0 0 18px rgba(150, 80, 255, 0.4),
    0 0 8px rgba(200, 120, 255, 0.2),
    inset 0 2px 8px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(200, 160, 255, 0.25);
  pointer-events: none;
}
.slot-machine__cap--left {
  left: 0.35rem;
}
.slot-machine__cap--right {
  right: 0.35rem;
}
@media (min-width: 640px) {
  .slot-machine__cap {
    width: 1.25rem;
  }
}

@media (max-width: 480px) {
  .slot-machine {
    padding: 1.1rem 0.9rem 1.2rem;
  }
  .slot-machine__cap--left {
    left: 0.2rem;
  }
  .slot-machine__cap--right {
    right: 0.2rem;
  }
}

.slot-machine__reel-assembly {
  position: relative;
  z-index: 2;
  /* padding-top: 0.35rem; */
}

.daily-slot {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 120px;
  border-radius: 120px;
  overflow: visible;
  background: transparent;
  box-shadow: none;
  transition: filter 0.25s ease;
}
.daily-slot--result {
  filter: none;
}
.daily-slot__particles {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.1;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.45) 0, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(200, 160, 255, 0.4) 0, transparent 35%),
    radial-gradient(circle at 50% 50%, rgba(255, 200, 100, 0.12) 0, transparent 50%);
  mix-blend-mode: screen;
  will-change: opacity, transform;
}
@media (prefers-reduced-motion: no-preference) {
  .daily-slot__particles {
    animation: ch-slot-ambient-drift 32s ease-in-out infinite;
  }
}
@keyframes ch-slot-ambient-drift {
  0%,
  100% {
    opacity: 0.09;
    transform: translate3d(0, 0, 0) scale(1);
  }
  33% {
    opacity: 0.12;
    transform: translate3d(1.5%, -0.6%, 0) scale(1.01);
  }
  66% {
    opacity: 0.1;
    transform: translate3d(-0.8%, 0.4%, 0) scale(1.005);
  }
}
.daily-slot__stage {
  position: relative;
  z-index: 1;
  height: 100%;
  min-width: 0;
}
.daily-slot__bezel {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
}
.daily-slot__strip {
  min-height: 120px;
  height: 100%;
  width: 100%;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.daily-slot :deep(.coinhub-strip-roll__row) {
  height: 100%;
  min-height: 120px;
  align-items: center;
  will-change: transform;
}
.daily-slot :deep(.coinhub-strip-roll) {
  min-height: 120px;
}
.daily-slot :deep(.coinhub-strip-roll--lg) {
  min-height: 120px;
}
.daily-slot :deep(.coinhub-strip-roll__cell) {
  width: 90px;
  min-width: 90px;
  max-width: 90px;
  height: 90px;
  min-height: 90px;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.1), transparent 52%),
    linear-gradient(180deg, #1a0f3a, #0a061f) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  box-shadow:
    inset 0 0 10px rgba(255, 255, 255, 0.05),
    inset 0 -2px 12px rgba(0, 0, 0, 0.45),
    0 6px 20px rgba(0, 0, 0, 0.55) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgba(15, 23, 42, 0.45) !important;
}
/* Rarity = gold intensity only (no multicolor frames). */
.daily-slot :deep(.coinhub-strip-roll__cell--rarity-uncommon) {
  border: 1px solid rgba(255, 200, 120, 0.22) !important;
  box-shadow:
    0 0 12px rgba(255, 190, 80, 0.18),
    inset 0 0 6px rgba(255, 200, 100, 0.06) !important;
}
.daily-slot :deep(.coinhub-strip-roll__cell--rarity-rare) {
  border: 1px solid rgba(255, 200, 120, 0.38) !important;
  box-shadow:
    0 0 16px rgba(255, 195, 90, 0.28),
    inset 0 0 6px rgba(255, 210, 120, 0.08) !important;
}
.daily-slot :deep(.coinhub-strip-roll__cell--rarity-epic) {
  border: 1px solid rgba(255, 210, 130, 0.52) !important;
  box-shadow:
    0 0 22px rgba(255, 200, 80, 0.42),
    inset 0 0 8px rgba(255, 220, 140, 0.1) !important;
}
.daily-slot :deep(.coinhub-strip-roll__cell--rarity-legendary:not(.coinhub-strip-roll__cell--land)) {
  border: 1px solid rgba(255, 220, 150, 0.65) !important;
  box-shadow:
    0 0 28px rgba(255, 200, 100, 0.55),
    0 0 44px rgba(255, 190, 70, 0.22) !important;
}
.daily-slot :deep(.coinhub-strip-roll__cell--land) {
  z-index: 2;
  background:
    radial-gradient(circle at 35% 32%, rgba(255, 255, 255, 0.12), transparent 50%),
    radial-gradient(circle, rgba(255, 200, 100, 0.2), transparent 58%),
    linear-gradient(180deg, #221a4a, #0e0a24) !important;
}
.daily-slot--result :deep(.coinhub-strip-roll__cell--land) {
  transform: scale(1.05) !important;
  box-shadow:
    0 0 25px rgba(255, 200, 80, 0.6),
    0 0 40px rgba(255, 200, 80, 0.28),
    inset 0 0 10px rgba(255, 255, 255, 0.35) !important;
  filter: none !important;
  opacity: 1 !important;
}
.daily-slot--result :deep(.coinhub-strip-roll__cell--land.coinhub-strip-roll__cell--rarity-legendary) {
  border: 1px solid rgba(255, 230, 170, 0.95) !important;
  box-shadow:
    0 0 32px rgba(255, 210, 110, 0.95),
    0 0 72px rgba(255, 200, 80, 0.42) !important;
}
.daily-slot--result :deep(.coinhub-strip-roll__cell--land.coinhub-strip-roll__cell--rarity-epic) {
  border: 1px solid rgba(255, 215, 150, 0.85) !important;
  box-shadow:
    0 0 28px rgba(255, 200, 90, 0.72),
    0 0 52px rgba(255, 195, 80, 0.3) !important;
}
.daily-slot--result :deep(.coinhub-strip-roll__cell--land.coinhub-strip-roll__cell--rarity-rare) {
  border: 1px solid rgba(255, 205, 130, 0.8) !important;
  box-shadow:
    0 0 24px rgba(255, 195, 85, 0.58),
    0 0 44px rgba(255, 185, 70, 0.22) !important;
}
.daily-slot :deep(.coinhub-strip-roll__chip) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  min-height: 2.5rem;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
  font-size: 0.7rem;
  line-height: 1;
  background: radial-gradient(circle, #ffd86b, #ffb300) !important;
  -webkit-background-clip: border-box;
  background-clip: border-box;
  color: #3b2508 !important;
  border: none !important;
  box-shadow:
    0 0 15px rgba(255, 200, 80, 0.7),
    inset 0 0 6px rgba(255, 255, 255, 0.4) !important;
  filter: none !important;
}
.daily-slot :deep(.coinhub-strip-roll__chip--gold) {
  color: #3b2508 !important;
  -webkit-text-fill-color: #3b2508;
}
.daily-slot :deep(.coinhub-strip-roll__fog) {
  opacity: 0.45;
}

/* Glass: top shine (::before) + side fade (::after); row + sweep sit under / between overlays. */
.reel-window {
  isolation: isolate;
  perspective: 900px;
  transform-style: preserve-3d;
  background: linear-gradient(180deg, rgba(18, 10, 48, 0.65) 0%, rgba(4, 2, 18, 0.94) 100%);
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.8),
    inset 0 0 12px rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.reel-window::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.12) 22%, transparent 48%);
  opacity: 0.08;
  mix-blend-mode: soft-light;
  pointer-events: none;
}
.reel-window::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  background: linear-gradient(
    to right,
    rgba(10, 5, 30, 1) 0%,
    transparent 15%,
    transparent 85%,
    rgba(10, 5, 30, 1) 100%
  );
  pointer-events: none;
}
.reel-window__sweep {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  background-size: 45% 100%;
  background-position: 0% 0%;
  background-repeat: no-repeat;
  mix-blend-mode: soft-light;
}
.reel-window__spin-motes {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(ellipse 55% 45% at 50% 48%, rgba(255, 255, 255, 0.09) 0%, transparent 68%);
  opacity: 0;
  mix-blend-mode: soft-light;
}
.reel-focus {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 0;
  width: 8.75rem;
  max-width: 42%;
  transform: translateX(-50%);
  background: radial-gradient(
    circle at 50% 45%,
    rgba(255, 200, 80, 0.28) 0%,
    rgba(255, 200, 80, 0.08) 42%,
    transparent 70%
  );
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .reel-window__sweep {
    animation: ch-reel-light-sweep 4.2s ease-in-out infinite;
  }
  .reel-window__spin-motes {
    animation: ch-reel-tick-pulse 0.52s ease-in-out infinite;
  }
  .reel-window__spin-motes--hot {
    animation: ch-reel-tick-pulse 0.32s ease-in-out infinite;
  }
  .daily-slot--live:not(.daily-slot--result) :deep(.coinhub-strip-roll__cell--land) {
    animation: ch-reel-land-breathe 1.7s ease-in-out infinite;
  }
  .daily-slot--result :deep(.coinhub-strip-roll__cell--land) {
    animation: ch-reel-land-breathe-win 1.45s ease-in-out infinite;
  }
  .daily-slot__stage--rolling :deep(.coinhub-strip-roll__cell--land) {
    animation: none !important;
  }
  .daily-slot :deep(.coinhub-strip-roll) {
    transform: rotateX(2.2deg);
    transform-origin: 50% 50%;
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }
}
@keyframes ch-reel-light-sweep {
  0% {
    background-position: -15% 0;
    opacity: 0;
  }
  40% {
    opacity: 0.38;
  }
  100% {
    background-position: 125% 0;
    opacity: 0;
  }
}
@keyframes ch-reel-tick-pulse {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 0.2;
  }
}
@keyframes ch-reel-land-breathe {
  0%,
  100% {
    filter: brightness(1) saturate(1);
  }
  50% {
    filter: brightness(1.05) saturate(1.04);
  }
}
@keyframes ch-reel-land-breathe-win {
  0%,
  100% {
    filter: brightness(1) drop-shadow(0 0 10px rgba(255, 200, 80, 0.35));
  }
  50% {
    filter: brightness(1.06) drop-shadow(0 0 20px rgba(255, 200, 80, 0.55));
  }
}

/* Tip points down into the window. */
.slot-pointer {
  position: absolute;
  top: 0.15rem;
  left: 50%;
  z-index: 36;
  transform: translate3d(-50%, -100%, 0);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 16px solid #e8b24a;
  filter: drop-shadow(0 0 10px rgba(255, 210, 90, 0.95)) drop-shadow(0 0 4px rgba(255, 220, 140, 0.6));
  pointer-events: none;
}
@media (prefers-reduced-motion: no-preference) {
  .slot-pointer {
    animation: ch-slot-pointer-breathe 2.8s ease-in-out infinite;
  }
}
@keyframes ch-slot-pointer-breathe {
  0%,
  100% {
    filter: drop-shadow(0 0 10px rgba(255, 210, 90, 0.85)) drop-shadow(0 0 3px rgba(255, 220, 140, 0.45));
  }
  50% {
    filter: drop-shadow(0 0 14px rgba(255, 220, 120, 1)) drop-shadow(0 0 6px rgba(255, 200, 80, 0.65));
  }
}

.daily-slot :deep(.coinhub-strip-roll__marker),
.daily-slot :deep(.coinhub-strip-roll__marker-cap) {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}
.daily-spin__cta {
  background: linear-gradient(90deg, #7b3ff2, #a855f7) !important;
  box-shadow: 0 10px 30px rgba(140, 70, 255, 0.4) !important;
  transition: transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
.daily-spin__cta:enabled:hover {
  filter: brightness(1.05);
  box-shadow: 0 12px 36px rgba(150, 80, 255, 0.45) !important;
}
.daily-spin__cta:enabled:active {
  transform: scale(0.96) !important;
  box-shadow: 0 6px 20px rgba(100, 50, 200, 0.45) !important;
}
@keyframes daily-spin-pulse-violet {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(124 58 246 / 0.4);
    opacity: 0.75;
  }
  50% {
    box-shadow: 0 0 0 6px rgb(124 58 246 / 0.1);
    opacity: 1;
  }
}
@media (max-width: 480px) {
  .daily-spin {
    padding: 1.25rem 1.1rem 1.5rem;
  }
}

.coinhub-spin-machine--hero {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  max-width: 64rem;
  margin-left: auto;
  margin-right: auto;
  gap: 0;
  border-radius: 9999px;
  padding: 0.2rem 0.15rem;
  background: linear-gradient(180deg, rgba(18, 16, 28, 0.95) 0%, rgba(4, 3, 10, 0.98) 100%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55) inset, 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 8px 28px -10px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(60, 50, 90, 0.45);
}
.coinhub-spin-machine--hero .coinhub-spin-stage {
  flex: 1;
  min-width: 0;
  border-radius: 9999px;
  margin: 0 0.1rem;
}
.coinhub-spin-machine__cap {
  flex: 0 0 0.9rem;
  min-height: 4.5rem;
  align-self: center;
  border-radius: 0.4rem;
  background: linear-gradient(180deg, #2a1f45 0%, #120a1e 100%);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.45), 0 0 12px -2px rgba(124, 58, 246, 0.35);
  border: 1px solid rgba(100, 80, 160, 0.35);
}
@media (min-width: 640px) {
  .coinhub-spin-machine__cap {
    flex-basis: 1.1rem;
    min-height: 5.5rem;
  }
}
.coinhub-win-vignette {
  background: radial-gradient(ellipse 100% 90% at 50% 50%, transparent 35%, rgba(0, 0, 0, 0.38) 100%);
  opacity: 0.32;
  transition: opacity 0.3s ease;
  mix-blend-mode: multiply;
}
.coinhub-win-vignette--hot {
  opacity: 0.55;
  background: radial-gradient(ellipse 98% 88% at 50% 48%, transparent 30%, rgba(0, 0, 0, 0.58) 100%);
}
.coinhub-slot-cam--in {
  transform: scale(1.03);
  transform-origin: 50% 48%;
}
.coinhub-slot-cam--snap {
  transform: scale(1);
  transform-origin: 50% 48%;
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.34, 1.4, 0.2, 1);
}
.coinhub-slot-heart--on {
  animation: ch-slot-heartbeat 0.5s ease-in-out infinite;
  transform-origin: 50% 50%;
}
@keyframes ch-slot-heartbeat {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}
.coinhub-win-particles {
  pointer-events: none;
}
.coinhub-win-particle {
  position: absolute;
  left: 50%;
  top: 48%;
  width: 3px;
  height: 3px;
  margin-left: -1.5px;
  margin-top: -1.5px;
  border-radius: 9999px;
  background: linear-gradient(180deg, #fff8e0 0%, #ffb800 100%);
  box-shadow: 0 0 0 1px rgba(255, 220, 120, 0.35);
  transform: rotate(var(--ch-pa, 0deg)) translate3d(0, -4px, 0) scale(0.75);
  opacity: 0.9;
  animation: ch-win-p-burst 0.6s cubic-bezier(0.1, 0.6, 0.1, 1) forwards;
}
@keyframes ch-win-p-burst {
  to {
    transform: rotate(var(--ch-pa, 0deg)) translate3d(0, calc(-110px * var(--ch-pd, 0.5)), 0) scale(0.15);
    opacity: 0;
  }
}
.coinhub-reward-float--reveal {
  animation: ch-reward-float-up 0.9s cubic-bezier(0.18, 0.82, 0.2, 1) both;
}
@media (prefers-reduced-motion: no-preference) {
  .coinhub-reward-float--reveal .coinhub-spin-win__amount--hero-gold {
    animation: ch-hero-win-pop 0.55s cubic-bezier(0.34, 1.2, 0.2, 1) both;
  }
}
@keyframes ch-hero-win-pop {
  0% {
    transform: scale(0.86);
    opacity: 0;
  }
  55% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.coinhub-spin-win {
  animation: ch-spin-win-enter 0.42s cubic-bezier(0.15, 0.85, 0.3, 1) both;
}
.coinhub-spin-win__eyebrow {
  text-shadow: 0 0 18px rgba(250, 220, 140, 0.3);
}
.coinhub-spin-win__amount--rarity-common .coinhub-reward-number {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.65));
}
/* Compact strip win: same gold system, strength scales with tier. */
.coinhub-spin-win__amount--rarity-uncommon .coinhub-reward-number {
  filter: drop-shadow(0 0 6px rgba(255, 200, 100, 0.35)) drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6));
}
.coinhub-spin-win__amount--rarity-rare .coinhub-reward-number {
  filter: drop-shadow(0 0 8px rgba(255, 200, 90, 0.45)) drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6));
}
.coinhub-spin-win__amount--rarity-epic .coinhub-reward-number {
  filter: drop-shadow(0 0 10px rgba(255, 200, 80, 0.52)) drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6));
}
.coinhub-spin-win__amount--rarity-legendary .coinhub-reward-number {
  filter: drop-shadow(0 0 14px rgba(255, 210, 100, 0.6)) drop-shadow(0 1px 0 rgba(0, 0, 0, 0.55));
  animation: ch-gold-sheen 2.2s ease-in-out infinite;
}
.coinhub-spin-win__hero-amount {
  line-height: 0.95;
}
.coinhub-spin-win__hero-plus {
  font-size: clamp(2.4rem, 7vw, 3.75rem);
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(180deg, #fff, #ffd76a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 16px rgba(255, 200, 80, 0.35));
}
.coinhub-spin-win__hero-number {
  font-size: clamp(2.9rem, 9vw, 4.5rem);
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(180deg, #ffffff 0%, #fff2c2 35%, #ffd76a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ch-hero-win-pulse 1.6s ease-in-out infinite;
}
.coinhub-spin-win__hero-number::after {
  display: none;
}
.coinhub-spin-win__amount--intensity-common .coinhub-spin-win__hero-number {
  filter:
    drop-shadow(0 0 12px rgba(255, 200, 90, 0.35))
    drop-shadow(0 0 32px rgba(255, 195, 80, 0.12));
}
.coinhub-spin-win__amount--intensity-uncommon .coinhub-spin-win__hero-number {
  filter:
    drop-shadow(0 0 16px rgba(255, 200, 100, 0.42))
    drop-shadow(0 0 40px rgba(255, 195, 90, 0.16));
}
.coinhub-spin-win__amount--intensity-rare .coinhub-spin-win__hero-number {
  filter:
    drop-shadow(0 0 18px rgba(255, 200, 90, 0.48))
    drop-shadow(0 0 44px rgba(255, 195, 85, 0.18));
}
.coinhub-spin-win__amount--intensity-epic .coinhub-spin-win__hero-number {
  filter:
    drop-shadow(0 0 22px rgba(255, 210, 100, 0.55))
    drop-shadow(0 0 56px rgba(255, 200, 80, 0.22));
}
.coinhub-spin-win__amount--intensity-legendary .coinhub-spin-win__hero-number {
  filter:
    drop-shadow(0 0 26px rgba(255, 220, 120, 0.62))
    drop-shadow(0 0 64px rgba(255, 200, 80, 0.28));
}
.coinhub-spin-win__hero-suffix {
  font-size: clamp(0.95rem, 2.8vw, 1.15rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.95;
}
@keyframes ch-hero-win-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}
@keyframes ch-spin-win-enter {
  0% {
    transform: translate3d(0, 10px, 0) scale(0.92);
    opacity: 0.5;
    filter: blur(5px);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
    filter: blur(0);
  }
}
.coinhub-reward-badge {
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.12) inset, 0 -1px 3px rgba(0, 0, 0, 0.35) inset;
}
.coinhub-reward-number {
  position: relative;
  z-index: 0;
  background: linear-gradient(180deg, #ffd700 0%, #ffb800 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6));
  animation: ch-gold-sheen 2.8s ease-in-out infinite;
}
.coinhub-reward-number::after {
  content: '';
  position: absolute;
  inset: -0.1em -0.15em;
  border-radius: 0.2rem;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.12'/%3E%3C/svg%3E");
  background-size: 48px 48px;
  mix-blend-mode: soft-light;
  pointer-events: none;
  z-index: -1;
  opacity: 0.32;
  animation: ch-gold-sheen-noise 2.8s ease-in-out infinite;
}
@keyframes ch-gold-sheen {
  0%,
  100% {
    filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6)) brightness(1);
  }
  50% {
    filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6)) brightness(1.04);
  }
}
@keyframes ch-gold-sheen-noise {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.4;
  }
}
@keyframes ch-reward-float-up {
  0% {
    transform: translate3d(0, 16px, 0) scale(0.9);
    filter: blur(10px);
    opacity: 0.4;
  }
  40% {
    transform: translate3d(0, -6px, 0) scale(1.05);
    filter: blur(0);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, -10px, 0) scale(1);
    filter: blur(0);
    opacity: 1;
  }
}
.coinhub-slot-bezel {
  background: linear-gradient(180deg, rgb(6 6 10) 0%, rgb(2 2 6) 100%);
  box-shadow: inset 0 3px 16px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(28, 30, 40, 0.95);
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.coinhub-slot-bezel--live {
  border-color: rgba(55, 50, 65, 0.95);
  box-shadow:
    inset 0 3px 18px rgba(0, 0, 0, 0.78),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 0 1px rgba(255, 200, 100, 0.1);
}
.coinhub-slot-window {
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5);
}
.coinhub-daily--spin-ready {
  border-color: rgba(65, 60, 85, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 28px -12px rgba(0, 0, 0, 0.55);
}
.coinhub-daily--spin-ready.coinhub-daily--focal,
.coinhub-daily--spin-ready.coinhub-daily--interactive {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 32px -10px rgba(0, 0, 0, 0.55);
}
.coinhub-daily--interactive,
.coinhub-daily--focal {
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
}
.coinhub-daily--focal {
  box-shadow: 0 0 0 1px rgba(55, 50, 70, 0.45), 0 6px 20px -6px rgba(0, 0, 0, 0.5);
}
.coinhub-daily--interactive:hover,
.coinhub-daily--focal:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -4px rgba(0, 0, 0, 0.45);
}
.coinhub-daily--focal:hover {
  box-shadow: 0 0 0 1px rgba(60, 55, 75, 0.5), 0 8px 22px -4px rgba(0, 0, 0, 0.5);
}
.coinhub-daily--spin-ready.coinhub-daily--interactive:hover,
.coinhub-daily--spin-ready.coinhub-daily--focal:hover {
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.5);
}

.coinhub-daily-pulse-dot--violet {
  background: rgb(167 139 250 / 0.9) !important;
  box-shadow: 0 0 0 0 rgb(124 58 246 / 0.45) !important;
  animation: coinhub-daily-pulse-violet 2.2s ease-in-out infinite;
}
@keyframes coinhub-daily-pulse-violet {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(124 58 246 / 0.4);
    opacity: 0.75;
  }
  50% {
    box-shadow: 0 0 0 6px rgb(124 58 246 / 0.12);
    opacity: 1;
  }
}
.coinhub-daily--spin-locked {
  opacity: 0.88;
}
.coinhub-daily--spin-locked.coinhub-daily--interactive:hover,
.coinhub-daily--spin-locked.coinhub-daily--focal:hover {
  transform: none;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
}
.coinhub-daily--spin-locked.coinhub-daily--focal {
  box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.2), 0 6px 20px -6px rgba(0, 0, 0, 0.5);
}
.coinhub-spin-cd-timer {
  color: rgb(180 170 200);
}

.coinhub-spin-cta {
  transition: transform 0.12s ease, box-shadow 0.14s ease, background 0.14s ease, filter 0.14s ease;
}
.coinhub-spin-cta--arcade:enabled {
  backface-visibility: hidden;
  transform: translate3d(0, 0, 0);
}
.coinhub-spin-cta--arcade.ch-ds-btn-purple:enabled:hover {
  transform: translate3d(0, -2px, 0);
  filter: brightness(1.1);
  box-shadow: 0 0 26px rgba(124, 58, 237, 0.75);
}
.coinhub-spin-cta--arcade:enabled:hover:not(.ch-ds-btn-purple) {
  transform: translate3d(0, -2px, 0);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.14) inset,
    0 4px 0 rgba(0, 0, 0, 0.2) inset,
    0 8px 18px -2px rgba(0, 0, 0, 0.5);
}
.coinhub-spin-cta--primary:enabled {
  color: #fff;
}
.coinhub-spin-cta--arcade:active:enabled {
  transform: translate3d(0, 1px, 0) scale(0.97) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45) inset, 0 1px 0 rgba(0, 0, 0, 0.25) inset;
}
.coinhub-cta:active:enabled {
  transform: translate3d(0, 1px, 0) scale(0.97);
}
.coinhub-win-burst {
  background: radial-gradient(ellipse 65% 75% at 50% 48%, rgba(255, 210, 120, 0.28) 0%, transparent 65%);
  animation: ch-win-burst 0.5s ease-out both;
  mix-blend-mode: screen;
}
.coinhub-win-flash {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 55%);
  animation: ch-win-flash 0.38s ease-out both;
  opacity: 0;
}
@keyframes ch-win-burst {
  0% {
    opacity: 0.15;
    transform: scale(0.6);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.15);
  }
}
@keyframes ch-win-flash {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 0.65;
  }
  100% {
    opacity: 0;
  }
}
.coinhub-spin-surface--win-burst {
  animation: ch-slot-land-quake 0.4s ease-out;
}
@keyframes ch-slot-land-quake {
  0% {
    box-shadow: inset 0 0 0 1px rgba(255, 200, 90, 0.15);
  }
  35% {
    box-shadow: inset 0 0 0 1px rgba(255, 200, 90, 0.35), inset 0 0 20px -4px rgba(255, 200, 90, 0.12);
  }
  100% {
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
  }
}
.coinhub-cta--busy {
  opacity: 0.88;
}
.coinhub-spin-btn-spinner {
  animation: coinhub-spin-btn 0.65s linear infinite;
}
@keyframes coinhub-spin-btn {
  to {
    transform: rotate(360deg);
  }
}

.coinhub-daily-pulse-dot {
  width: 0.4rem;
  height: 0.4rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background: rgb(52 211 153 / 0.85);
  box-shadow: 0 0 0 0 rgb(52 211 153 / 0.4);
  animation: coinhub-daily-pulse 2.2s ease-in-out infinite;
}

@keyframes coinhub-daily-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(52 211 153 / 0.35);
    opacity: 0.7;
  }
  50% {
    box-shadow: 0 0 0 6px rgb(52 211 153 / 0.08);
    opacity: 1;
  }
}

/* Win celebration: coins to balance (same stack order as premium modal fly). */
.spin-win-fly-layer {
  position: fixed;
  inset: 0;
  z-index: 10070;
  pointer-events: none;
}

.spin-win-fly-coin {
  position: fixed;
  margin-left: -10px;
  margin-top: -10px;
  font-size: 1.2rem;
  line-height: 1;
  will-change: transform, opacity, filter;
  filter:
    drop-shadow(0 0 4px rgba(255, 210, 100, 0.85))
    drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
  animation-name: spin-win-fly-to-balance;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  animation-fill-mode: forwards;
}

@keyframes spin-win-fly-to-balance {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translate3d(var(--ftx, 0), var(--fty, 0), 0) scale(0.55);
    opacity: 0;
  }
}

.coinhub-spin-surface--impact {
  animation: coinhub-spin-whomp 0.22s ease-out;
}

.coinhub-spin-surface--won {
  box-shadow: inset 0 0 0 1px rgba(255, 200, 100, 0.25), inset 0 0 16px -6px rgba(0, 0, 0, 0.5);
  border-radius: 0.5rem;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}

@keyframes coinhub-spin-whomp {
  0% {
    transform: scale(0.98);
  }
  50% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .coinhub-slot-heart--on {
    animation: none !important;
  }
  .coinhub-slot-cam--in {
    transform: none !important;
  }
  .coinhub-reward-number,
  .coinhub-reward-badge {
    animation: none !important;
  }
  .coinhub-win-particle {
    animation: none !important;
    opacity: 0;
  }
  .daily-spin--ready:hover,
  .daily-slot--live:hover {
    filter: none !important;
  }
  .daily-slot--live:hover {
    box-shadow:
      inset 0 0 40px rgba(0, 0, 0, 0.8),
      0 0 30px rgba(140, 70, 255, 0.25) !important;
  }
  .daily-spin__status-dot--pulse {
    animation: none !important;
  }
  .coinhub-spin-win {
    animation: none !important;
  }
  .coinhub-spin-win__amount--rarity-legendary .coinhub-reward-number {
    animation: none !important;
  }
  .coinhub-spin-win__hero-number {
    animation: none !important;
  }
  .reel-window__sweep,
  .reel-window__spin-motes {
    animation: none !important;
  }
  .reel-window__spin-motes {
    opacity: 0 !important;
  }
  .daily-slot--live :deep(.coinhub-strip-roll__cell--land),
  .daily-slot--result :deep(.coinhub-strip-roll__cell--land) {
    animation: none !important;
  }
  .daily-slot :deep(.coinhub-strip-roll) {
    transform: none !important;
  }
  .coinhub-reward-float--reveal .coinhub-spin-win__amount--hero-gold {
    animation: none !important;
  }
}
</style>
