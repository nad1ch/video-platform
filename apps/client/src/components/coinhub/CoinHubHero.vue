<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCoinHubStore } from '@/stores/coinHub'
import HeroSection from '@/components/coinhub/HeroSection.vue'
import '@/styles/coinhub-design-system.css'

withDefaults(
  defineProps<{
    /** Hero label (e.g. “Your balance” / “Ваш баланс”) */
    balanceLabel: string
    /** Pending line (e.g. “Pending” + amount below) */
    pendingLabel: string
    claimLabel: string
    isFocalTarget?: boolean
    adminDevLabel?: string
  }>(),
  { isFocalTarget: false, adminDevLabel: undefined },
)

const { t } = useI18n()
const coinHub = useCoinHubStore()
const { balanceCelebrationPulse, premiumCelebrationHeroLift } = storeToRefs(coinHub)

const heroHeaderRef = ref<HTMLElement | null>(null)
/** `true` after the first getBoundingClientRect so Teleport to body is safe. */
const celebrationTeleportReady = ref(false)
const celebrationSpacerH = ref(0)
const celebrationFixedBox = ref<{ top: number; left: number; width: number } | null>(null)

const hasPendingCoins = computed(() => coinHub.pending > 0)

const displayAmount = ref(0)
const balanceFlash = ref(false)
const showGainFloat = ref(false)
const gainKey = ref(0)
const lastClaimAdd = ref(0)
let rafId = 0
let floatTimer: ReturnType<typeof setTimeout> | null = null
let balanceFlashTimer: ReturnType<typeof setTimeout> | null = null
let noPendingToastTimer: ReturnType<typeof setTimeout> | null = null
let celebrationPulseTimer: ReturnType<typeof setTimeout> | null = null
let animating = false

const showNoPendingToast = ref(false)
const balanceCelebrationAnim = ref(false)

const formattedBalance = computed(() =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(displayAmount.value),
)

const formattedPending = computed(() =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(coinHub.pending),
)

onMounted(() => {
  displayAmount.value = coinHub.balance
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onHeroCelebrationResize, { passive: true })
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (floatTimer) clearTimeout(floatTimer)
  if (balanceFlashTimer) clearTimeout(balanceFlashTimer)
  if (noPendingToastTimer) {
    clearTimeout(noPendingToastTimer)
    noPendingToastTimer = null
  }
  if (celebrationPulseTimer) {
    clearTimeout(celebrationPulseTimer)
    celebrationPulseTimer = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onHeroCelebrationResize)
  }
  resetHeroCelebrationLift()
})

const teleportCelebrationToBody = computed(
  () => premiumCelebrationHeroLift.value && celebrationTeleportReady.value,
)

const heroCelebrationFixedStyle = computed((): Record<string, string> => {
  if (!teleportCelebrationToBody.value || !celebrationFixedBox.value) {
    return {}
  }
  const b = celebrationFixedBox.value
  return {
    position: 'fixed',
    top: `${b.top}px`,
    left: `${b.left}px`,
    width: `${b.width}px`,
    zIndex: '10060',
    pointerEvents: 'auto',
  }
})

function measureHeroForCelebration() {
  const el = heroHeaderRef.value
  if (!el) {
    return
  }
  const r = el.getBoundingClientRect()
  celebrationSpacerH.value = r.height
  celebrationFixedBox.value = { top: r.top, left: r.left, width: r.width }
  celebrationTeleportReady.value = true
}

function onHeroCelebrationResize() {
  if (!premiumCelebrationHeroLift.value || !celebrationTeleportReady.value) {
    return
  }
  measureHeroForCelebration()
}

function resetHeroCelebrationLift() {
  celebrationTeleportReady.value = false
  celebrationSpacerH.value = 0
  celebrationFixedBox.value = null
}

watch(
  premiumCelebrationHeroLift,
  (lift) => {
    if (!lift) {
      resetHeroCelebrationLift()
      return
    }
    void nextTick().then(() => {
      requestAnimationFrame(() => {
        measureHeroForCelebration()
      })
    })
  },
  { flush: 'post' },
)

watch(balanceCelebrationPulse, () => {
  if (celebrationPulseTimer) {
    clearTimeout(celebrationPulseTimer)
    celebrationPulseTimer = null
  }
  balanceCelebrationAnim.value = true
  celebrationPulseTimer = setTimeout(() => {
    balanceCelebrationAnim.value = false
    celebrationPulseTimer = null
  }, 620)
})

