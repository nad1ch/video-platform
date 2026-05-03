<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { PaymentRequestDto } from '@/services/billingApi'
import type { BillingFlowError, BillingFlowKind } from '@/composables/useJarBillingFlow'

/**
 * Presentational modal for the monobank Jar/Banka payment flow.
 *
 * - Never iframes the Jar page (rule).
 * - Never asks the user for a payment code/comment (rule).
 * - Opens the Jar link in a NEW TAB via a real `<a target="_blank">` so the
 *   browser handles passkey/biometric flows natively.
 * - All buttons disabled while parent flow is busy (no double-submits).
 * - All copy is plain Ukrainian — no Russian (project rule).
 */

const props = withDefaults(
  defineProps<{
    open: boolean
    kind: BillingFlowKind
    request: PaymentRequestDto | null
    error: BillingFlowError | null
    isBusy: boolean
    /**
     * True while the parent flow is actively polling request status. The
     * "I paid" button is disabled during this window so duplicate clicks
     * cannot fan out, but the close button stays enabled (per UX spec —
     * user must always be able to dismiss the modal).
     */
    isPolling: boolean
    /**
     * Human-readable duration suffix from `useBillingConfig`, e.g. "30 днів".
     * Comes from server config (`PRO_DURATION_DAYS`) — the modal does NOT
     * hardcode "30 днів" any more. When `null`, the duration line is hidden.
     */
    durationLabel: string | null
    expiresAtFormatted: string | null
    activeUntilFormatted: string | null
  }>(),
  {
    request: null,
    error: null,
    isPolling: false,
    durationLabel: null,
    expiresAtFormatted: null,
    activeUntilFormatted: null,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'mark-paid'): void
  (e: 'retry-create'): void
  (e: 'go-pro'): void
}>()

const showCloseButton = computed(() => props.kind !== 'creating')

const isSuccess = computed(
  () => props.kind === 'auto_matched' || props.kind === 'approved',
)
const isReview = computed(() => props.kind === 'needs_review')
const isRejected = computed(() => props.kind === 'rejected')
const isExpired = computed(() => props.kind === 'expired')
const isErrorState = computed(() => props.kind === 'error')
const isPayable = computed(
  () => props.kind === 'awaiting_payment' || props.kind === 'submitting_check' || props.kind === 'checking',
)

function onBackdropClick(): void {
  if (props.isBusy) return
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (!props.open) return
  if (e.key === 'Escape' && showCloseButton.value && !props.isBusy) {
    emit('close')
  }
}

watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport v-if="open" to="body">
    <div
      class="jar-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jar-modal-title"
      @click.self="onBackdropClick"
    >
      <div class="jar-modal__shell">
        <header class="jar-modal__header">
          <h2 id="jar-modal-title" class="jar-modal__title">StreamAssist Pro</h2>
          <button
            v-if="showCloseButton"
            type="button"
            class="jar-modal__close"
            :disabled="isBusy"
            aria-label="Закрити"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="jar-modal__body">
          
          <template v-if="kind === 'creating'">
            <div class="jar-modal__state">
              <div class="jar-modal__spinner" aria-hidden="true" />
              <p>Готуємо рахунок monobank…</p>
            </div>
          </template>

          
          <template v-else-if="isPayable">
            <!--
              Price + currency are read from the server-issued PaymentRequestDto
              (persisted at create time, so existing requests keep their original
              amount even if PRO_PRICE_UAH changed later). Duration label comes
              from server billing config via the parent. No hardcoded fallbacks
              — if the data is unavailable for any reason, we degrade quietly.
            -->
            <p v-if="request" class="jar-modal__price">
              <strong>{{ request.amountUah }} {{ request.currency }}</strong>
              <span v-if="durationLabel"> · {{ durationLabel }}</span>
            </p>

            <ol class="jar-modal__steps">
              <li>
                Натисніть «Сплатити в monobank» — посилання на банку monobank
                відкриється в новій вкладці.
              </li>
              <li>
                Поверніться сюди й натисніть «Я оплатив, перевірити платіж».
              </li>
              <li>
                Ми спробуємо підтвердити платіж автоматично. Якщо це неможливо
                зробити безпечно, заявка піде на ручний перегляд.
              </li>
            </ol>

            <p class="jar-modal__hint">
              Не потрібно копіювати або вводити жодних кодів. Просто оплатіть і
              поверніться сюди.
            </p>

            <div class="jar-modal__actions">
              <a
                v-if="request?.jarUrl"
                class="jar-modal__btn jar-modal__btn--primary"
                :href="request.jarUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Сплатити в monobank
              </a>
              <button
                type="button"
                class="jar-modal__btn"
                :disabled="isBusy || (kind === 'checking' && isPolling)"
                @click="emit('mark-paid')"
              >
                <span
                  v-if="kind === 'submitting_check' || (kind === 'checking' && isPolling)"
                  class="jar-modal__spinner jar-modal__spinner--inline"
                  aria-hidden="true"
                />
                {{
                  kind === 'submitting_check'
                    ? 'Перевіряємо…'
                    : kind === 'checking' && isPolling
                      ? 'Перевіряємо платіж…'
                      : kind === 'checking'
                        ? 'Перевірити ще раз'
                        : 'Я оплатив, перевірити платіж'
                }}
              </button>
            </div>

            <p
              v-if="expiresAtFormatted"
              class="jar-modal__expiry"
            >
              Заявка дійсна до <strong>{{ expiresAtFormatted }}</strong>.
            </p>

            <p v-if="kind === 'checking' && isPolling" class="jar-modal__notice">
              Платіж може з’явитися не миттєво — ми ще раз перевіримо
              автоматично. Можна закрити це вікно й повернутися пізніше.
            </p>
            <p v-else-if="kind === 'checking'" class="jar-modal__notice">
              Поки що не вдалося підтвердити платіж автоматично. Натисніть
              «Перевірити ще раз» або зачекайте — адміністратор перегляне
              заявку вручну.
            </p>
          </template>

          
          <template v-else-if="isReview">
            <div class="jar-modal__state jar-modal__state--review">
              <p class="jar-modal__state-title">Платіж на ручній перевірці</p>
              <p>
                Платіж очікує ручної перевірки адміністратором. Доступ
                відкриється після підтвердження.
              </p>
              <div class="jar-modal__actions">
                <button type="button" class="jar-modal__btn" @click="emit('close')">
                  Зрозуміло
                </button>
              </div>
            </div>
          </template>

          
          <template v-else-if="isSuccess">
            <div class="jar-modal__state jar-modal__state--success">
              <p class="jar-modal__state-title">StreamAssist Pro активовано</p>
              <p v-if="activeUntilFormatted">
                Доступ діє до <strong>{{ activeUntilFormatted }}</strong>.
              </p>
              <p v-else>Доступ Pro вже доступний.</p>
              <div class="jar-modal__actions">
                <button
                  type="button"
                  class="jar-modal__btn jar-modal__btn--primary"
                  @click="emit('go-pro')"
                >
                  Готово
                </button>
              </div>
            </div>
          </template>

          
          <template v-else-if="isRejected">
            <div class="jar-modal__state jar-modal__state--rejected">
              <p class="jar-modal__state-title">Платіж відхилено</p>
              <p>
                Адміністратор не зміг підтвердити цей платіж. Якщо це помилка —
                зверніться у підтримку.
              </p>
              <div class="jar-modal__actions">
                <button type="button" class="jar-modal__btn" @click="emit('close')">
                  Закрити
                </button>
              </div>
            </div>
          </template>

          
          <template v-else-if="isExpired">
            <div class="jar-modal__state jar-modal__state--expired">
              <p class="jar-modal__state-title">Час на оплату вийшов</p>
              <p>
                Створіть новий запит на оплату, щоб продовжити. Це не буде
                дублікатом — попередній запит уже закрито.
              </p>
              <div class="jar-modal__actions">
                <button
                  type="button"
                  class="jar-modal__btn jar-modal__btn--primary"
                  :disabled="isBusy"
                  @click="emit('retry-create')"
                >
                  Створити новий запит на оплату
                </button>
                <button type="button" class="jar-modal__btn" @click="emit('close')">
                  Закрити
                </button>
              </div>
            </div>
          </template>

          
          <template v-else-if="isErrorState">
            <div class="jar-modal__state jar-modal__state--error">
              <p class="jar-modal__state-title">Не вдалося відкрити оплату</p>
              <p v-if="error?.jarMisconfigured">
                Платежі тимчасово недоступні. Спробуйте, будь ласка, пізніше.
              </p>
              <p v-else-if="error?.code === 'UNAUTHORIZED'">
                Спочатку увійдіть в акаунт.
              </p>
              <p v-else>
                {{ error?.message || 'Невідома помилка. Спробуйте пізніше.' }}
              </p>
              <div class="jar-modal__actions">
                <button
                  v-if="!error?.jarMisconfigured && error?.code !== 'UNAUTHORIZED'"
                  type="button"
                  class="jar-modal__btn jar-modal__btn--primary"
                  :disabled="isBusy"
                  @click="emit('retry-create')"
                >
                  Спробувати ще раз
                </button>
                <button type="button" class="jar-modal__btn" @click="emit('close')">
                  Закрити
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.jar-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(8, 6, 18, 0.66);
  backdrop-filter: blur(2px);
  padding: 1rem;
}

