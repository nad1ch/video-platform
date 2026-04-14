<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import StreamerBrandLink from '@/eat-first/ui/atoms/StreamerBrandLink.vue'
import ThemeToggleButton from '@/eat-first/ui/atoms/ThemeToggleButton.vue'
import UiMenuSelect from '@/eat-first/ui/molecules/UiMenuSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StreamAuthModal from '@/components/ui/StreamAuthModal.vue'
import { useTheme } from '@/eat-first/composables/useTheme.js'
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
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
    <StreamerBrandLink :ariaLabel="twitchChannelAria" />
    <div v-if="isAuthenticated && user" class="auth-chip">
      <img
        v-if="user.profile_image_url"
        class="auth-chip__avatar"
        :src="user.profile_image_url"
        width="28"
        height="28"
        alt=""
        decoding="async"
      />
      <span class="auth-chip__name" :title="user.display_name">{{ user.display_name }}</span>
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

.auth-chip {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  max-width: min(12rem, 38vw);
  flex-shrink: 1;
  min-width: 0;
}

.auth-chip__avatar {
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.auth-chip__name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-heading, var(--sa-color-text-main));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
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
