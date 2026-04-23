<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '@/styles/coinhub-design-system.css'

type PlanId = 'basic' | 'plus' | 'pro'

type FakeFlowPhase = 'idle' | 'purchasing' | 'success'

type FeatureItem = { text: string; kind?: 'includes' }

const props = withDefaults(
  defineProps<{
    plan: PlanId
    /** Fake checkout flow driven by `PremiumPlansModal` (no payments yet). */
    fakePhase?: FakeFlowPhase
    /** Which plan row is the active fake purchase (plus | pro), or `null` when idle. */
    fakeTarget?: PlanId | null
  }>(),
  {
    fakePhase: 'idle',
    fakeTarget: null,
  },
)

const emit = defineEmits<{
  buy: [id: PlanId]
}>()

const { t, tm } = useI18n()

const featureKey = computed(() => {
  if (props.plan === 'basic') return 'coinHub.premiumPlanBasicFeatures'
  if (props.plan === 'plus') return 'coinHub.premiumPlanPlusFeatures'
  return 'coinHub.premiumPlanProFeatures'
})

const features = computed((): FeatureItem[] => {
  const base = normalizeFeatures(tm(featureKey.value as never))
  if (props.plan === 'plus') {
    return [
      { text: t('coinHub.premiumPlanIncludesBasic'), kind: 'includes' },
      ...base,
    ]
  }
  if (props.plan === 'pro') {
    return [
      { text: t('coinHub.premiumPlanIncludesPlus'), kind: 'includes' },
      ...base,
    ]
  }
  return base
})

const title = computed(() => {
  if (props.plan === 'basic') return t('coinHub.planBasic')
  if (props.plan === 'plus') return t('coinHub.planPlus')
  return t('coinHub.planPro')
})

const price = computed(() => {
  if (props.plan === 'basic') return t('coinHub.premiumPriceBasic')
  if (props.plan === 'plus') return t('coinHub.premiumPricePlus')
  return t('coinHub.premiumPricePro')
})

/** Card-level chat mock (per spec: nad1ch / 🟣 / 👑). */
const chatLine = computed(() => {
  if (props.plan === 'basic') return t('coinHub.premiumCardChatLineBasic')
  if (props.plan === 'plus') return t('coinHub.premiumCardChatLinePlus')
  return t('coinHub.premiumCardChatLinePro')
})

const badgeLabel = computed(() => {
  if (props.plan === 'plus') return t('coinHub.premiumBadgePopular')
  if (props.plan === 'pro') return t('coinHub.premiumBadgeBest')
  return ''
})

/** Pro CTA only: gold + tier glow (Plus uses `ppc__cta-plus`). */
const proCtaGlowClass = computed(() => 'ch-coinhub-gold-cta--glow-pro ch-coinhub-gold-cta--glow-pro-cta')

/** Basic is the current (free) plan — CTA is display-only. */
const isCurrentPlan = computed(() => props.plan === 'basic')

const isFakeThisCard = computed(
  () => props.fakeTarget === props.plan && (props.plan === 'plus' || props.plan === 'pro'),
)

const ctaLabel = computed(() => {
  if (props.plan === 'basic') {
    return t('coinHub.premiumCtaCurrentPlan')
  }
  if (isFakeThisCard.value && props.fakePhase === 'success') {
    return t('coinHub.premiumCtaActivated')
  }
  if (props.plan === 'plus') {
    return t('coinHub.premiumCtaUpgradePlus')
  }
  return t('coinHub.premiumCtaGoPro')
})

const isFakePurchaseBlocking = computed(
  () => props.fakePhase === 'purchasing' || props.fakePhase === 'success',
)

const isCtaDisabled = computed(
  () => props.plan !== 'basic' && isFakePurchaseBlocking.value,
)

const ctaFakeClass = computed(() => {
  if (!isFakeThisCard.value) {
    return null
  }
  if (props.fakePhase === 'purchasing') {
    return 'ppc__cta--fake-purchasing'
  }
  if (props.fakePhase === 'success') {
    return 'ppc__cta--fake-success'
  }
  return null
})

function normalizeFeatures(raw: unknown): FeatureItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return { text: item }
    if (item && typeof item === 'object' && 'text' in item) {
      return { text: String((item as { text: string }).text) }
    }
    return { text: String(item) }
  }) as FeatureItem[]
}

