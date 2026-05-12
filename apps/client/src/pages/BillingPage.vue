<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import AppContainer from '@/components/ui/AppContainer.vue'
// Payment modal is hidden behind the "Buy Pro" CTA; lazy so the
// `/app/billing` first paint does not pay for the modal chunk.
const JarPaymentModal = defineAsyncComponent(
  () => import('@/components/billing/JarPaymentModal.vue'),
)
import { useProSubscription } from '@/composables/useProSubscription'
import { useJarBillingFlow } from '@/composables/useJarBillingFlow'
import { refreshBillingConfig, useBillingConfig } from '@/composables/useBillingConfig'
import { updateBillingEmail } from '@/services/billingApi'
import { subscriptionState } from '@/composables/useProSubscription'
import '@/styles/coinhub-design-system.css'

/**
 * Pricing / billing page (`/app/billing`). Shows the StreamAssist Pro tier
 * card and current subscription status. The "Buy Pro" button opens the
 * `JarPaymentModal` which drives the full Jar/Banka flow.
 *
 * Visual design borrows the Coin Hub "Pro" premium-card aesthetic
 * (`PricingPlanCard.vue` — gold gradient ring, animated sheen, crown
 * bullets, glowing gold CTA) so paying users get a premium-feeling page.
 * The card structure-specific classes (`.ppc__pro-*`) are scoped to this
 * file to avoid coupling with the Coin Hub component internals; the gold
 * CTA reuses the project's `ch-coinhub-gold-cta` design-system classes.
 *
 * Pricing copy comes from `useBillingConfig` (server env). The page
 * intentionally has NO hardcoded amount/duration — when the config endpoint
 * is unavailable, the CTA is disabled and a "pricing temporarily unavailable"
 * notice is shown instead of a stale fake number. Existing PaymentRequest
 * rows keep their persisted `amountUah` (the modal reads it directly from
 * the request DTO), so changing `PRO_PRICE_UAH` only affects new requests.
 */

const {
  subscription,
  isProActive,
  expiresAt,
  refreshSubscription,
  billingEmail: subscriptionBillingEmail,
  accountEmail,
} = useProSubscription()
const flow = useJarBillingFlow()
const billingConfig = useBillingConfig()

const modalOpen = ref(false)





const billingEmailDraft = ref('')
const billingEmailSaving = ref(false)
const billingEmailMessage = ref<{ kind: 'ok' | 'err'; text: string } | null>(null)




watch(
  subscriptionBillingEmail,
  (next, prev) => {
    if (next !== prev && billingEmailDraft.value.length === 0) {
      billingEmailDraft.value = next ?? ''
    }
  },
  { immediate: true },
)

const billingEmailHelper = computed(() => {
  if (subscriptionBillingEmail.value) {
    return `Сповіщення надсилаємо на ${subscriptionBillingEmail.value}.`
  }
  if (accountEmail.value) {
    return `За замовчуванням сповіщення підуть на ${accountEmail.value}. Можна вказати іншу адресу нижче.`
  }
  return 'Введіть пошту, щоб отримувати підтвердження оплати, відмови та закінчення підписки.'
})

const isBillingEmailDirty = computed(() => {
  const draft = billingEmailDraft.value.trim().toLowerCase()
  const current = (subscriptionBillingEmail.value ?? '').toLowerCase()
  return draft !== current
})

async function onSaveBillingEmail(): Promise<void> {
  if (billingEmailSaving.value) return
  billingEmailSaving.value = true
  billingEmailMessage.value = null
  try {
    const r = await updateBillingEmail(billingEmailDraft.value.trim())
    if (!r.ok) {
      billingEmailMessage.value = {
        kind: 'err',
        text:
          r.code === 'INVALID_EMAIL'
            ? 'Невірний формат пошти. Перевірте адресу.'
            : `Не вдалося зберегти: ${r.message}`,
      }
      return
    }
    
    // singleton so every other UI consumer (header pill, toast notifier,
    
    subscriptionState.value = r.data
    billingEmailMessage.value = {
      kind: 'ok',
      text: r.data.billingEmail
        ? 'Email для сповіщень збережено.'
        : 'Email для сповіщень очищено.',
    }
  } finally {
    billingEmailSaving.value = false
  }
}