watch(
  () => coinHub.balance,
  (b) => {
    if (animating) {
      return
    }
    if (coinHub.consumeBalanceSkipForPremiumCountUp()) {
      if (balanceFlashTimer) {
        clearTimeout(balanceFlashTimer)
      }
      balanceFlash.value = true
      balanceFlashTimer = setTimeout(() => {
        balanceFlash.value = false
        balanceFlashTimer = null
      }, 200)
      runCountUp(b, 520)
      return
    }
    if (displayAmount.value !== b) {
      displayAmount.value = b
    }
  },
)

function runCountUp(nextTotal: number, duration = 400) {
  const start = displayAmount.value
  const delta = nextTotal - start
  if (delta === 0) return
  const t0 = performance.now()
  animating = true
  const step = (now: number) => {
    const u = Math.min(1, (now - t0) / duration)
    const eased = 1 - (1 - u) * (1 - u)
    displayAmount.value = Math.round(start + delta * eased)
    if (u < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      displayAmount.value = nextTotal
      rafId = 0
      animating = false
    }
  }
  rafId = requestAnimationFrame(step)
}

async function onClaim() {
  if (animating) return
  const add = Math.max(0, coinHub.pending)
  if (add <= 0) {
    if (noPendingToastTimer) {
      clearTimeout(noPendingToastTimer)
      noPendingToastTimer = null
    }
    showNoPendingToast.value = true
    noPendingToastTimer = setTimeout(() => {
      showNoPendingToast.value = false
      noPendingToastTimer = null
    }, 3600)
    return
  }

  animating = true
  try {
    await coinHub.claimPending()
  } catch {
    animating = false
    return
  }

  lastClaimAdd.value = add

  if (balanceFlashTimer) clearTimeout(balanceFlashTimer)
  balanceFlash.value = true
  balanceFlashTimer = setTimeout(() => {
    balanceFlash.value = false
    balanceFlashTimer = null
  }, 220)

  if (floatTimer) clearTimeout(floatTimer)
  gainKey.value += 1
  showGainFloat.value = true
  floatTimer = setTimeout(() => {
    showGainFloat.value = false
    floatTimer = null
  }, 520)

  runCountUp(coinHub.balance, 450)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showNoPendingToast"
      class="coinhub-claim-toast"
      role="status"
      aria-live="polite"
    >
      {{ t('coinHub.claimNoPending') }}
    </div>
  </Teleport>
  <div class="coinhub-hero-mount w-full min-w-0">
    <div
      v-show="celebrationSpacerH > 0"
      class="coinhub-hero-spacer w-full"
      :style="{ minHeight: celebrationSpacerH + 'px' }"
      aria-hidden="true"
    />
    <Teleport
      to="body"
      :disabled="!teleportCelebrationToBody"
    >
      <header
        id="coinhub-hero-root"
        ref="heroHeaderRef"
        class="coinhub-hero-header w-full min-w-0 max-w-none"
        :class="premiumCelebrationHeroLift && 'coinhub-hero--overlay-focus'"
        :style="heroCelebrationFixedStyle"
      >
        <HeroSection>
          <div
            class="coinhub-hero__slot relative flex h-full min-h-0 w-full flex-col"
          >
            <div
              v-if="adminDevLabel"
              class="hero-admin"
            >
              <span
                role="status"
                aria-live="polite"
              >{{ adminDevLabel }}</span>
            </div>

            <div
              class="coinhub-hero__main flex min-h-0 w-full min-w-0 flex-1 items-center justify-between gap-4"
            >
        <!-- Left: balance -->
        <div class="hero__left ch-hero-balance flex min-w-0 flex-col justify-center gap-1">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
            {{ balanceLabel }}
          </p>
          <div
            :class="[
              'coinhub-hero__balance-wrap relative mt-1 inline-flex max-w-full items-baseline gap-2',
              balanceCelebrationAnim && 'coinhub-hero__balance-wrap--celebration',
            ]"
          >
            <div
              class="coinhub-hero__balance-glow pointer-events-none absolute -inset-4 -z-10 rounded-3xl opacity-90"
              aria-hidden="true"
            />
            <p
              class="ch-hero-balance-digits tabular-nums"
              :class="[balanceFlash && 'coinhub-hero-balance-digits--flash']"
            >
              {{ formattedBalance }}
            </p>
            <span
              id="coinhub-balance-fly-target"
              class="coinhub-hero__coin-ico mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10"
              aria-hidden="true"
            >
              <span class="coinhub-hero__coin-face" />
            </span>
            <span
              v-if="showGainFloat"
              :key="gainKey"
              class="coinhub-gain-float pointer-events-none absolute -right-0.5 top-0 text-sm font-semibold tabular-nums text-amber-200 sm:-right-1"
              :aria-hidden="true"
            >
              +{{ lastClaimAdd }}
            </span>
          </div>
          <p class="mt-2 text-sm leading-snug text-[#6B7280]">
            <span>{{ pendingLabel }}</span>
            <span
              class="ms-1 font-semibold tabular-nums"
              :class="hasPendingCoins ? 'text-[#FEF3C7]' : 'text-[#6B7280]'"
            >{{ formattedPending }}</span>
          </p>
        </div>

        <!-- Right: CTA -->
        <div
          class="hero__right"
          :class="[coinHub.claimInFlight && 'coinhub-hero-claim--loading']"
        >
          <button
            type="button"
            class="hero-cta"
            :class="[isFocalTarget && 'hero-cta--focal']"
            :disabled="animating || coinHub.claimInFlight"
            @click="onClaim"
          >
            <span :class="coinHub.claimInFlight && 'opacity-60'">{{ claimLabel }}</span>
            <svg
              class="hero-cta__icon hero-cta__icon--crown"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294L11.562 3.266Z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <path
                d="M5 21h14"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            <span
              v-if="coinHub.claimInFlight"
              class="hero-cta__spinner-wrap"
              aria-hidden="true"
            >
              <span class="coinhub-inline-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white" />
            </span>
          </button>
        </div>
        </div>
      </div>
    </HeroSection>
      </header>
    </Teleport>
  </div>
