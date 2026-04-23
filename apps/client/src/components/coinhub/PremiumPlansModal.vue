<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCoinHubStore } from '@/stores/coinHub'
import { playCoinCollect, playUiClick } from '@/utils/coinHub/coinHubAudioStub'
import { premiumMonthlyCoins } from '@/utils/coinHub/coinHubPremiumRewards'
import PricingPlanCard from '@/components/coinhub/PricingPlanCard.vue'
import '@/styles/coinhub-design-system.css'

type PlanId = 'basic' | 'plus' | 'pro'

type FakePhase = 'idle' | 'purchasing' | 'success'

/** After purchase: celebration overlay stacks above modal; modal fades out underneath. */
type UxPhase = 'modal' | 'celebration'

type BalanceSpot = {
  /** Viewport center of #coinhub-balance-fly-target (px). */
  cx: number
  cy: number
  w: number
  h: number
}

type FlyCoin = {
  id: string
  x: number
  y: number
  tx: number
  ty: number
  delay: string
  duration: string
}

const FAKE_PURCHASE_MS = 1200
const MODAL_FADE_OUT_MS = 600
const CELEBRATION_FLY_DELAY_MS = 450
const FLY_COIN_COUNT = 20
const FLY_STAGGER_MS = 40
/** Longest coin: start delay (n-1)*stagger + ~max duration (~1s). */
const FLY_TO_BALANCE_MS = 900 + (FLY_COIN_COUNT - 1) * FLY_STAGGER_MS + 200
const POST_FLY_HOLD_MS = 1800
const CELEBRATION_OVERLAY_FADE_OUT_MS = 520

const props = withDefaults(
  defineProps<{
    open: boolean
  }>(),
  { open: false },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
  close: []
  selectPlan: [id: PlanId]
}>()

const { t } = useI18n()
const coinHub = useCoinHubStore()
const { premiumCelebrationHeroLift } = storeToRefs(coinHub)

const planOrder: PlanId[] = ['basic', 'plus', 'pro']

const fakePhase = ref<FakePhase>('idle')
const targetPlan = ref<PlanId | null>(null)
const uxPhase = ref<UxPhase>('modal')
/** While true, modal teleport stays mounted under celebration overlay (fades with --exit). */
const modalShellDuringCelebration = ref(false)
const celebrationExiting = ref(false)
const celebrationFlySourceRef = ref<HTMLElement | null>(null)
const balanceSpot = ref<BalanceSpot | null>(null)

const rewardFlyActive = ref(false)
const flyCoins = ref<FlyCoin[]>([])

const rewardGrantLine = computed(() => {
  const p = targetPlan.value
  if (p === 'plus' || p === 'pro') {
    return t('coinHub.premiumRewardGrant', { n: premiumMonthlyCoins(p) })
  }
  return ''
})

const celebrationTitle = computed(() => {
  const p = targetPlan.value
  if (p === 'plus') {
    return t('coinHub.premiumUpgradeCelebrationTitle', { plan: t('coinHub.planPlus') })
  }
  if (p === 'pro') {
    return t('coinHub.premiumUpgradeCelebrationTitle', { plan: t('coinHub.planPro') })
  }
  return ''
})

const reduceMotion = computed(
  () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
)

const showModalLayer = computed(() => {
  if (!props.open) {
    return false
  }
  if (uxPhase.value === 'modal') {
    return true
  }
  if (uxPhase.value === 'celebration' && modalShellDuringCelebration.value) {
    return true
  }
  return false
})

const blockBackdrop = computed(
  () =>
    fakePhase.value === 'purchasing' ||
    uxPhase.value === 'celebration' ||
    rewardFlyActive.value,
)

let purchaseEndTimer: ReturnType<typeof setTimeout> | null = null
let modalExitTimer: ReturnType<typeof setTimeout> | null = null
let flyStartTimer: ReturnType<typeof setTimeout> | null = null
let flyEndTimer: ReturnType<typeof setTimeout> | null = null
let celebrationPostFlyTimer: ReturnType<typeof setTimeout> | null = null
let celebrationCloseTimer: ReturnType<typeof setTimeout> | null = null

