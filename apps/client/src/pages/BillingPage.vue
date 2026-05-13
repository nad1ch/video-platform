<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import JarPaymentModal from '@/components/billing/JarPaymentModal.vue'
import { useProSubscription } from '@/composables/useProSubscription'
import { useJarBillingFlow } from '@/composables/useJarBillingFlow'
import { refreshBillingConfig, useBillingConfig } from '@/composables/useBillingConfig'
import { updateBillingEmail } from '@/services/billingApi'
import { subscriptionState } from '@/composables/useProSubscription'
import '@/styles/coinhub-design-system.css'

const {
  subscription,
  isProActive,
  expiresAt,
  refreshSubscription,
  billingEmail: subscriptionBillingEmail,
} = useProSubscription()
const flow = useJarBillingFlow()
const billingConfig = useBillingConfig()

const modalOpen = ref(false)

const billingEmailDraft = ref('')
const billingEmailSaving = ref(false)
const billingEmailError = ref<string | null>(null)

watch(
  subscriptionBillingEmail,
  (next, prev) => {
    if (next !== prev && billingEmailDraft.value.length === 0) {
      billingEmailDraft.value = next ?? ''
    }
  },
  { immediate: true },
)

const isBillingEmailDirty = computed(() => {
  const draft = billingEmailDraft.value.trim().toLowerCase()
  const current = (subscriptionBillingEmail.value ?? '').toLowerCase()
  return draft !== current
})

async function onSaveBillingEmail(): Promise<void> {
  if (billingEmailSaving.value) return
  if (!isBillingEmailDirty.value) return
  billingEmailSaving.value = true
  billingEmailError.value = null
  try {
    const r = await updateBillingEmail(billingEmailDraft.value.trim())
    if (!r.ok) {
      billingEmailError.value =
        r.code === 'INVALID_EMAIL'
          ? 'Невірний формат пошти.'
          : `Не вдалося зберегти: ${r.message}`
      return
    }
    subscriptionState.value = r.data
  } finally {
    billingEmailSaving.value = false
  }
}

const FEATURES: string[] = [
  'безлімітні кімнати відеодзвінків',
  'доступ до OBS оверлеїв',
  'доступ до всіх ігор',
  'розширений набір ігрових інструментів стрімера',
  'пріоритетна підтримка',
]

const OLD_PRICE_LABEL = '599'

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

const priceAmount = computed(() => billingConfig.config.value?.amountUah ?? null)
const priceDurationLabel = computed(() => {
  const days = billingConfig.config.value?.durationDays
  if (!days) return null
  if (days === 30) return 'місяць'
  return `${days} днів`
})
const isPricingReady = computed(() => billingConfig.isReady.value)
const isPricingUnavailable = computed(
  () => !billingConfig.loading.value && !billingConfig.isReady.value,
)
const isJarConfigured = computed(() => billingConfig.jarConfigured.value)

const isCtaDisabled = computed(
  () => modalOpen.value || flow.isBusy.value || !isPricingReady.value || !isJarConfigured.value,
)

async function openCheckout(): Promise<void> {
  if (isCtaDisabled.value) return
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
  void refreshSubscription()
  void refreshBillingConfig()
})
</script>