const FEATURES: string[] = [
  'Безлімітні кімнати дзвінків та оверлеї для OBS',
  'Розширений набір ігрових інструментів стрімера',
  'Пріоритетна підтримка',
]

const subscriptionExpiresAtFormatted = computed(() => formatDate(expiresAt.value))
const requestExpiresAtFormatted = computed(() =>
  formatDateTime(flow.request.value?.expiresAt ?? null),
)

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const priceLabel = computed(() => {
  const c = billingConfig.config.value
  if (!c) return null
  return `${c.amountUah} ${c.currency}`
})
const durationLabel = computed(() => billingConfig.durationLabel.value)
const isPricingReady = computed(() => billingConfig.isReady.value)
const isPricingUnavailable = computed(
  () => !billingConfig.loading.value && !billingConfig.isReady.value,
)
const isJarConfigured = computed(() => billingConfig.jarConfigured.value)

const ctaLabel = computed(() => {
  const days = billingConfig.config.value?.durationDays
  const renewal = days ? `Поновити Pro на ${days} днів` : 'Поновити Pro'
  if (isProActive.value) return renewal
  if (subscription.value?.status === 'expired') return 'Поновити StreamAssist Pro'
  return 'Купити Pro'
})

const isCtaDisabled = computed(
  () => modalOpen.value || flow.isBusy.value || !isPricingReady.value || !isJarConfigured.value,
)

async function openCheckout(): Promise<void> {
  if (modalOpen.value) return
  modalOpen.value = true
  await flow.startCheckout()
}

async function onMarkPaid(): Promise<void> {
  await flow.markPaid()
}

async function onRetryCreate(): Promise<void> {
  flow.reset()
  await flow.startCheckout()
}

function onClose(): void {
  modalOpen.value = false
  flow.stopPolling()
  if (flow.isTerminal.value) {
    flow.reset()
  }
}

function onGoPro(): void {
  modalOpen.value = false
  flow.reset()
  void refreshSubscription()
}

onMounted(() => {
  // Subscription state is kept fresh by the global `BillingToastSurface`
  // notifier (immediate tick on auth, then every 20s + on visibility).
  // No need to fire a duplicate `subscription/me` from this page on mount.
  void refreshBillingConfig()
})
</script>