function clearPurchaseEndTimer() {
  if (purchaseEndTimer) {
    clearTimeout(purchaseEndTimer)
    purchaseEndTimer = null
  }
}

function clearModalExitTimer() {
  if (modalExitTimer) {
    clearTimeout(modalExitTimer)
    modalExitTimer = null
  }
}

function clearFlyTimers() {
  if (flyStartTimer) {
    clearTimeout(flyStartTimer)
    flyStartTimer = null
  }
  if (flyEndTimer) {
    clearTimeout(flyEndTimer)
    flyEndTimer = null
  }
}

function clearCelebrationEndTimers() {
  if (celebrationPostFlyTimer) {
    clearTimeout(celebrationPostFlyTimer)
    celebrationPostFlyTimer = null
  }
  if (celebrationCloseTimer) {
    clearTimeout(celebrationCloseTimer)
    celebrationCloseTimer = null
  }
}

function makeFlyCoins(sx: number, sy: number, ex: number, ey: number, count: number): FlyCoin[] {
  const ddx = ex - sx
  const ddy = ey - sy
  return Array.from({ length: count }, (_, i) => {
    const jx = (Math.random() - 0.5) * 40
    const jy = (Math.random() - 0.5) * 40
    return {
      id: `fly-${i}-${Date.now()}`,
      x: sx + jx,
      y: sy + jy,
      tx: ddx - jx,
      ty: ddy - jy,
      delay: `${i * FLY_STAGGER_MS}ms`,
      duration: `${0.78 + Math.random() * 0.2}s`,
    }
  })
}

function updateBalanceSpot() {
  const el = document.getElementById('coinhub-balance-fly-target')
  if (!el) {
    return
  }
  const r = el.getBoundingClientRect()
  balanceSpot.value = {
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    w: r.width,
    h: r.height,
  }
}

function resetFakePurchase() {
  clearPurchaseEndTimer()
  clearModalExitTimer()
  clearFlyTimers()
  clearCelebrationEndTimers()
  fakePhase.value = 'idle'
  targetPlan.value = null
  uxPhase.value = 'modal'
  modalShellDuringCelebration.value = false
  celebrationExiting.value = false
  rewardFlyActive.value = false
  flyCoins.value = []
}

function applyPremiumRewardAndNotify() {
  const plan = targetPlan.value
  if (plan === 'plus' || plan === 'pro') {
    coinHub.applyLocalPremiumBonus(premiumMonthlyCoins(plan))
    coinHub.requestBalanceCelebrationPulse()
  }
  playCoinCollect()
  if (plan && plan !== 'basic') {
    emit('selectPlan', plan)
  }
}

function finishRewardNoMotion() {
  if (!props.open) {
    return
  }
  applyPremiumRewardAndNotify()
  void nextTick(() => {
    if (props.open) {
      close()
    }
  })
}

function scheduleCelebrationAutoClose() {
  clearCelebrationEndTimers()
  celebrationPostFlyTimer = setTimeout(() => {
    celebrationPostFlyTimer = null
    celebrationExiting.value = true
    celebrationCloseTimer = setTimeout(() => {
      celebrationCloseTimer = null
      close()
    }, CELEBRATION_OVERLAY_FADE_OUT_MS)
  }, POST_FLY_HOLD_MS)
}

function onFlyToBalanceComplete() {
  rewardFlyActive.value = false
  flyCoins.value = []
  if (!props.open) {
    return
  }
  applyPremiumRewardAndNotify()
  scheduleCelebrationAutoClose()
}

async function startRewardFly() {
  await nextTick()
  if (!props.open) {
    return
  }
  const plan = targetPlan.value
  if (plan !== 'plus' && plan !== 'pro') {
    return
  }
  const el = celebrationFlySourceRef.value
  if (!el) {
    onFlyToBalanceComplete()
    return
  }
  updateBalanceSpot()
  const tEl = document.getElementById('coinhub-balance-fly-target')
  const pr = el.getBoundingClientRect()
  const scx = pr.left + pr.width / 2
  const scy = pr.top + pr.height / 2
  const spot = balanceSpot.value
  const tr = tEl?.getBoundingClientRect()
  if (!spot && !tr) {
    onFlyToBalanceComplete()
    return
  }
  const ecx = spot?.cx ?? (tr ? tr.left + tr.width / 2 : scx)
  const ecy = spot?.cy ?? (tr ? tr.top + tr.height / 2 : scy)
  await nextTick()
  flyCoins.value = makeFlyCoins(scx, scy, ecx, ecy, FLY_COIN_COUNT)
  rewardFlyActive.value = true
  clearFlyTimers()
  flyEndTimer = setTimeout(() => {
    flyEndTimer = null
    onFlyToBalanceComplete()
  }, FLY_TO_BALANCE_MS)
}