function onCta() {
  if (isCurrentPlan.value) {
    return
  }
  if (props.plan !== 'basic' && isFakePurchaseBlocking.value) {
    return
  }
  emit('buy', props.plan)
}
</script>

<template>
  <article
    :class="[
      'ppc',
      plan === 'basic' && 'ppc--basic',
      plan === 'plus' && 'ppc--plus ppc--plus--highlight',
      plan === 'pro' && 'ppc--pro',
    ]"
  >
    <div
      v-if="plan === 'plus' || plan === 'pro'"
      class="ppc__badge"
      :class="plan === 'pro' ? 'ppc__badge--best' : 'ppc__badge--pop'"
    >
      {{ badgeLabel }}
    </div>

    <!-- Pro: gold gradient border shell -->
    <div
      v-if="plan === 'pro'"
      class="ppc__pro-ring"
    >
      <div class="ppc__pro-surface">
        <div class="ppc__inner">
          <h3 class="ppc__title">
            {{ title }}
          </h3>
          <p class="ppc__price">
            {{ price }}
          </p>

          <div
            class="ppc__chat"
            :class="'ppc__chat--pro'"
            aria-hidden="true"
          >
            {{ chatLine }}
          </div>

          <ul
            class="ppc__feats"
            role="list"
          >
            <li
              v-for="(row, i) in features"
              :key="`f-${i}`"
              class="ppc__feat"
              :class="`ppc__feat--${plan}`"
            >
              <span
                class="ppc__feat-lead ppc__feat-lead--pro"
                aria-hidden="true"
              >
                <span
                  v-if="row.kind === 'includes'"
                  class="ppc__feat-check ppc__feat-check--pro"
                >✓</span>
                <span
                  v-else
                  class="ppc__feat-crown"
                >👑</span>
              </span>
              <div class="ppc__feat-body">
                <span
                  class="ppc__feat-text"
                  :class="row.kind === 'includes' && 'ppc__feat-text--includes'"
                >{{ row.text }}</span>
              </div>
            </li>
          </ul>

          <button
            type="button"
            class="ch-coinhub-gold-cta ch-coinhub-gold-cta--label-light ppc__buy ppc__cta--sized"
            :class="[proCtaGlowClass, ctaFakeClass]"
            :disabled="isCtaDisabled"
            @click="onCta"
          >
            {{ ctaLabel }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-else
      class="ppc__shell"
    >
      <div class="ppc__inner">
        <h3 class="ppc__title">
          {{ title }}
        </h3>
        <p class="ppc__price">
          {{ price }}
        </p>

        <div
          class="ppc__chat"
          :class="plan === 'basic' ? 'ppc__chat--basic' : 'ppc__chat--plus'"
          aria-hidden="true"
        >
          {{ chatLine }}
        </div>

        <ul
          class="ppc__feats"
          role="list"
        >
          <li
            v-for="(row, i) in features"
            :key="`f-${i}`"
            class="ppc__feat"
            :class="`ppc__feat--${plan}`"
          >
            <span
              class="ppc__feat-lead"
              :class="`ppc__feat-lead--${plan}`"
              aria-hidden="true"
            >
              <span
                v-if="row.kind === 'includes'"
                class="ppc__feat-check ppc__feat-check--plus"
              >✓</span>
              <span
                v-else
                class="ppc__feat-dot"
              />
            </span>
            <div class="ppc__feat-body">
              <span
                class="ppc__feat-text"
                :class="row.kind === 'includes' && 'ppc__feat-text--includes'"
              >{{ row.text }}</span>
            </div>
          </li>
        </ul>

        <button
          v-if="!isCurrentPlan"
          type="button"
          class="ppc__buy ppc__cta-plus ppc__cta--sized"
          :class="[ctaFakeClass]"
          :disabled="isCtaDisabled"
          @click="onCta"
        >
          {{ ctaLabel }}
        </button>
        <button
          v-else
          type="button"
          class="ppc__buy ppc__cta-current ppc__cta--sized"
          disabled
        >
          {{ ctaLabel }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* —— Pricing card (Coin Hub premium modal) —— */
.ppc {
  position: relative;
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  border-radius: 20px;
  transition:
    transform 0.28s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.28s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

@media (prefers-reduced-motion: reduce) {
  .ppc {
    transition: box-shadow 0.2s ease;
  }
}

.ppc__shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  border-radius: 18px;
}

.ppc:hover:not(.ppc--pro) {
  transform: translateY(-8px);
}

.ppc--pro {
  z-index: 2;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  filter: drop-shadow(0 0 8px rgba(255, 190, 90, 0.35));
}

.ppc--pro:hover {
  transform: translateY(-8px);
  filter: drop-shadow(0 0 28px rgba(255, 200, 100, 0.72));
}

@media (prefers-reduced-motion: reduce) {
  .ppc:hover:not(.ppc--pro) {
    transform: none;
  }

  .ppc--pro:hover {
    transform: none;
  }
}

/* Gold gradient border + strong glow (PRO) */
.ppc__pro-ring {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  padding: 2px;
  border-radius: 20px;
  background: linear-gradient(135deg, #fffbeb 0%, #fcd34d 25%, #f59e0b 50%, #fef08a 75%, #d97706 100%);
  box-shadow:
    0 0 64px rgba(255, 185, 60, 0.62),
    0 0 110px rgba(255, 145, 45, 0.42),
    0 0 52px rgba(255, 225, 120, 0.32),
    0 22px 60px rgba(0, 0, 0, 0.58);
  transition:
    box-shadow 0.32s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    filter 0.32s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.ppc--pro:hover .ppc__pro-ring {
  box-shadow:
    0 0 88px rgba(255, 200, 75, 0.82),
    0 0 150px rgba(255, 145, 45, 0.55),
    0 0 80px rgba(255, 235, 150, 0.48),
    0 28px 72px rgba(0, 0, 0, 0.65);
}

.ppc--pro::before {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -1;
  border-radius: 22px;
  background: linear-gradient(
    125deg,
    rgba(255, 220, 120, 0.35) 0%,
    transparent 40%,
    rgba(200, 120, 255, 0.2) 60%,
    rgba(255, 200, 80, 0.3) 100%
  );
  background-size: 200% 200%;
  animation: ppc-pro-sheen 6s ease-in-out infinite;
  opacity: 0.65;
  filter: blur(8px);
  pointer-events: none;
  transition: opacity 0.32s ease;
}

.ppc--pro:hover::before {
  opacity: 0.88;
}

/* Pro: large blurred gradient aura (behind card; stacks with ::before) */
.ppc--pro::after {
  content: '';
  position: absolute;
  inset: -18% -10% -14% -10%;
  z-index: -2;
  border-radius: 32px;
  background: radial-gradient(
    ellipse 68% 58% at 50% 38%,
    rgba(255, 220, 130, 0.42) 0%,
    rgba(255, 150, 50, 0.2) 38%,
    rgba(100, 50, 180, 0.14) 58%,
    transparent 75%
  );
  filter: blur(36px);
  opacity: 0.8;
  pointer-events: none;
  transition: opacity 0.32s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.ppc--pro:hover::after {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .ppc--pro::before {
    animation: none;
    opacity: 0.4;
  }

  .ppc--pro::after {
    transition: none;
    opacity: 0.55;
  }

  .ppc--pro:hover {
    filter: none;
  }
}

.ppc__pro-surface {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border-radius: 17px;
  background: linear-gradient(180deg, rgba(32, 22, 10, 0.96) 0%, rgba(6, 8, 18, 0.99) 100%);
}

/* Inner radial “spotlight” — animated */
.ppc__pro-surface::before {
  content: '';
  position: absolute;
  left: 8%;
  top: 4%;
  z-index: 0;
  width: 120%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse 60% 55% at 50% 45%,
    rgba(255, 230, 180, 0.55) 0%,
    rgba(255, 180, 90, 0.18) 40%,
    transparent 70%
  );
  opacity: 0.75;
  mix-blend-mode: screen;
  pointer-events: none;
  will-change: transform, opacity;
  animation: ppc-pro-radial-light 6.5s ease-in-out infinite;
}

.ppc__pro-surface::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(
    150deg,
    rgba(255, 200, 100, 0.14) 0%,
    transparent 45%,
    rgba(100, 60, 180, 0.1) 100%
  );
  background-size: 200% 200%;
  animation: ppc-pro-sheen 8s ease-in-out infinite;
  opacity: 0.5;
  mix-blend-mode: screen;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .ppc__pro-surface::before,
  .ppc__pro-surface::after {
    animation: none;
    opacity: 0.3;
  }
}

@keyframes ppc-pro-radial-light {
  0%,
  100% {
    opacity: 0.6;
    transform: translate(0, 0) scale(0.95);
  }
  50% {
    opacity: 0.95;
    transform: translate(6%, 8%) scale(1.08);
  }
}

@keyframes ppc-pro-sheen {
  0%,
  100% {
    background-position: 0% 40%;
  }
  50% {
    background-position: 100% 58%;
  }
}

.ppc__inner {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  padding: 1.125rem 1rem 1.125rem;
}

.ppc__badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 4;
  max-width: min(100% - 0.5rem, 14rem);
  border-radius: 999px;
  padding: 0.3rem 0.55rem;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  pointer-events: none;
}

.ppc__badge--pop {
  text-transform: none;
  letter-spacing: 0.04em;
  color: #f5f3ff;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.65), rgba(76, 29, 149, 0.75));
  border: 1px solid rgba(196, 181, 253, 0.5);
  box-shadow: 0 0 32px rgba(120, 70, 220, 0.45);
}

.ppc__badge--best {
  text-transform: none;
  letter-spacing: 0.04em;
  color: #1a0f02;
  background: linear-gradient(135deg, #fff7ed, #fde68a, #fbbf24);
  border: 1px solid rgba(255, 200, 80, 0.9);
  box-shadow:
    0 0 0 1px rgba(255, 220, 140, 0.35),
    0 0 32px rgba(255, 200, 80, 0.65),
    0 0 48px rgba(255, 160, 40, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  animation: ppc-badge-best-pulse 2.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ppc__badge--best {
    animation: none;
  }
}

@keyframes ppc-badge-best-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(255, 220, 140, 0.35),
      0 0 28px rgba(255, 200, 80, 0.55),
      0 0 40px rgba(255, 160, 40, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 240, 200, 0.45),
      0 0 40px rgba(255, 220, 100, 0.75),
      0 0 56px rgba(255, 180, 60, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.65);
  }
}

/* —— Basic: smallest column + slightly faded (entry tier) —— */
.ppc--basic {
  border: 1px solid rgba(82, 84, 100, 0.28);
  background: linear-gradient(180deg, rgba(11, 13, 22, 0.86) 0%, rgba(4, 6, 12, 0.93) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  opacity: 0.93;
}

.ppc--basic:hover {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 20px rgba(100, 100, 130, 0.14),
    0 16px 36px rgba(0, 0, 0, 0.48);
}

.ppc--basic .ppc__title {
  color: rgba(255, 255, 255, 0.78);
}

.ppc--basic .ppc__price {
  color: rgba(180, 182, 195, 0.82);
}

/* —— Plus: medium purple glow (mid tier) —— */
.ppc--plus {
  border: 1px solid rgba(139, 92, 246, 0.52);
  background: linear-gradient(180deg, rgba(36, 28, 70, 0.85) 0%, rgba(6, 8, 20, 0.99) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 44px rgba(100, 60, 220, 0.38),
    0 0 68px rgba(80, 40, 200, 0.22),
    0 16px 40px rgba(0, 0, 0, 0.4);
}

.ppc--plus:hover {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 0 58px rgba(120, 80, 240, 0.48),
    0 0 82px rgba(100, 60, 200, 0.28),
    0 20px 48px rgba(0, 0, 0, 0.42);
}

/* Mid-tier emphasis (Plus) */
.ppc--plus--highlight {
  transform: scale(1.01);
  border-color: rgba(167, 139, 250, 0.68);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 0 52px rgba(120, 70, 240, 0.42),
    0 0 76px rgba(100, 60, 220, 0.25),
    0 18px 44px rgba(0, 0, 0, 0.42);
}

.ppc--plus--highlight:hover {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 64px rgba(130, 85, 250, 0.52),
    0 0 90px rgba(100, 60, 220, 0.3),
    0 22px 50px rgba(0, 0, 0, 0.44);
}

@media (prefers-reduced-motion: reduce) {
  .ppc--plus--highlight {
    transform: none;
  }
}

.ppc--plus .ppc__title {
  color: #fff;
}

/* Chat mock */
.ppc__chat {
  display: block;
  border-radius: 10px;
  padding: 0.45rem 0.6rem;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
  letter-spacing: 0.02em;
  line-height: 1.35;
  word-break: break-all;
}

.ppc__chat--basic {
  color: rgba(200, 200, 210, 0.95);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(120, 120, 140, 0.35);
}

.ppc__chat--plus {
  color: #e9d5ff;
  background: rgba(30, 20, 60, 0.7);
  border: 1px solid rgba(139, 92, 246, 0.4);
  text-shadow: 0 0 12px rgba(139, 92, 246, 0.35);
}

.ppc__chat--pro {
  color: #fef3c7;
  border: 1px solid rgba(251, 191, 36, 0.45);
  text-shadow: 0 0 14px rgba(251, 191, 36, 0.25);
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.5), rgba(50, 35, 8, 0.55));
}

.ppc__title {
  margin: 0 0 0.35rem;
  padding-right: 4.5rem;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
}

.ppc--pro .ppc__title {
  padding-right: 6.5rem;
}

.ppc__price {
  margin: 0 0 0.75rem;
  font-size: 0.98rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f3e8ff;
}

.ppc__emotional {
  margin: -0.35rem 0 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  font-style: italic;
  line-height: 1.4;
  color: rgba(255, 236, 200, 0.92);
  text-shadow: 0 0 18px rgba(253, 224, 140, 0.35);
}

.ppc--basic .ppc__price {
  font-weight: 600;
}

.ppc__feats {
  margin: 0;
  flex: 1 1 auto;
  list-style: none;
  padding: 0.85rem 0 0.85rem 0;
}

.ppc__feat {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.ppc__feat + .ppc__feat {
  margin-top: 0.5rem;
}

/* Feature row icons: Basic = gray dot, Plus = purple dot, Pro = crown */
.ppc__feat-lead {
  display: flex;
  flex-shrink: 0;
  width: 1.1rem;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.12rem;
}

.ppc__feat-crown {
  display: block;
  font-size: 0.78rem;
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.45));
}

.ppc__feat-check {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.1;
}

.ppc__feat-check--plus {
  color: rgba(196, 181, 253, 0.55);
  text-shadow: 0 0 10px rgba(139, 92, 246, 0.35);
}

.ppc__feat-check--pro {
  color: rgba(250, 204, 120, 0.55);
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.28);
}