<template>
  <AppContainer>
    <section class="billing-page">
      <header class="billing-page__hero">
        <p class="billing-page__eyebrow">StreamAssist</p>
        <h1 class="billing-page__title">StreamAssist Pro</h1>
        <p class="billing-page__subtitle">
          Розширений доступ до інструментів стрімера. Одноразова оплата через
          monobank — без підписки і без автосписання.
        </p>
      </header>

      <div
        v-if="isProActive"
        class="billing-page__status billing-page__status--active"
        role="status"
      >
        <p class="billing-page__status-title">
          <span class="billing-page__status-crown" aria-hidden="true">👑</span>
          Pro активний
        </p>
        <p v-if="subscriptionExpiresAtFormatted" class="billing-page__status-text">
          Доступ діє до <strong>{{ subscriptionExpiresAtFormatted }}</strong>.
        </p>
      </div>
      <div
        v-else-if="subscription && subscription.status === 'expired'"
        class="billing-page__status billing-page__status--lapsed"
        role="status"
      >
        <p class="billing-page__status-title">Pro закінчився</p>
        <p v-if="subscriptionExpiresAtFormatted" class="billing-page__status-text">
          Минулий період завершився {{ subscriptionExpiresAtFormatted }}. Поновіть,
          щоб продовжити користуватися Pro.
        </p>
      </div>

      <!--
        Billing notification email card. Lets Twitch sign-ups (no auth email)
        provide an address; lets email users override the auth address with
        a different one for billing-only mail. Empty input clears the override
        and falls back to the auth email server-side.
      -->
      <section class="billing-email-card" aria-labelledby="billing-email-title">
        <div class="billing-email-card__head">
          <h2 id="billing-email-title" class="billing-email-card__title">
            Email для сповіщень
          </h2>
          <p class="billing-email-card__hint">{{ billingEmailHelper }}</p>
        </div>
        <form
          class="billing-email-card__form"
          @submit.prevent="onSaveBillingEmail"
        >
          <input
            v-model.trim="billingEmailDraft"
            type="email"
            inputmode="email"
            autocomplete="email"
            spellcheck="false"
            class="billing-email-card__input"
            placeholder="example@gmail.com"
            :disabled="billingEmailSaving"
            :aria-label="'Email для сповіщень'"
            maxlength="254"
          />
          <button
            type="submit"
            class="billing-email-card__btn"
            :disabled="billingEmailSaving || !isBillingEmailDirty"
          >
            {{
              billingEmailSaving
                ? 'Зберігаємо…'
                : isBillingEmailDirty
                  ? 'Зберегти'
                  : 'Збережено'
            }}
          </button>
        </form>
        <p
          v-if="billingEmailMessage"
          class="billing-email-card__msg"
          :class="
            billingEmailMessage.kind === 'ok'
              ? 'billing-email-card__msg--ok'
              : 'billing-email-card__msg--err'
          "
        >
          {{ billingEmailMessage.text }}
        </p>
      </section>

      <!--
        Pro pricing card. Visual structure mirrors Coin Hub's `PricingPlanCard`
        (Pro variant) — gold gradient ring + animated radial light + crown
        bullets + gold CTA. CSS is scoped to this file so we don't reach into
        the Coin Hub component, but the core gold-CTA classes are shared via
        `coinhub-design-system.css`.
      -->
      <article class="ppc ppc--pro">
        <div class="ppc__badge ppc__badge--best" aria-hidden="true">BEST VALUE</div>
        <div class="ppc__pro-ring">
          <div class="ppc__pro-surface">
            <div class="ppc__inner">
              <h2 class="ppc__title">StreamAssist Pro</h2>
              <p class="ppc__price">
                <template v-if="priceLabel">
                  <strong>{{ priceLabel }}</strong>
                  <span v-if="durationLabel"> · {{ durationLabel }}</span>
                </template>
                <span
                  v-else-if="isPricingUnavailable"
                  class="ppc__price--unavailable"
                >
                  Ціна тимчасово недоступна
                </span>
                <span v-else class="ppc__price--loading" aria-hidden="true">…</span>
              </p>

              <p
                class="ppc__chat ppc__chat--pro"
                aria-hidden="true"
              >
                streamassist 👑 Pro
              </p>

              <ul class="ppc__feats" role="list">
                <li v-for="f in FEATURES" :key="f" class="ppc__feat ppc__feat--pro">
                  <span
                    class="ppc__feat-lead ppc__feat-lead--pro"
                    aria-hidden="true"
                  >
                    <span class="ppc__feat-crown">👑</span>
                  </span>
                  <div class="ppc__feat-body">
                    <span class="ppc__feat-text">{{ f }}</span>
                  </div>
                </li>
              </ul>

              <button
                type="button"
                class="ch-coinhub-gold-cta ch-coinhub-gold-cta--label-light ch-coinhub-gold-cta--glow-pro ch-coinhub-gold-cta--glow-pro-cta ppc__buy ppc__cta--sized"
                :disabled="isCtaDisabled"
                @click="openCheckout"
              >
                {{ ctaLabel }}
              </button>

              <p
                v-if="!isJarConfigured && isPricingReady"
                class="ppc__legal ppc__legal--warn"
              >
                Платежі тимчасово недоступні. Спробуйте, будь ласка, пізніше.
              </p>
              <p
                v-else-if="isPricingUnavailable"
                class="ppc__legal ppc__legal--warn"
              >
                Не вдалося завантажити поточну ціну. Спробуйте оновити сторінку
                через хвилину.
              </p>
              <p v-else class="ppc__legal">
                Натискаючи «{{ ctaLabel }}», ви відкриєте сторінку monobank
                Banka в новій вкладці. StreamAssist не зберігає дані картки і
                не списує оплату повторно.
              </p>
            </div>
          </div>
        </div>
      </article>
    </section>

    <JarPaymentModal
      v-if="modalOpen"
      :open="modalOpen"
      :kind="flow.kind.value"
      :request="flow.request.value"
      :error="flow.error.value"
      :is-busy="flow.isBusy.value"
      :is-polling="flow.isPolling.value"
      :duration-label="billingConfig.durationLabel.value"
      :expires-at-formatted="requestExpiresAtFormatted"
      :active-until-formatted="subscriptionExpiresAtFormatted"
      @close="onClose"
      @mark-paid="onMarkPaid"
      @retry-create="onRetryCreate"
      @go-pro="onGoPro"
    />
  </AppContainer>