<template>
  <AppContainer>
    <section class="billing-page">
      <p class="billing-page__subtitle">
        Розширений доступ до інструментів стрімера. Одноразова оплата через
        monobank - без підписки і без автосписання.
      </p>

      <div
        v-if="isProActive"
        class="billing-page__status billing-page__status--active"
        role="status"
      >
        <span class="billing-page__status-crown" aria-hidden="true">
          <svg viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 4.5L6 9l6-7 6 7 4-4.5L20 16H4L2 4.5z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>Pro активний{{ subscriptionExpiresAtFormatted ? ` · до ${subscriptionExpiresAtFormatted}` : '' }}</span>
      </div>
      <div
        v-else-if="subscription && subscription.status === 'expired'"
        class="billing-page__status billing-page__status--lapsed"
        role="status"
      >
        <span>Pro закінчився{{ subscriptionExpiresAtFormatted ? ` · ${subscriptionExpiresAtFormatted}` : '' }}</span>
      </div>

      <section class="billing-email-card" aria-labelledby="billing-email-title">
        <h2 id="billing-email-title" class="billing-email-card__title">
          Email для сповіщення
        </h2>
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
            placeholder="example@gmail.com..."
            :disabled="billingEmailSaving"
            aria-label="Email для сповіщення"
            maxlength="254"
            @blur="onSaveBillingEmail"
          />
        </form>
        <p v-if="billingEmailError" class="billing-email-card__msg">
          {{ billingEmailError }}
        </p>
      </section>

      <article
        class="pro-card"
        :class="{ 'pro-card--clickable': !isCtaDisabled }"
        role="button"
        tabindex="0"
        :aria-disabled="isCtaDisabled || undefined"
        @click="openCheckout"
        @keydown.enter.prevent="openCheckout"
        @keydown.space.prevent="openCheckout"
      >
        <div class="pro-card__inner">
          <h2 class="pro-card__title">
            <span class="pro-card__title-text">PRO</span>
            <span class="pro-card__title-crown" aria-hidden="true">
              <svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="proCrownGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#fff7ed" />
                    <stop offset="40%" stop-color="#fde68a" />
                    <stop offset="100%" stop-color="#f59e0b" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 12 L16 26 L32 4 L48 26 L60 12 L54 44 L10 44 Z"
                  fill="url(#proCrownGrad)"
                  stroke="#f59e0b"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <circle cx="32" cy="22" r="2.6" fill="#7c2d12" />
                <circle cx="14" cy="30" r="2" fill="#7c2d12" />
                <circle cx="50" cy="30" r="2" fill="#7c2d12" />
              </svg>
            </span>
          </h2>

          <div class="pro-card__price">
            <span v-if="priceAmount" class="pro-card__price-old" aria-hidden="true">
              {{ OLD_PRICE_LABEL }}
            </span>
            <span class="pro-card__price-row">
              <template v-if="priceAmount">
                <span class="pro-card__price-currency">₴</span>
                <span class="pro-card__price-amount">{{ priceAmount }}</span>
                <span v-if="priceDurationLabel" class="pro-card__price-duration">
                  / {{ priceDurationLabel }}
                </span>
              </template>
              <span
                v-else-if="isPricingUnavailable"
                class="pro-card__price-unavailable"
              >
                Ціна тимчасово недоступна
              </span>
              <span v-else class="pro-card__price-loading" aria-hidden="true">…</span>
            </span>
          </div>

          <ul class="pro-card__feats" role="list">
            <li v-for="f in FEATURES" :key="f" class="pro-card__feat">
              <span class="pro-card__feat-crown" aria-hidden="true">
                <svg viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M2 4.5L6 9l6-7 6 7 4-4.5L20 16H4L2 4.5z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="pro-card__feat-text">{{ f }}</span>
            </li>
          </ul>

          <p
            v-if="!isJarConfigured && isPricingReady"
            class="pro-card__hint pro-card__hint--warn"
          >
            Платежі тимчасово недоступні. Спробуйте пізніше.
          </p>
        </div>
      </article>
    </section>

    <JarPaymentModal
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
  align-items: center;
  gap: 1.4rem;
  padding-block: 1.5rem 3rem;
}

.billing-page__subtitle {
  margin: 0 auto;
  max-width: 56ch;
  text-align: center;
  color: rgba(255, 255, 255, 0.78);
  font-size: 1rem;
  line-height: 1.45;
}

.billing-page__status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.billing-page__status--active {
  color: #ffe9a8;
  background: rgba(120, 75, 12, 0.32);
  border: 1px solid rgba(255, 200, 80, 0.45);
  box-shadow: 0 0 22px rgba(255, 200, 80, 0.18);
}

.billing-page__status--lapsed {
  color: #ffd28a;
  background: rgba(80, 50, 10, 0.32);
  border: 1px solid rgba(212, 138, 0, 0.4);
}

.billing-page__status-crown {
  display: inline-flex;
  width: 18px;
  height: 14px;
  color: #fde68a;
}

.billing-page__status-crown svg {
  width: 100%;
  height: 100%;
}

.billing-email-card {
  width: 100%;
  max-width: 32rem;
  border-radius: 22px;
  padding: 1.4rem 1.6rem 1.5rem;
  background: rgba(8, 4, 22, 0.45);
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 22px 60px rgba(8, 6, 18, 0.45);
}

.billing-email-card__title {
  margin: 0 0 0.85rem;
  text-align: center;
  font-family: var(--sa-font-display, 'Climate Crisis'), system-ui, sans-serif;
  font-weight: 400;
  font-size: 1.35rem;
  letter-spacing: 0.04em;
  color: #fff;
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.18);
}

.billing-email-card__form {
  display: flex;
}