async function onCelebrationLayoutReady() {
  await nextTick()
  await new Promise((r) => {
    requestAnimationFrame(() => r(null))
  })
  clearFlyTimers()
  flyStartTimer = setTimeout(() => {
    flyStartTimer = null
    if (!props.open) {
      return
    }
    void startRewardFly()
  }, CELEBRATION_FLY_DELAY_MS)
}

function onPurchaseTimerDone() {
  purchaseEndTimer = null
  if (!props.open) {
    return
  }
  fakePhase.value = 'success'
  if (reduceMotion.value) {
    finishRewardNoMotion()
    return
  }
  updateBalanceSpot()
  clearModalExitTimer()
  modalShellDuringCelebration.value = true
  uxPhase.value = 'celebration'
  void nextTick(() => {
    updateBalanceSpot()
    requestAnimationFrame(() => {
      updateBalanceSpot()
      void onCelebrationLayoutReady()
    })
  })
  modalExitTimer = setTimeout(() => {
    modalExitTimer = null
    if (!props.open) {
      return
    }
    modalShellDuringCelebration.value = false
  }, MODAL_FADE_OUT_MS)
}

function close() {
  resetFakePurchase()
  emit('update:open', false)
  emit('close')
}

function onBackdropClick() {
  if (blockBackdrop.value) {
    return
  }
  close()
}

function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    e.preventDefault()
    if (blockBackdrop.value) {
      return
    }
    close()
  }
}

function onBuyFromCard(id: PlanId) {
  if (id === 'basic') {
    return
  }
  if (fakePhase.value !== 'idle') {
    return
  }
  playUiClick()
  targetPlan.value = id
  fakePhase.value = 'purchasing'
  clearPurchaseEndTimer()
  purchaseEndTimer = setTimeout(onPurchaseTimerDone, FAKE_PURCHASE_MS)
}

function onWindowResize() {
  if (props.open && uxPhase.value === 'celebration') {
    updateBalanceSpot()
  }
}

function onWindowScroll() {
  if (props.open && uxPhase.value === 'celebration') {
    updateBalanceSpot()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onDocKey)
  updateBalanceSpot()
  window.addEventListener('resize', onWindowResize, { passive: true })
  window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKey)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('scroll', onWindowScroll, { capture: true })
})

onBeforeUnmount(() => {
  clearPurchaseEndTimer()
  clearModalExitTimer()
  clearFlyTimers()
  clearCelebrationEndTimers()
  if (document.body.dataset.chPremiumModalPrevOverflow !== undefined) {
    document.body.style.overflow = document.body.dataset.chPremiumModalPrevOverflow ?? ''
    delete document.body.dataset.chPremiumModalPrevOverflow
  }
})

watch(
  () => props.open,
  (o) => {
    if (o) {
      resetFakePurchase()
      const prev = document.body.style.overflow
      document.body.dataset.chPremiumModalPrevOverflow = prev
      document.body.style.overflow = 'hidden'
      void nextTick(() => {
        updateBalanceSpot()
      })
    } else {
      resetFakePurchase()
      const prev = document.body.dataset.chPremiumModalPrevOverflow
      document.body.style.overflow = prev ?? ''
      delete document.body.dataset.chPremiumModalPrevOverflow
    }
  },
)

watch(uxPhase, (p) => {
  if (p === 'celebration') {
    void nextTick(() => {
      updateBalanceSpot()
    })
  }
})