</template>

<style scoped>




.billing-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-block: 2rem;
}

.billing-page__hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.billing-page__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.78rem;
  color: rgba(255, 220, 130, 0.85);
  margin: 0;
  text-shadow: 0 0 14px rgba(255, 200, 80, 0.45);
}

.billing-page__title {
  font-size: clamp(1.8rem, 3.4vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  background: linear-gradient(135deg, #fff7ed 0%, #fde68a 35%, #fbbf24 70%, #f59e0b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(255, 200, 80, 0.35));
}

.billing-page__subtitle {
  margin: 0 auto;
  max-width: 60ch;
  color: color-mix(in srgb, var(--sa-color-text-main, #fff) 70%, transparent);
}

.billing-page__status {
  border-radius: 14px;
  padding: 1rem 1.25rem;
  border: 1px solid transparent;
  margin: 0 auto;
  max-width: 28rem;
  width: 100%;
}

.billing-page__status--active {
  background: linear-gradient(135deg, rgba(48, 161, 78, 0.18), rgba(28, 100, 50, 0.16));
  border-color: rgba(48, 161, 78, 0.45);
  color: #d4f5dc;
  box-shadow: 0 0 28px rgba(48, 161, 78, 0.18);
}

.billing-page__status--lapsed {
  background: linear-gradient(135deg, rgba(212, 138, 0, 0.16), rgba(140, 90, 0, 0.14));
  border-color: rgba(212, 138, 0, 0.45);
  color: #ffe8b8;
}

.billing-page__status-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  letter-spacing: 0.01em;
}

.billing-page__status-crown {
  font-size: 1rem;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.55));
}

.billing-page__status-text {
  margin: 0;
}

/* ============================================================================
   Pro premium card — port of Coin Hub `.ppc--pro` (PricingPlanCard.vue)
   structure. Kept scoped to this page to avoid coupling with the Coin Hub
   component internals. Updates to the Coin Hub design system come through
   `ch-coinhub-gold-cta*` (imported above) automatically.
   ========================================================================== */

.ppc {
  position: relative;
  display: flex;
  min-width: 0;
  margin: 1rem auto 0;
  width: 100%;
  max-width: 26rem;
  flex-direction: column;
  border-radius: 20px;
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.28s cubic-bezier(0.22, 1, 0.36, 1);
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
  transform: translateY(-6px);
  filter: drop-shadow(0 0 28px rgba(255, 200, 100, 0.72));
}

@media (prefers-reduced-motion: reduce) {
  .ppc--pro,
  .ppc--pro:hover {
    transform: none;
    transition: filter 0.2s ease;
  }
}

.ppc__pro-ring {
  position: relative;
  z-index: 1;
  display: flex;
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
  transition: box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1);
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
}

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
}

@media (prefers-reduced-motion: reduce) {
  .ppc--pro::before {
    animation: none;
    opacity: 0.4;
  }
}

.ppc__pro-surface {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border-radius: 17px;
  background: linear-gradient(180deg, rgba(32, 22, 10, 0.96) 0%, rgba(6, 8, 18, 0.99) 100%);
}

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
  flex: 1 1 auto;
  flex-direction: column;
  padding: 1.4rem 1.25rem 1.25rem;
}

.ppc__badge {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 4;
  border-radius: 999px;
  padding: 0.32rem 0.6rem;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.2;
  text-align: center;
  pointer-events: none;
}

.ppc__badge--best {
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

.ppc__title {
  margin: 0 0 0.45rem;
  padding-right: 6.5rem;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
}

.ppc__price {
  margin: 0 0 0.85rem;
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f3e8ff;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
}

.ppc__price strong {
  font-size: 1.6rem;
  background: linear-gradient(135deg, #fff7ed, #fde68a 35%, #fbbf24);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 10px rgba(255, 200, 80, 0.35));
}

.ppc__price--unavailable {
  color: #ffd28a;
  font-weight: 700;
}

.ppc__price--loading {
  color: rgba(255, 255, 255, 0.4);
}

.ppc__chat {
  display: block;
  border-radius: 10px;
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
  letter-spacing: 0.02em;
  line-height: 1.35;
  margin-bottom: 0.2rem;
}

.ppc__chat--pro {
  color: #fef3c7;
  border: 1px solid rgba(251, 191, 36, 0.45);
  text-shadow: 0 0 14px rgba(251, 191, 36, 0.25);
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.5), rgba(50, 35, 8, 0.55));
}