.ppc__feat-dot {
  display: block;
  height: 7px;
  width: 7px;
  border-radius: 999px;
}

.ppc__feat-lead--basic .ppc__feat-dot,
.ppc__feat-lead--plus .ppc__feat-dot {
  margin-top: 0.2rem;
}

.ppc__feat-lead--basic .ppc__feat-dot {
  background: linear-gradient(135deg, #9ca3af, #5b6470);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.ppc__feat-lead--plus .ppc__feat-dot {
  background: linear-gradient(135deg, #c4b5fd, #7c3aed);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.55);
}

.ppc__feat-body {
  min-width: 0;
  flex: 1;
}

.ppc__feat-text {
  display: block;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.8);
}

.ppc--basic .ppc__feat-text {
  color: rgba(205, 205, 214, 0.92);
}

.ppc__feat-text--includes {
  opacity: 0.7;
  font-weight: 500;
}

.ppc__buy {
  box-sizing: border-box;
  margin-top: auto;
  padding-top: 28px;
}

/* 56px CTAs, vertically centered label (overrides design-system padding) */
.ppc__buy.ppc__cta--sized,
.ppc__buy.ch-coinhub-gold-cta.ppc__cta--sized {
  min-height: 56px;
  height: 56px;
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}

/* Plus: purple gradient CTA (not gold) */
.ppc__cta-plus {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1px solid rgba(167, 139, 250, 0.55);
  padding: 0 1.1rem;
  font-size: 0.88rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #faf5ff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  background: linear-gradient(145deg, #7c3aed 0%, #5b21b6 40%, #4c1d95 100%);
  box-shadow:
    0 0 0 1px rgba(139, 92, 246, 0.35),
    0 0 28px rgba(124, 58, 237, 0.42),
    0 8px 24px rgba(40, 20, 80, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transition:
    transform 0.28s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow 0.28s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.ppc__cta-plus:hover {
  box-shadow:
    0 0 0 1px rgba(196, 181, 253, 0.45),
    0 0 40px rgba(139, 92, 246, 0.55),
    0 10px 32px rgba(30, 15, 60, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transform: translateY(-3px);
}

.ppc__cta-plus:focus-visible {
  outline: 2px solid rgba(196, 181, 253, 0.95);
  outline-offset: 2px;
}

.ppc__cta-plus:active {
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .ppc__cta-plus,
  .ppc__cta-plus:hover,
  .ppc__cta-plus:active {
    transform: none;
  }
}

/* Pro gold CTA: lift on hover (stacks with design-system scale) */
:deep(.ppc__buy.ch-coinhub-gold-cta:hover:enabled) {
  transform: translateY(-3px) scale(1.03);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.ppc__buy.ch-coinhub-gold-cta:hover:enabled) {
    transform: none;
  }
}

.ppc__cta-current {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  border-radius: 14px;
  border: 1px solid rgba(85, 88, 105, 0.4);
  padding: 0 1rem;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(175, 178, 190, 0.72);
  background: linear-gradient(180deg, rgba(24, 26, 36, 0.85) 0%, rgba(10, 12, 20, 0.92) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  opacity: 0.88;
  transition:
    opacity 0.2s ease,
    border-color 0.2s ease;
}

.ppc__cta-current:disabled {
  pointer-events: none;
}

/* —— Fake purchase: CTA states (dev-only / placeholder checkout) —— */
.ppc__cta--fake-purchasing {
  animation: ppc-cta-fake-pulse 0.65s ease-in-out infinite;
  transform-origin: center;
}

.ppc__cta-plus.ppc__cta--fake-purchasing:disabled {
  cursor: wait;
  pointer-events: none;
  opacity: 1;
  box-shadow:
    0 0 0 2px rgba(196, 181, 253, 0.65),
    0 0 48px rgba(124, 58, 237, 0.75),
    0 0 72px rgba(100, 60, 220, 0.4),
    0 8px 28px rgba(30, 15, 60, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transform: scale(1.04);
  transition: transform 0.3s var(--ch-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

:deep(.ppc__buy.ch-coinhub-gold-cta.ppc__cta--fake-purchasing:disabled) {
  cursor: wait;
  pointer-events: none;
  opacity: 1;
  transform: scale(1.04);
  animation: ch-coinhub-gold-shimmer 1.1s var(--ch-ease-out, ease-in-out) infinite, ppc-cta-fake-pulse 0.65s ease-in-out infinite;
  box-shadow:
    0 0 0 2px rgba(255, 230, 160, 0.55),
    0 0 52px rgba(255, 200, 80, 0.85),
    0 0 80px rgba(255, 170, 50, 0.45),
    0 10px 36px rgba(120, 60, 20, 0.45);
}

@keyframes ppc-cta-fake-pulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.12);
  }
}

.ppc__cta--fake-success.ppc__cta-plus:disabled,
.ppc__cta-plus.ppc__cta--fake-success:disabled {
  cursor: default;
  opacity: 1;
  border-color: rgba(52, 211, 153, 0.5);
  color: #ecfdf5;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  background: linear-gradient(145deg, #059669 0%, #047857 45%, #065f46 100%);
  box-shadow:
    0 0 0 1px rgba(52, 211, 153, 0.35),
    0 0 28px rgba(16, 185, 129, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

:deep(.ppc__buy.ch-coinhub-gold-cta.ppc__cta--fake-success:disabled) {
  cursor: default;
  opacity: 1;
  animation: none;
  border: 1px solid rgba(52, 211, 153, 0.45);
  color: #ecfdf5;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  background-image: none;
  background: linear-gradient(140deg, #0d9488, #047857, #0f766e);
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.35),
    0 0 36px rgba(16, 185, 129, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transform: scale(1);
}

:deep(.ppc__buy.ch-coinhub-gold-cta.ppc__cta--fake-success:disabled::before) {
  opacity: 0.4;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.6), rgba(5, 150, 105, 0.35));
}

@media (prefers-reduced-motion: reduce) {
  .ppc__cta--fake-purchasing {
    animation: none;
  }
}
</style>