watch(
  () => [props.open, uxPhase.value] as const,
  ([o, p]) => {
    premiumCelebrationHeroLift.value = Boolean(o && p === 'celebration')
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="prem-modal-anim">
      <div
        v-show="open && showModalLayer"
        class="prem-modal__root fixed inset-0 z-[10030] flex items-center justify-center p-3 sm:p-5"
        :class="[
          fakePhase === 'purchasing' && 'prem-modal__root--purchasing',
          uxPhase === 'celebration' && modalShellDuringCelebration && 'prem-modal__root--exit',
        ]"
        role="presentation"
      >
        <div
          :class="[
            'prem-modal__backdrop absolute inset-0',
            (fakePhase === 'purchasing' || fakePhase === 'success' || rewardFlyActive) &&
              'prem-modal__backdrop--dim-extra',
          ]"
          aria-hidden="true"
          @click="onBackdropClick"
        />
        <div
          :class="[
            'prem-modal__dialog relative z-10 flex w-full max-w-7xl flex-col gap-4 overflow-hidden rounded-[22px] border border-violet-500/20 bg-[#070712]/96 p-4 shadow-[0_0_80px_rgba(60,40,140,0.35)] sm:gap-5 sm:p-6',
            fakePhase === 'purchasing' && 'prem-modal__dialog--pulse',
          ]"
          role="dialog"
          aria-modal="true"
          :aria-busy="fakePhase === 'purchasing' ? 'true' : undefined"
          :aria-label="t('coinHub.premiumModalTitle')"
          @click.stop
        >
          <div
            class="relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 sm:gap-5"
          >
            <div class="flex items-start justify-between gap-3">
              <h2
                class="prem-modal__title m-0 text-left"
                id="premium-plans-heading"
              >
                {{ t('coinHub.premiumModalTitle') }}
              </h2>
              <button
                type="button"
                class="prem-modal__close ch-ds-text-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg leading-none text-white/80 transition duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
                :aria-label="t('coinHub.premiumModalClose')"
                @click="close"
              >
                ×
              </button>
            </div>

            <div
              class="prem-modal__grid"
              aria-labelledby="premium-plans-heading"
            >
              <PricingPlanCard
                v-for="id in planOrder"
                :key="id"
                :plan="id"
                :fake-phase="fakePhase"
                :fake-target="targetPlan"
                @buy="onBuyFromCard"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <div
      v-show="open && uxPhase === 'celebration'"
      class="prem-upgrade-overlay"
      :class="[
        celebrationExiting && 'prem-upgrade-overlay--exit',
        !reduceMotion && 'prem-upgrade-overlay--fade-in',
      ]"
      role="status"
      aria-live="assertive"
      :aria-label="celebrationTitle"
    >
      <div
        class="prem-upgrade-overlay__glow"
        aria-hidden="true"
      />
      <div
        class="prem-upgrade-overlay__sparks"
        aria-hidden="true"
      >
        <span
          v-for="n in 4"
          :key="`spk-${n}`"
          :class="`prem-upgrade-overlay__spark prem-upgrade-overlay__spark--${(n - 1) % 4}`"
        />
      </div>
      <div class="prem-upgrade-overlay__content">
        <p class="prem-upgrade-overlay__title">
          {{ celebrationTitle }}
        </p>
        <p
          ref="celebrationFlySourceRef"
          class="prem-upgrade-overlay__reward"
        >
          {{ rewardGrantLine }}
        </p>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-show="open && rewardFlyActive && flyCoins.length > 0"
      class="prem-modal__fly-layer"
      aria-hidden="true"
    >
      <span
        v-for="f in flyCoins"
        :key="f.id"
        class="prem-modal__fly-coin"
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
.prem-modal-anim-enter-active,
.prem-modal-anim-leave-active {
  transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.prem-modal-anim-enter-active .prem-modal__dialog,
.prem-modal-anim-leave-active .prem-modal__dialog {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.prem-modal-anim-enter-active .prem-modal__backdrop,
.prem-modal-anim-leave-active .prem-modal__backdrop {
  transition: opacity 0.4s cubic-bezier(0.33, 1, 0.68, 1);
}

.prem-modal-anim-enter-from,
.prem-modal-anim-leave-to {
  opacity: 0;
}

.prem-modal-anim-enter-from .prem-modal__dialog,
.prem-modal-anim-leave-to .prem-modal__dialog {
  transform: scale(0.95) translateY(8px);
}

.prem-modal__root--exit {
  pointer-events: none;
}

.prem-modal__root--exit .prem-modal__backdrop,
.prem-modal__root--exit .prem-modal__dialog {
  opacity: 0;
  transform: scale(0.98) translateY(6px);
  transition:
    opacity 0.6s cubic-bezier(0.33, 1, 0.68, 1),
    transform 0.6s cubic-bezier(0.33, 1, 0.68, 1);
}

@media (prefers-reduced-motion: reduce) {
  .prem-modal-anim-enter-active,
  .prem-modal-anim-leave-active,
  .prem-modal-anim-enter-active .prem-modal__dialog,
  .prem-modal-anim-leave-active .prem-modal__dialog {
    transition: opacity 0.12s ease;
  }

  .prem-modal-anim-enter-from .prem-modal__dialog,
  .prem-modal-anim-leave-to .prem-modal__dialog {
    transform: none;
  }

  .prem-modal__root--exit .prem-modal__backdrop,
  .prem-modal__root--exit .prem-modal__dialog {
    transition: opacity 0.2s ease;
  }
}

/* Backdrop: radial mood lighting + strong vignette, 8px glass blur (AAA) */
.prem-modal__backdrop {
  background:
    radial-gradient(ellipse 78% 65% at 50% 32%, rgba(45, 32, 95, 0.42) 0%, transparent 58%),
    radial-gradient(ellipse 95% 70% at 50% 108%, rgba(0, 0, 0, 0.72) 0%, transparent 50%),
    linear-gradient(165deg, rgba(2, 2, 10, 0.94) 0%, rgba(0, 0, 0, 0.91) 45%, rgba(1, 1, 8, 0.96) 100%);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

/* AAA — premium dialog title: soft white→lavender gradient + breathing glow */
.prem-modal__title {
  font-size: clamp(1.65rem, 3.8vw, 2rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.18;
  background: linear-gradient(90deg, #ffffff 0%, #d8ccff 45%, #b89cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: prem-modal-title-glow 3s ease-in-out infinite alternate;
}

@keyframes prem-modal-title-glow {
  from {
    filter: drop-shadow(0 0 8px rgba(140, 90, 255, 0.35));
  }
  to {
    filter: drop-shadow(0 0 22px rgba(180, 120, 255, 0.55));
  }
}

@media (prefers-reduced-motion: reduce) {
  .prem-modal__title {
    animation: none;
    filter: drop-shadow(0 0 12px rgba(150, 95, 255, 0.45));
  }
}

.prem-modal__grid {
  display: grid;
  align-items: stretch;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .prem-modal__grid {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.25fr);
    gap: 1rem;
  }
}

@media (min-width: 768px) {
  .prem-modal__grid {
    gap: 1.25rem;
  }
}

.prem-modal__backdrop--dim-extra {
  background:
    radial-gradient(ellipse 78% 65% at 50% 32%, rgba(25, 18, 55, 0.55) 0%, transparent 58%),
    radial-gradient(ellipse 95% 70% at 50% 108%, rgba(0, 0, 0, 0.88) 0%, transparent 50%),
    linear-gradient(165deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.9) 100%);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transition: backdrop-filter 0.4s ease, background 0.4s ease;
}

.prem-modal__root--purchasing .prem-modal__backdrop--dim-extra {
  transition: backdrop-filter 0.35s ease, background 0.35s ease;
}

.prem-modal__dialog--pulse {
  animation: prem-modal-dlg-pulse 0.55s ease-in-out infinite;
  will-change: transform;
}

@keyframes prem-modal-dlg-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.018);
  }
}