.jar-modal__shell {
  width: 100%;
  max-width: 560px;
  background: var(--sa-color-surface, #fff);
  color: var(--sa-color-text-main, #111);
  border-radius: 18px;
  border: 1px solid var(--sa-color-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 24px 80px rgba(8, 6, 18, 0.45);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.jar-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--sa-color-border, rgba(0, 0, 0, 0.08)) 100%, transparent);
}

.jar-modal__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.jar-modal__close {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.5rem;
  line-height: 1;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  cursor: pointer;
}

.jar-modal__close:hover:not([disabled]) {
  background: color-mix(in srgb, var(--sa-color-text-main, #000) 8%, transparent);
}

.jar-modal__body {
  padding: 1.25rem 1.5rem 1.5rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.jar-modal__price {
  margin: 0;
  font-size: 1.05rem;
  color: color-mix(in srgb, var(--sa-color-text-main, #000) 80%, transparent);
}

.jar-modal__steps {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: color-mix(in srgb, var(--sa-color-text-main, #000) 78%, transparent);
}

.jar-modal__steps li {
  line-height: 1.45;
}

.jar-modal__hint {
  margin: 0;
  font-size: 0.92rem;
  color: color-mix(in srgb, var(--sa-color-text-main, #000) 60%, transparent);
}

.jar-modal__actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.jar-modal__btn {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--sa-color-border, rgba(0, 0, 0, 0.08)) 100%, transparent);
  background: color-mix(in srgb, var(--sa-color-surface-raised, #fff) 92%, transparent);
  color: inherit;
  font: inherit;
  font-weight: 600;
  padding: 0.7rem 1.1rem;
  border-radius: 999px;
  text-decoration: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
}

.jar-modal__btn:hover:not([disabled]) {
  border-color: color-mix(in srgb, var(--sa-color-primary-border, #5b6cff) 90%, transparent);
}

.jar-modal__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.jar-modal__btn--primary {
  background: #1c1f26;
  color: #ffd166;
  border-color: #1c1f26;
}

.jar-modal__btn--primary:hover:not([disabled]) {
  filter: brightness(1.1);
}

.jar-modal__expiry {
  margin: 0;
  font-size: 0.86rem;
  color: color-mix(in srgb, var(--sa-color-text-main, #000) 55%, transparent);
}

.jar-modal__notice {
  margin: 0;
  font-size: 0.86rem;
  color: color-mix(in srgb, var(--sa-color-text-main, #000) 60%, transparent);
}

.jar-modal__state {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  text-align: center;
  padding: 1rem 0.5rem 0;
}

.jar-modal__state p {
  margin: 0;
}

.jar-modal__state-title {
  font-weight: 700;
  font-size: 1.05rem;
}

.jar-modal__state--success .jar-modal__state-title {
  color: #1f6c33;
}
.jar-modal__state--review .jar-modal__state-title {
  color: #7a4a00;
}
.jar-modal__state--rejected .jar-modal__state-title,
.jar-modal__state--error .jar-modal__state-title {
  color: #8a1f1f;
}
.jar-modal__state--expired .jar-modal__state-title {
  color: #5a3a00;
}

.jar-modal__spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid color-mix(in srgb, var(--sa-color-text-main, #000) 18%, transparent);
  border-top-color: var(--sa-color-primary, #5b6cff);
  border-radius: 50%;
  animation: jar-spin 0.85s linear infinite;
}

.jar-modal__spinner--inline {
  width: 0.85rem;
  height: 0.85rem;
  border-width: 2px;
}

@keyframes jar-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .jar-modal__spinner {
    animation-duration: 1.6s;
  }
}
</style>
