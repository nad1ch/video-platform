<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'
import { parseAuthMode } from '@/utils/parseAuthMode'
import { replaceAuthQuery } from '@/utils/authRouteQuery'
import type { AuthMode } from '@/types/authMode'
import LoginForm from '@/components/auth/LoginForm.vue'
import ForgotForm from '@/components/auth/ForgotForm.vue'

const props = defineProps<{
  redirectPath: string
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { loginWithTwitch, loginWithGoogle } = useAuth()

const mode = computed<AuthMode>(() => {
  const m = route.query.mode
  const s = Array.isArray(m) ? m[0] : m
  return parseAuthMode(s)
})

const redirectForOAuth = computed(() => safeOAuthRedirectPath(props.redirectPath))

/** Signup tab removed: normalize legacy `?mode=signup` URLs to login. */
watch(
  () => route.query.mode,
  () => {
    const raw = route.query.mode
    const s = Array.isArray(raw) ? raw[0] : raw
    if (s === 'signup') {
      void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'login') })
    }
  },
  { immediate: true },
)

function onTwitch(): void {
  loginWithTwitch(redirectForOAuth.value)
}

function onGoogle(): void {
  loginWithGoogle(redirectForOAuth.value)
}

function goLoginFromSuccess(): void {
  void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'login') })
}
</script>

<template>
  <div class="auth-form">
    <div v-if="mode === 'forgot-success'" class="auth-form-panel" role="status">
      <h2 class="auth-form-title">{{ t('app.authForgotSuccessTitle') }}</h2>
      <p class="auth-form-lead">{{ t('app.authForgotSuccessBody') }}</p>
      <AppButton variant="primary" type="button" class="auth-form-back-btn" @click="goLoginFromSuccess">
        {{ t('app.authBackToSignIn') }}
      </AppButton>
    </div>

    <template v-else-if="mode === 'forgot'">
      <div class="auth-form-panel">
        <h2 class="auth-form-title">{{ t('app.authForgotTitle') }}</h2>
        <ForgotForm />
      </div>
    </template>

    <template v-else>
      <div class="auth-form-stack">
        <div class="auth-form-oauth">
          <div class="auth-form-twitch-block">
            <p class="auth-form-twitch-hint">{{ t('app.authTwitchHint') }}</p>
            <AppButton
              variant="primary"
              type="button"
              class="auth-form-oauth-btn auth-form-oauth-btn--twitch auth-form-oauth-btn--full"
              @click="onTwitch"
            >
              {{ t('app.authLoginTwitch') }}
            </AppButton>
          </div>
          <AppButton
            variant="secondary"
            type="button"
            class="auth-form-oauth-btn auth-form-oauth-btn--google auth-form-oauth-btn--full"
            @click="onGoogle"
          >
            {{ t('app.authLoginGoogle') }}
          </AppButton>
        </div>

        <div class="auth-form-divider" role="separator">
          <span class="auth-form-divider__line" aria-hidden="true" />
          <span class="auth-form-divider__text">{{ t('app.authOr') }}</span>
          <span class="auth-form-divider__line" aria-hidden="true" />
        </div>

        <LoginForm :redirect-path="redirectPath" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.auth-form {
  --af-space-2: 0.5rem;
  --af-space-3: 0.75rem;
  --af-space-4: 1rem;
  --af-space-6: 1.5rem;

  width: 100%;
}

.auth-form-panel {
  display: flex;
  flex-direction: column;
  gap: var(--af-space-4);
}

.auth-form-title {
  margin: 0;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-heading, var(--sa-color-text-main));
}

.auth-form-lead {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text-body, var(--sa-color-text-body));
}

.auth-form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--af-space-4);
}

.auth-form-oauth {
  display: flex;
  flex-direction: column;
  gap: var(--af-space-4);
}

.auth-form-twitch-block {
  display: flex;
  flex-direction: column;
  gap: var(--af-space-2);
}

.auth-form-twitch-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--af-space-2);
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: 0.045em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--sa-color-primary) 42%, var(--sa-color-text-strong));
}

.auth-form-twitch-hint::before {
  content: '';
  flex-shrink: 0;
  width: 0.35rem;
  height: 0.35rem;
  margin-top: 0.35em;
  border-radius: 50%;
  background: color-mix(in srgb, var(--sa-color-primary) 72%, var(--sa-color-text-strong));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sa-color-primary) 28%, transparent);
}

.auth-form-oauth-btn--full {
  width: 100%;
  justify-content: center;
}

/* Twitch: primary CTA — larger, gradient, glow (tokens only) */
:deep(.auth-form-oauth-btn--twitch.app-btn) {
  min-height: 3rem;
  padding: 0.65rem 1rem;
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-radius: var(--sa-radius-md);
  border-color: var(--sa-color-primary-border);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--sa-color-primary) 92%, #1e1b4b) 0%,
    color-mix(in srgb, var(--sa-color-primary) 48%, var(--sa-color-bg-deep)) 100%
  );
  color: var(--sa-color-text-strong);
  box-shadow:
    0 4px 18px color-mix(in srgb, var(--sa-color-primary) 38%, transparent),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 22%, transparent);
}

:deep(.auth-form-oauth-btn--twitch.app-btn:hover:not(:disabled)) {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--sa-color-primary) 100%, #312e81) 0%,
    color-mix(in srgb, var(--sa-color-primary) 58%, var(--sa-color-bg-deep)) 100%
  );
  box-shadow:
    0 6px 24px color-mix(in srgb, var(--sa-color-primary) 48%, transparent),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 40%, transparent);
}

/* Google: secondary — same radius, quieter */
:deep(.auth-form-oauth-btn--google.app-btn) {
  min-height: 2.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 88%, transparent);
  border-color: color-mix(in srgb, var(--sa-color-border) 95%, transparent);
}

:deep(.auth-form-oauth-btn--google.app-btn:hover:not(:disabled)) {
  border-color: var(--sa-color-primary-border);
  color: var(--sa-color-primary);
}

.auth-form-divider {
  display: flex;
  align-items: center;
  gap: var(--af-space-3);
  margin: 0;
}

.auth-form-divider__line {
  flex: 1 1 0;
  min-width: 0;
  height: 1px;
  background: color-mix(in srgb, var(--sa-color-border) 88%, transparent);
}

.auth-form-divider__text {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted, var(--sa-color-text-muted));
}

.auth-form-email-lead {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--sa-color-text-muted) 92%, var(--sa-color-text-main));
}

:deep(.auth-form-back-btn.app-btn) {
  width: 100%;
  justify-content: center;
  min-height: 2.5rem;
  border-radius: var(--sa-radius-sm);
}
</style>