/* Fullscreen post-purchase celebration (replaces in-modal reward card). */
.prem-upgrade-overlay {
  position: fixed;
  inset: 0;
  z-index: 10040;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: radial-gradient(
    circle at 50% 42%,
    rgba(30, 10, 80, 0.6) 0%,
    rgba(10, 5, 30, 0.92) 55%,
    rgba(0, 0, 0, 0.95) 100%
  );
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  transition: opacity 0.52s cubic-bezier(0.33, 1, 0.68, 1);
}

/* Backplate + mask stay at full opacity: fade only inner decoration/text (avoids page flash). */
.prem-upgrade-overlay--fade-in .prem-upgrade-overlay__glow,
.prem-upgrade-overlay--fade-in .prem-upgrade-overlay__sparks,
.prem-upgrade-overlay--fade-in .prem-upgrade-overlay__content {
  opacity: 0;
  animation: prem-overlay-fade-in 0.25s ease forwards;
}

.prem-upgrade-overlay--exit {
  pointer-events: none;
  animation: none;
  opacity: 0;
}

.prem-upgrade-overlay__glow {
  position: absolute;
  inset: -20% -10%;
  z-index: 0;
  background: radial-gradient(
    ellipse 55% 45% at 50% 40%,
    rgba(150, 80, 255, 0.28) 0%,
    rgba(100, 40, 200, 0.08) 50%,
    transparent 70%
  );
  filter: blur(2px);
  pointer-events: none;
}