</template>

<style scoped>
.coinhub-claim-toast {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  z-index: 10000;
  max-width: min(20rem, calc(100vw - 1.5rem));
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.35;
  color: #e5e7eb;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 10px 36px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  animation: coinhub-claim-toast-in 0.2s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .coinhub-claim-toast {
    animation: none;
  }
}

@keyframes coinhub-claim-toast-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.coinhub-hero-header {
  margin-inline: 0;
}

/* Full hero (balance + chest + CTA) above premium celebration overlay — see Teleport + fixed rect in script. */
.coinhub-hero-header.coinhub-hero--overlay-focus {
  position: relative;
  isolation: isolate;
}

.coinhub-hero-header.coinhub-hero--overlay-focus::after {
  content: '';
  position: absolute;
  inset: -40px;
  border-radius: 28px;
  background: radial-gradient(
    circle at center,
    rgba(255, 200, 80, 0.15),
    transparent 70%
  );
  filter: blur(20px);
  pointer-events: none;
  z-index: -1;
}

@media (prefers-reduced-motion: reduce) {
  .coinhub-hero-header.coinhub-hero--overlay-focus::after {
    filter: blur(12px);
    opacity: 0.85;
  }
}

.hero-admin {
  position: absolute;
  top: 20px;
  right: 40px;
  z-index: 20;
  font-size: 12px;
  font-weight: 600;
  color: #00e0b8;
  background: rgba(0, 224, 184, 0.1);
  border: 1px solid rgba(0, 224, 184, 0.3);
  padding: 6px 10px;
  border-radius: 8px;
  pointer-events: none;
}

@media (max-width: 640px) {
  .hero-admin {
    right: 20px;
    top: 12px;
    font-size: 11px;
    padding: 5px 8px;
  }
}

.hero__left {
  max-width: 320px;
  min-width: 0;
  flex: 0 1 auto;
}

.hero__right {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  flex-shrink: 0;
  z-index: 0;
}

/* Dark read backdrop behind CTA (pools light + gradient overlay) */
.hero__right::before {
  content: '';
  position: absolute;
  right: -48px;
  top: -48px;
  bottom: -48px;
  width: min(100vw, 360px);
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 90% 90% at 100% 50%,
    rgba(0, 0, 0, 0.45) 0%,
    rgba(0, 0, 0, 0.18) 55%,
    transparent 72%
  );
}

