<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StreamerBrandLink from '@/eat-first/ui/atoms/StreamerBrandLink.vue'
import ThemeToggleButton from '@/eat-first/ui/atoms/ThemeToggleButton.vue'
import UiMenuSelect from '@/eat-first/ui/molecules/UiMenuSelect.vue'
import { useTheme } from '@/eat-first/composables/useTheme.js'
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'

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
const { theme, toggleTheme } = useTheme()

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
    <UiMenuSelect
      :model-value="locale"
      :options="localeMenuOptions"
      :ariaLabel="t('app.langAria')"
      variant="header"
      @update:model-value="persistLocale"
    />
    <ThemeToggleButton :label="themeLabel" :icon="themeIcon" @click="toggleTheme" />
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
</style>