.prem-upgrade-overlay__sparks {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.prem-upgrade-overlay__spark {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 220, 150, 0.75);
  box-shadow: 0 0 10px rgba(255, 200, 100, 0.8);
  opacity: 0.55;
  animation: prem-spark-float 2.4s ease-in-out infinite;
}

.prem-upgrade-overlay__spark--0 {
  top: 22%;
  left: 18%;
  animation-delay: 0s;
}

.prem-upgrade-overlay__spark--1 {
  top: 30%;
  right: 16%;
  animation-delay: 0.3s;
}

.prem-upgrade-overlay__spark--2 {
  bottom: 28%;
  left: 22%;
  animation-delay: 0.6s;
}

.prem-upgrade-overlay__spark--3 {
  bottom: 20%;
  right: 20%;
  animation-delay: 0.9s;
}

@keyframes prem-spark-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.4;
  }
  50% {
    transform: translate(3px, -6px) scale(1.1);
    opacity: 0.85;
  }
}

.prem-upgrade-overlay__content {
  position: relative;
  z-index: 1;
  max-width: min(34rem, 100%);
  text-align: center;
}

.prem-upgrade-overlay__title {
  margin: 0;
  font-size: clamp(1.75rem, 5vw, 2.8rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: 0.02em;
  background: linear-gradient(90deg, #fff 0%, #c9a6ff 55%, #b99cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  text-shadow: 0 0 20px rgba(180, 120, 255, 0.4);
  filter: drop-shadow(0 0 18px rgba(150, 90, 255, 0.35));
}

.prem-upgrade-overlay__reward {
  margin: 1rem 0 0;
  font-size: clamp(1.35rem, 4.2vw, 2.1rem);
  font-weight: 700;
  line-height: 1.2;
  color: #ffd76a;
  text-shadow:
    0 0 20px rgba(255, 200, 80, 0.55),
    0 0 40px rgba(255, 160, 40, 0.25);
}

@keyframes prem-overlay-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .prem-upgrade-overlay {
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }

  .prem-upgrade-overlay--fade-in .prem-upgrade-overlay__glow,
  .prem-upgrade-overlay--fade-in .prem-upgrade-overlay__sparks,
  .prem-upgrade-overlay--fade-in .prem-upgrade-overlay__content {
    animation: none;
    opacity: 1;
  }

  .prem-upgrade-overlay--exit {
    transition: opacity 0.2s ease;
  }

  .prem-upgrade-overlay__spark {
    animation: none;
    opacity: 0.35;
  }
}

.prem-modal__fly-layer {
  position: fixed;
  inset: 0;
  /* Above .prem-upgrade-overlay (10040) and lifted #coinhub-hero-root (10060) so coins land on the real balance. */
  z-index: 10070;
  pointer-events: none;
}

.prem-modal__fly-coin {
  position: fixed;
  margin-left: -10px;
  margin-top: -10px;
  font-size: 1.2rem;
  line-height: 1;
  will-change: transform, opacity, filter;
  filter:
    drop-shadow(0 0 4px rgba(255, 210, 100, 0.85))
    drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
  animation-name: prem-fly-to-balance;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  animation-fill-mode: forwards;
}

@keyframes prem-fly-to-balance {
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

@media (prefers-reduced-motion: reduce) {
  .prem-modal__dialog--pulse {
    animation: none;
  }
}
</style>
