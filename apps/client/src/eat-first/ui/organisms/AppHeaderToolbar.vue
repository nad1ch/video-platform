<script setup>
import { useI18n } from 'vue-i18n'
import StreamerBrandLink from '../atoms/StreamerBrandLink.vue'
import ThemeToggleButton from '../atoms/ThemeToggleButton.vue'
import UiMenuSelect from '../molecules/UiMenuSelect.vue'

defineProps({
  localeMenuOptions: { type: Array, required: true },
  modelLocale: { type: String, required: true },
  themeIcon: { type: String, required: true },
  themeLabel: { type: String, required: true },
  showOnboardingGuide: { type: Boolean, default: false },
})

defineEmits(['update:locale', 'toggle-theme', 'open-onboarding'])

const { t } = useI18n()
</script>

<template>
  <div class="app-shell-header__end">
    <button
      v-if="showOnboardingGuide"
      type="button"
      class="onb-guide"
      :title="t('onboarding.openGuide')"
      :aria-label="t('onboarding.openGuide')"
      @click="$emit('open-onboarding')"
    >
      ?
    </button>
    <StreamerBrandLink :aria-label="t('app.twitchAria')" />
    <UiMenuSelect
      :model-value="modelLocale"
      :options="localeMenuOptions"
      :aria-label="t('app.langAria')"
      variant="header"
      @update:model-value="$emit('update:locale', $event)"
    />
    <ThemeToggleButton :label="themeLabel" :icon="themeIcon" @click="$emit('toggle-theme')" />
  </div>
</template>

<style scoped>
.onb-guide {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  margin: 0 0.15rem 0 0;
  padding: 0;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background: var(--bg-card-soft);
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.onb-guide:hover {
  color: var(--text-heading);
  border-color: var(--border-strong);
}
</style>
