<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DurakGameMode, DurakPlayerCount } from '../core/durakModes'
import { DURAK_GAME_MODES } from '../core/durakModes'
import AppCard from '@/components/ui/AppCard.vue'
import DurakModeCard from './DurakModeCard.vue'
import DurakPlayerCountPicker from './DurakPlayerCountPicker.vue'

const props = defineProps<{
  modelValue: DurakPlayerCount
}>()

const emit = defineEmits<{
  'update:modelValue': [DurakPlayerCount]
  'pick-mode': [DurakGameMode]
}>()

const { t } = useI18n()

const modeCopy = computed(() =>
  DURAK_GAME_MODES.map((mode) => ({
    mode,
    title: t(`durak.modes.${mode}.title`),
    description: t(`durak.modes.${mode}.body`),
  })),
)
</script>

<template>
  <div class="durak-lobby">
    <AppCard class="durak-lobby__card">
      <DurakPlayerCountPicker
        :model-value="props.modelValue"
        :legend="t('durak.lobby.playerCountLegend')"
        :note="t('durak.lobby.multiplayerNote')"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </AppCard>

    <p class="durak-lobby__modes-label">{{ t('durak.lobby.modesLegend') }}</p>
    <div class="durak-lobby__modes">
      <DurakModeCard
        v-for="row in modeCopy"
        :key="row.mode"
        :title="row.title"
        :description="row.description"
        @click="emit('pick-mode', row.mode)"
      />
    </div>
  </div>
</template>

<style scoped>
.durak-lobby {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-4, 1rem);
  min-width: 0;
}

.durak-lobby__modes-label {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.92);
}

.durak-lobby__modes {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-3, 0.75rem);
}
</style>