/* Gold CTA — label + icon light on gold (same idea as .ch-coinhub-gold-cta--label-light) */
.hero-cta {
  position: relative;
  z-index: 1;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: auto;
  max-width: 20rem;
  margin-right: 20px;
  padding: 14px 26px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.2;
  color: #fff;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.5),
    0 0 1px rgba(0, 0, 0, 0.35);
  background: linear-gradient(135deg, #ffd978, #f5b841, #c98a1c);
  border: 1px solid rgba(255, 240, 180, 0.45);
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(255, 200, 100, 0.35),
    0 8px 28px rgba(255, 160, 30, 0.45),
    0 10px 40px rgba(255, 200, 80, 0.35),
    0 0 24px rgba(255, 200, 80, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hero-cta::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  z-index: -1;
  background: linear-gradient(135deg, rgba(255, 230, 150, 0.85), rgba(255, 160, 50, 0.45));
  filter: blur(16px);
  opacity: 0.75;
  pointer-events: none;
}

.hero-cta:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 1px rgba(255, 240, 160, 0.45),
    0 16px 48px rgba(255, 180, 50, 0.55),
    0 20px 60px rgba(255, 200, 80, 0.5),
    0 0 36px rgba(255, 200, 80, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.hero-cta:active:not(:disabled) {
  transform: scale(0.98);
}

.hero-cta:focus-visible {
  outline: 2px solid rgba(251, 191, 36, 0.9);
  outline-offset: 3px;
}

.hero-cta:disabled {
  cursor: not-allowed;
  opacity: 0.92;
  transform: none;
  box-shadow:
    0 0 0 1px rgba(255, 200, 100, 0.3),
    0 6px 24px rgba(255, 180, 60, 0.25),
    0 0 20px rgba(255, 200, 80, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.hero-cta:disabled::before {
  opacity: 0.55;
  filter: blur(14px);
}

.hero-cta:disabled:hover {
  transform: none;
}

.hero-cta--focal:not(:disabled) {
  box-shadow:
    0 0 0 1px rgba(255, 220, 120, 0.45),
    0 8px 28px rgba(255, 160, 30, 0.5),
    0 12px 48px rgba(255, 200, 80, 0.45),
    0 0 32px rgba(255, 200, 100, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.hero-cta__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #fff;
  opacity: 0.95;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.hero-cta__spinner-wrap {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 217, 120, 0.82) 0%, rgba(245, 184, 65, 0.78) 100%);
  border-radius: 12px;
}

@media (max-width: 640px) {
  .coinhub-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .hero__right {
    justify-content: flex-end;
  }

  .hero-cta {
    margin-right: 0;
    max-width: none;
    width: 100%;
  }
}

.ch-hero-balance {
  position: relative;
}

/* Soft warm bloom only — no second color stop (avoids a muddy “box” behind digits). */
.coinhub-hero__balance-glow {
  background: radial-gradient(closest-side, rgba(255, 200, 100, 0.14) 0%, transparent 72%);
  animation: ch-hero-balance-pulse 5s ease-in-out infinite;
}

@keyframes ch-hero-balance-pulse {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}

.coinhub-hero__coin-ico {
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.5));
}

.coinhub-hero__coin-face {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: conic-gradient(
    from 200deg,
    #facc15 0deg,
    #fde68a 40deg,
    #f59e0b 90deg,
    #fbbf24 150deg,
    #d97706 220deg,
    #facc15 360deg
  );
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.45) inset,
    0 -3px 6px rgba(0, 0, 0, 0.45) inset,
    0 4px 8px -2px rgba(0, 0, 0, 0.55);
}

.coinhub-hero__coin-face::after {
  content: '';
  position: absolute;
  inset: 18%;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.35), transparent 50%);
  mix-blend-mode: screen;
}

.coinhub-hero__balance-wrap--celebration {
  animation: ch-hero-balance-celebration 0.6s ease;
}

@media (prefers-reduced-motion: reduce) {
  .coinhub-hero__balance-wrap--celebration {
    animation: none;
  }
}

@keyframes ch-hero-balance-celebration {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
  }
}

.coinhub-hero-balance-digits--flash {
  text-shadow:
    0 0 1px rgba(255, 255, 255, 1),
    0 0 40px rgba(252, 211, 77, 0.45);
}

.coinhub-gain-float {
  animation: ch-hero-gain-drift 0.48s ease-out forwards;
}

@keyframes ch-hero-gain-drift {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translate(4px, -12px);
    opacity: 0;
  }
}

.coinhub-inline-spinner {
  animation: ch-hero-spin 0.7s linear infinite;
}

@keyframes ch-hero-spin {
  to {
    transform: rotate(360deg);
  }
}

.coinhub-hero-claim--loading {
  opacity: 0.95;
}

@media (prefers-reduced-motion: reduce) {
  .coinhub-hero__balance-glow {
    animation: none !important;
  }

  .hero-cta {
    transition: none;
  }
}
</style>
