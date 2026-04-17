<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import StreamerBrandLink from '@/eat-first/ui/atoms/StreamerBrandLink.vue'
import ThemeToggleButton from '@/eat-first/ui/atoms/ThemeToggleButton.vue'
import UiMenuSelect from '@/eat-first/ui/molecules/UiMenuSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StreamAuthModal from '@/components/ui/StreamAuthModal.vue'
import { useTheme } from '@/eat-first'
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { normalizeDisplayName } from 'call-core'
import { useAuth } from '@/composables/useAuth'
import { useStreamAuthModal } from '@/composables/useStreamAuthModal'

const props = withDefaults(
  defineProps<{
    showOnboardingGuide?: boolean
  }>(),
  { showOnboardingGuide: false },
)

defineEmits<{
  'open-onboarding': []
}>()

const { t, locale } = useI18n()
const route = useRoute()
const { theme, toggleTheme } = useTheme()
const { user, isAuthenticated, logout } = useAuth()
const { openStreamAuthModal } = useStreamAuthModal()

const postLoginPath = computed(() => route.fullPath || '/')

const themeIcon = computed(() => (theme.value === 'dark' ? '☀️' : '🌙'))
const themeLabel = computed(() =>
  theme.value === 'dark' ? t('app.themeLight') : t('app.themeDark'),
)
const localeMenuOptions = LOCALE_OPTIONS.map((o) => ({ value: o.code, label: o.label }))

const twitchChannelAria = computed(() => t('app.twitchAria', { nick: STREAMER_NICK }))

function userAvatarInitial(displayName: string): string {
  const s = normalizeDisplayName(displayName)
  if (!s) {
    return '?'
  }
  const ch = [...s][0]
  return ch ? ch.toUpperCase() : '?'
}
</script>

<template>
  <div class="app-shell-header__end">
    <button
      v-if="props.showOnboardingGuide"
      type="button"
      class="onb-guide"
      :title="t('onboarding.openGuide')"
      :aria-label="t('onboarding.openGuide')"
      @click="$emit('open-onboarding')"
    >
      ?
    </button>
    <div
      v-if="isAuthenticated && user"
      class="auth-user"
      role="group"
      :aria-label="user.displayName"
      :title="user.displayName"
    >
      <div class="auth-user__avatar" aria-hidden="true">
        <img
          v-if="user.avatar"
          class="auth-user__avatar-img"
          :src="user.avatar"
          width="30"
          height="30"
          alt=""
          decoding="async"
        />
        <span v-else class="auth-user__avatar-fallback">{{ userAvatarInitial(user.displayName) }}</span>
      </div>
      <span class="auth-user__name">{{ user.displayName }}</span>
    </div>
    <div v-if="isAuthenticated && user" class="auth-chip">
      <AppButton variant="ghost" class="auth-chip__out" type="button" @click="logout()">
        {{ t('app.authLogout') }}
      </AppButton>
    </div>
    <AppButton
      v-else
      variant="secondary"
      type="button"
      class="auth-signup"
      @click="openStreamAuthModal(postLoginPath)"
    >
      {{ t('app.authSignUp') }}
    </AppButton>
    <UiMenuSelect
      :model-value="locale"
      :options="localeMenuOptions"
      :ariaLabel="t('app.langAria')"
      variant="header"
      @update:model-value="persistLocale"
    />
    <ThemeToggleButton :label="themeLabel" :icon="themeIcon" @click="toggleTheme" />
    <StreamerBrandLink :ariaLabel="twitchChannelAria" :show-nick="false" :logo-size="30" />
    <StreamAuthModal />
  </div>
</template>

<style scoped>
.onb-guide {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  margin: 0 0.15rem 0 0;
  padding: 0;
  border: 1px solid var(--border-input, var(--sa-color-border));
  border-radius: 8px;
  background: var(--bg-card-soft, color-mix(in srgb, var(--sa-color-surface) 85%, transparent));
  color: var(--text-muted, var(--sa-color-text-muted));
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.onb-guide:hover {
  color: var(--text-heading, var(--sa-color-text-main));
  border-color: var(--border-strong, var(--sa-color-primary-border));
}

.auth-user {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  max-width: min(14rem, 36vw);
  flex-shrink: 1;
}

.auth-user__avatar {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--border-input, var(--sa-color-border));
  background: var(--bg-card-soft, color-mix(in srgb, var(--sa-color-surface) 88%, transparent));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 22%, transparent);
}

.auth-user__avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-user__avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-heading, var(--sa-color-text-main));
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--sa-color-primary) 38%, #1e1b4b),
    #0f172a
  );
}

.auth-user__name {
  min-width: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-heading, var(--sa-color-text-main));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-chip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.auth-chip__out {
  flex-shrink: 0;
  padding: 0.25rem 0.45rem !important;
  font-size: 0.72rem !important;
}

.auth-signup {
  flex-shrink: 0;
  font-size: 0.78rem !important;
  padding: 0.35rem 0.65rem !important;
}

@media (max-width: 520px) {
  .auth-signup {
    font-size: 0.72rem !important;
    padding: 0.32rem 0.5rem !important;
  }
}
</style>