.billing-email-card__input {
  flex: 1 1 auto;
  min-width: 0;
  appearance: none;
  border-radius: 999px;
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  padding: 0.75rem 1.1rem;
  background: rgba(11, 7, 22, 0.35);
  color: #f5f3ff;
  font-size: 0.95rem;
  text-align: center;
  letter-spacing: 0.01em;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.billing-email-card__input::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.billing-email-card__input:focus {
  outline: none;
  border-color: rgba(255, 220, 130, 0.85);
  box-shadow: 0 0 0 2px rgba(255, 200, 80, 0.25);
  background: rgba(20, 14, 38, 0.5);
}

.billing-email-card__input:disabled {
  opacity: 0.6;
  cursor: progress;
}

.billing-email-card__msg {
  margin: 0.55rem 0 0;
  font-size: 0.82rem;
  color: #ffb4b4;
  text-align: center;
}

.pro-card {
  position: relative;
  display: block;
  width: 100%;
  max-width: 32rem;
  border-radius: 22px;
  padding: 0;
  background: rgba(8, 4, 22, 0.55);
  border: 2px solid rgba(255, 217, 80, 0.95);
  box-shadow:
    0 0 0 1px rgba(255, 220, 100, 0.45),
    0 0 36px rgba(255, 200, 70, 0.42),
    0 0 72px rgba(255, 170, 40, 0.28),
    0 22px 60px rgba(8, 6, 18, 0.55);
  cursor: default;
  transition:
    transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.pro-card--clickable {
  cursor: pointer;
}

.pro-card--clickable:hover,
.pro-card--clickable:focus-visible {
  transform: translateY(-3px);
  box-shadow:
    0 0 0 1px rgba(255, 230, 140, 0.6),
    0 0 52px rgba(255, 215, 90, 0.65),
    0 0 90px rgba(255, 175, 50, 0.4),
    0 28px 68px rgba(8, 6, 18, 0.6);
}

.pro-card:focus-visible {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .pro-card,
  .pro-card--clickable:hover,
  .pro-card--clickable:focus-visible {
    transform: none;
    transition: box-shadow 0.2s ease;
  }
}

.pro-card__inner {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.6rem 1.8rem 1.8rem;
}

.pro-card__title {
  margin: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.45rem;
  font-family: var(--sa-font-display, 'Climate Crisis'), system-ui, sans-serif;
  font-weight: 400;
  font-size: 3.2rem;
  letter-spacing: 0.02em;
  line-height: 1;
}

.pro-card__title-text {
  background: linear-gradient(135deg, #fff7ed 0%, #fde68a 35%, #fbbf24 70%, #f59e0b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 22px rgba(255, 200, 80, 0.55));
}

.pro-card__title-crown {
  display: inline-flex;
  width: 2.2rem;
  height: 1.6rem;
  margin-bottom: 0.6rem;
  filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.6));
}

.pro-card__title-crown svg {
  width: 100%;
  height: 100%;
}

.pro-card__price {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.05rem;
  margin: 0.1rem 0 0.3rem;
}

.pro-card__price-old {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.55);
  text-decoration: line-through;
  letter-spacing: 0.01em;
}

.pro-card__price-row {
  display: inline-flex;
  align-items: baseline;
  gap: 0.32rem;
  font-variant-numeric: tabular-nums;
}

.pro-card__price-currency {
  font-size: 1.6rem;
  font-weight: 800;
  background: linear-gradient(135deg, #fff7ed, #fde68a 35%, #fbbf24);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 10px rgba(255, 200, 80, 0.4));
}

.pro-card__price-amount {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.01em;
}

.pro-card__price-duration {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.pro-card__price-unavailable {
  color: #ffd28a;
  font-weight: 700;
}

.pro-card__price-loading {
  color: rgba(255, 255, 255, 0.4);
}

.pro-card__feats {
  margin: 0.5rem 0 0;
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  align-items: flex-start;
  align-self: center;
}

.pro-card__feat {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.95rem;
  line-height: 1.3;
}

.pro-card__feat-crown {
  display: inline-flex;
  width: 1.1rem;
  height: 0.85rem;
  color: #fbbf24;
  flex: none;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.45));
}

.pro-card__feat-crown svg {
  width: 100%;
  height: 100%;
}

.pro-card__feat-text {
  letter-spacing: 0.005em;
}

.pro-card__hint {
  margin: 0.7rem 0 0;
  font-size: 0.85rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
}

.pro-card__hint--warn {
  color: #ffd28a;
}

@media (max-width: 600px) {
  .pro-card__title {
    font-size: 2.6rem;
  }
  .pro-card__title-crown {
    width: 1.8rem;
    height: 1.3rem;
  }
  .pro-card__inner {
    padding: 1.3rem 1.3rem 1.5rem;
  }
  .billing-email-card {
    padding: 1.1rem 1.1rem 1.2rem;
  }
}
</style>
