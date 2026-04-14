<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'
import { useStreamAuthModal } from '@/composables/useStreamAuthModal'

const { t } = useI18n()
const { loginWithTwitch, loginWithGoogle } = useAuth()
const { modalOpen, redirectAfterAuth, closeStreamAuthModal } = useStreamAuthModal()

const email = ref('')
const password = ref('')
const showEmailSoon = ref(false)

function onBackdropClick(): void {
  closeStreamAuthModal()
  showEmailSoon.value = false
}

function onEmailSubmit(e: Event): void {
  e.preventDefault()
  showEmailSoon.value = true
}

function onTwitch(): void {
  loginWithTwitch(redirectAfterAuth.value)
}

function onGoogle(): void {
  loginWithGoogle(redirectAfterAuth.value)
}

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && modalOpen.value) {
    onBackdropClick()
  }
}

watch(modalOpen, (open) => {
  if (typeof document === 'undefined') {
    return
  }
  if (open) {
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown)
    showEmailSoon.value = false
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modalOpen"
      class="stream-auth-backdrop"
      role="presentation"
      @click.self="onBackdropClick"
    >
      <div
        class="stream-auth-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'stream-auth-title'"
      >
        <button
          type="button"
          class="stream-auth-close"
          :aria-label="t('app.authModalClose')"
          @click="onBackdropClick"
        >
          ×
        </button>

        <h2 id="stream-auth-title" class="stream-auth-title">{{ t('app.authModalTitle') }}</h2>
        <p class="stream-auth-lead">{{ t('app.authModalLead') }}</p>

        <div class="stream-auth-oauth">
          <AppButton variant="primary" type="button" class="stream-auth-oauth-btn" @click="onTwitch">
            {{ t('app.authLoginTwitch') }}
          </AppButton>
          <AppButton variant="secondary" type="button" class="stream-auth-oauth-btn" @click="onGoogle">
            {{ t('app.authLoginGoogle') }}
          </AppButton>
        </div>

        <p class="stream-auth-divider">{{ t('app.authOr') }}</p>

        <form class="stream-auth-email" @submit="onEmailSubmit">
          <label class="stream-auth-label">
            <span class="stream-auth-label-text">{{ t('app.authEmailLabel') }}</span>
            <input
              v-model="email"
              class="stream-auth-input"
              type="email"
              name="email"
              autocomplete="email"
              :placeholder="t('app.authEmailPlaceholder')"
            />
          </label>
          <label class="stream-auth-label">
            <span class="stream-auth-label-text">{{ t('app.authPasswordLabel') }}</span>
            <input
              v-model="password"
              class="stream-auth-input"
              type="password"
              name="password"
              autocomplete="current-password"
              :placeholder="t('app.authPasswordPlaceholder')"
            />
          </label>
          <AppButton variant="ghost" type="submit" class="stream-auth-email-btn">
            {{ t('app.authEmailContinue') }}
          </AppButton>
        </form>

        <p v-if="showEmailSoon" class="stream-auth-soon" role="status">
          {{ t('app.authEmailSoon') }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.stream-auth-backdrop {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}

.stream-auth-modal {
  position: relative;
  width: min(22rem, 100%);
  max-height: min(90vh, 32rem);
  overflow-y: auto;
  padding: 1.35rem 1.15rem 1.25rem;
  border-radius: 16px;
  border: 1px solid var(--border-strong, var(--sa-color-border));
  background: var(--bg-dropdown, var(--sa-color-bg-card));
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.45);
}

.stream-auth-close {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--sa-color-surface) 80%, transparent);
  color: var(--text-muted, var(--sa-color-text-muted));
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
}

.stream-auth-close:hover {
  color: var(--text-heading, var(--sa-color-text-main));
}

.stream-auth-title {
  margin: 0 1.75rem 0.35rem 0;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-heading, var(--sa-color-text-main));
}

.stream-auth-lead {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--text-body, var(--sa-color-text-body));
}

.stream-auth-oauth {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stream-auth-oauth-btn {
  width: 100%;
  justify-content: center;
}

.stream-auth-divider {
  margin: 1rem 0;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted, var(--sa-color-text-muted));
}

.stream-auth-email {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.stream-auth-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: left;
}

.stream-auth-label-text {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted, var(--sa-color-text-muted));
}

.stream-auth-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--border-input, var(--sa-color-border));
  background: var(--bg-input, color-mix(in srgb, var(--sa-color-surface) 90%, transparent));
  color: var(--text-heading, var(--sa-color-text-main));
  font-size: 0.88rem;
}

.stream-auth-input::placeholder {
  color: var(--text-muted, var(--sa-color-text-muted));
  opacity: 0.85;
}

.stream-auth-email-btn {
  margin-top: 0.15rem;
  align-self: center;
}

.stream-auth-soon {
  margin: 0.85rem 0 0;
  padding: 0.55rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-warning) 10%, var(--sa-color-surface));
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--sa-color-text-body);
}
</style>