.ppc__feats {
  margin: 0;
  flex: 1 1 auto;
  list-style: none;
  padding: 0.95rem 0;
}

.ppc__feat {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.ppc__feat + .ppc__feat {
  margin-top: 0.55rem;
}

.ppc__feat-lead {
  display: flex;
  flex-shrink: 0;
  width: 1.2rem;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0.12rem;
}

.ppc__feat-crown {
  display: block;
  font-size: 0.85rem;
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.45));
}

.ppc__feat-body {
  min-width: 0;
  flex: 1;
}

.ppc__feat-text {
  display: block;
  font-size: 0.875rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.85);
}

.ppc__buy {
  box-sizing: border-box;
  margin-top: auto;
  padding-top: 28px;
}

.ppc__buy.ppc__cta--sized,
.ppc__buy.ch-coinhub-gold-cta.ppc__cta--sized {
  min-height: 56px;
  height: 56px;
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}

:deep(.ppc__buy.ch-coinhub-gold-cta:hover:enabled) {
  transform: translateY(-3px) scale(1.03);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.ppc__buy.ch-coinhub-gold-cta:hover:enabled) {
    transform: none;
  }
}

.ppc__legal {
  margin: 0.7rem 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.55);
}

.ppc__legal--warn {
  color: #ffd28a;
}





.billing-email-card {
  margin: 0 auto;
  max-width: 28rem;
  width: 100%;
  border-radius: 16px;
  padding: 1.1rem 1.25rem 1.25rem;
  background: linear-gradient(
    180deg,
    rgba(36, 28, 70, 0.55) 0%,
    rgba(8, 6, 18, 0.7) 100%
  );
  border: 1px solid rgba(167, 139, 250, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 14px 40px rgba(8, 6, 18, 0.35);
}

.billing-email-card__head {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.85rem;
}

.billing-email-card__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #f5f3ff;
}

.billing-email-card__hint {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.62);
}

.billing-email-card__form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.billing-email-card__input {
  flex: 1 1 16rem;
  min-width: 0;
  appearance: none;
  border-radius: 10px;
  border: 1px solid rgba(167, 139, 250, 0.32);
  padding: 0.65rem 0.85rem;
  background: rgba(11, 7, 22, 0.7);
  color: #f5f3ff;
  font-size: 0.9rem;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.billing-email-card__input::placeholder {
  color: rgba(196, 181, 253, 0.4);
}

.billing-email-card__input:focus {
  outline: 2px solid rgba(196, 181, 253, 0.65);
  outline-offset: 1px;
  border-color: rgba(196, 181, 253, 0.6);
  background: rgba(20, 14, 38, 0.85);
}

.billing-email-card__input:disabled {
  opacity: 0.6;
  cursor: progress;
}

.billing-email-card__btn {
  appearance: none;
  border-radius: 10px;
  border: 1px solid rgba(167, 139, 250, 0.5);
  padding: 0 1.1rem;
  min-height: 2.4rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 0.85rem;
  color: #faf5ff;
  background: linear-gradient(145deg, #7c3aed 0%, #5b21b6 60%, #4c1d95 100%);
  box-shadow:
    0 0 0 1px rgba(139, 92, 246, 0.35),
    0 0 22px rgba(124, 58, 237, 0.32),
    0 6px 18px rgba(40, 20, 80, 0.45);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    filter 0.18s ease;
}

.billing-email-card__btn:hover:not([disabled]) {
  transform: translateY(-1px);
  filter: brightness(1.08);
}

.billing-email-card__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.billing-email-card__msg {
  margin: 0.55rem 0 0;
  font-size: 0.82rem;
}

.billing-email-card__msg--ok {
  color: #b8f5cf;
}

.billing-email-card__msg--err {
  color: #ffb4b4;
}

@media (prefers-reduced-motion: reduce) {
  .billing-email-card__btn,
  .billing-email-card__btn:hover:not([disabled]) {
    transform: none;
    transition: filter 0.15s ease;
  }
}
</style>
