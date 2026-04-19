<script setup lang="ts">
import '@/eat-first/style.css'
import '@/eat-first/styles/theme.css'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthForm from '@/components/auth/AuthForm.vue'
import LandingCosmicBackdrop from '@/components/ui/LandingCosmicBackdrop.vue'
import PurpleLightningBackdrop from '@/components/ui/PurpleLightningBackdrop.vue'
import { useAuth } from '@/composables/useAuth'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'
import { useTheme } from '@/eat-first'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isAuthenticated, ensureAuthLoaded, loaded } = useAuth()
const { theme, setTheme } = useTheme()

const redirectPath = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app'
})

async function redirectIfAuthed(): Promise<void> {
  await ensureAuthLoaded()
  if (isAuthenticated.value) {
    await router.replace(safeOAuthRedirectPath(redirectPath.value))
  }
}

onMounted(() => {
  setTheme(theme.value)
  void redirectIfAuthed()
})

watch([loaded, isAuthenticated], () => {
  if (loaded.value && isAuthenticated.value) {
    void router.replace(safeOAuthRedirectPath(redirectPath.value))
  }
})
</script>

<template>
  <div class="auth-page eat-first-root page-stack" :data-theme="theme">
    <LandingCosmicBackdrop />
    <PurpleLightningBackdrop :light="theme === 'light'" />
    <div class="auth-page__surface">
      <div class="auth-page__inner">
        <header class="auth-page__head">
          <RouterLink
            class="auth-page__back"
            :to="{ path: '/' }"
            :aria-label="t('app.authBackHome')"
            :title="t('app.authBackHome')"
          >
            <svg
              class="auth-page__back-svg"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.75"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </RouterLink>
          <h1 class="auth-page__title">{{ t('app.authPageTitle') }}</h1>
        </header>
        <div class="auth-page__card">
          <AuthForm :redirect-path="redirectPath" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Spacing scale: 8 / 12 / 16 / 24 px → 0.5 / 0.75 / 1 / 1.5 rem */
.auth-page {
  --auth-space-2: 0.5rem;
  --auth-space-3: 0.75rem;
  --auth-space-4: 1rem;
  --auth-space-6: 1.5rem;

  /* Same shell stack as `AppShellLayout` — backdrops sit behind content */
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: var(--sa-color-text-main);
}

.auth-page__surface {
  position: relative;
  /* Above `PurpleLightningBackdrop` (z-index 1) */
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 100vh;
  padding: var(--auth-space-4);
}

.auth-page__inner {
  width: min(27.5rem, 100%);
  max-width: 27.5rem;
  display: flex;
  flex-direction: column;
  gap: var(--auth-space-6);
}

/* Title centered; back link does not shift the heading */
.auth-page__head {
  position: relative;
  flex-shrink: 0;
  min-height: 2.75rem;
}

.auth-page__back {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  border-radius: var(--ui-radius-md, var(--sa-radius-sm));
  background: var(--bg-muted, color-mix(in srgb, var(--sa-color-surface-raised) 75%, transparent));
  color: var(--text-heading, var(--sa-color-text-main));
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.auth-page__back-svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  display: block;
  pointer-events: none;
}

.auth-page__back:hover {
  border-color: var(--border-strong, var(--sa-color-primary-border));
  background: var(--bg-muted-strong, color-mix(in srgb, var(--sa-color-surface) 88%, transparent));
  color: var(--text-title, var(--sa-color-primary));
}

.auth-page__back:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--sa-color-primary) 65%, transparent);
  outline-offset: 2px;
}

.auth-page__title {
  margin: 0;
  width: 100%;
  text-align: center;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: clamp(1.2rem, 4.5vw, 1.45rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-heading, var(--sa-color-text-strong));
}

.auth-page__card {
  width: 100%;
  padding: var(--auth-space-6);
  border-radius: var(--sa-radius-lg);
  border: 1px solid var(--border-strong, var(--sa-color-border));
  background: var(--bg-dropdown, var(--sa-color-bg-card));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 14%, transparent),
    var(--sa-shadow-card, var(--sa-shadow-elevated));
}

.auth-page :deep(.auth-page-stack) {
  display: flex;
  flex-direction: column;
  gap: var(--auth-space-3);
}

.auth-page :deep(.auth-page-field-group) {
  display: flex;
  flex-direction: column;
  gap: var(--auth-space-2);
}

.auth-page :deep(.auth-page-label) {
  display: flex;
  flex-direction: column;
  gap: var(--auth-space-2);
  text-align: left;
}

.auth-page :deep(.auth-page-label-text) {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted, var(--sa-color-text-muted));
}

.auth-page :deep(.auth-page-input) {
  width: 100%;
  box-sizing: border-box;
  min-height: 2.5rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--border-input, var(--sa-color-border));
  background: var(--bg-input, color-mix(in srgb, var(--sa-color-surface) 90%, transparent));
  color: var(--text-heading, var(--sa-color-text-main));
  font-size: 0.875rem;
}

.auth-page :deep(.auth-page-input::placeholder) {
  color: var(--text-muted, var(--sa-color-text-muted));
  opacity: 0.85;
}

.auth-page :deep(.auth-page-forgot-row) {
  display: flex;
  justify-content: flex-end;
}

.auth-page :deep(.auth-page-link) {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font-size: 0.8rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--sa-color-primary) 82%, #e9d5ff);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--sa-color-primary) 45%, transparent);
  text-underline-offset: 0.12em;
}

.auth-page :deep(.auth-page-link:hover) {
  color: var(--sa-color-text-strong);
  text-decoration-color: color-mix(in srgb, var(--sa-color-primary) 55%, var(--sa-color-text-strong));
}

.auth-page :deep(.auth-page-link--block) {
  align-self: center;
  text-align: center;
  text-decoration: none;
}

.auth-page :deep(.auth-page-link--block:hover) {
  text-decoration: underline;
}

.auth-page :deep(.auth-page-submit) {
  width: 100%;
  min-height: 2.5rem;
  margin-top: var(--auth-space-4);
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: var(--sa-radius-sm);
  opacity: 0.92;
}

.auth-page :deep(.auth-page-submit.app-btn:hover:not(:disabled)) {
  opacity: 1;
}

.auth-page :deep(.auth-page-feedback) {
  margin: 0;
  padding: var(--auth-space-3) var(--auth-space-3);
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  font-size: 0.8rem;
  line-height: 1.4;
}

.auth-page :deep(.auth-page-feedback--err) {
  background: color-mix(in srgb, var(--sa-color-warning) 10%, var(--sa-color-surface));
  border-color: color-mix(in srgb, var(--sa-color-warning) 40%, var(--sa-color-border));
  color: var(--sa-color-text-body);
}

.auth-page :deep(.auth-page-lead) {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--text-body, var(--sa-color-text-body));
}
</style>
