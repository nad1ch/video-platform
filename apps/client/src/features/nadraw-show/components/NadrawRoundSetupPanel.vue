<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { NadrawRoundSetupWordSource } from '../core/nadrawTypes'

const wordSource = defineModel<NadrawRoundSetupWordSource>('wordSource', { required: true })
const roundDurationSec = defineModel<number>('roundDurationSec', { required: true })
const roundCount = defineModel<number>('roundCount', { required: true })

defineProps<{
  startDisabled: boolean
}>()

const emit = defineEmits<{
  start: []
}>()

const { t } = useI18n()

const durationChoices = [10, 30, 60, 90, 120, 180, 240, 300] as const
const roundCountChoices = [5, 10, 15, 30, 50] as const
</script>

<template>
  <section
    class="sa-panel-eat backdrop-blur-sm"
    :aria-label="t('nadrawShow.roundSetupTitle')"
  >
    <h2 class="sa-panel-eat__title">
      {{ t('nadrawShow.roundSetupTitle') }}
    </h2>

    <div class="flex flex-col gap-1.5 text-left">
      <p class="sa-panel-eat__label">
        {{ t('nadrawShow.roundDurationLabel') }}
      </p>
      <div class="flex flex-wrap gap-1" role="group" :aria-label="t('nadrawShow.roundDurationLabel')">
        <button
          v-for="sec in durationChoices"
          :key="sec"
          type="button"
          class="sa-chip-btn sa-chip-btn--dense tabular-nums"
          :class="{ 'sa-chip-btn--on': roundDurationSec === sec }"
          @click="roundDurationSec = sec"
        >
          {{ sec }}s
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5 text-left">
      <p class="sa-panel-eat__label">
        {{ t('nadrawShow.roundCountLabel') }}
      </p>
      <div class="flex flex-wrap gap-1" role="group" :aria-label="t('nadrawShow.roundCountLabel')">
        <button
          v-for="n in roundCountChoices"
          :key="n"
          type="button"
          class="sa-chip-btn sa-chip-btn--dense tabular-nums"
          :class="{ 'sa-chip-btn--on': roundCount === n }"
          @click="roundCount = n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5 text-left">
      <p class="sa-panel-eat__label">
        {{ t('nadrawShow.wordSource') }}
      </p>
      <div class="sa-seg-track" role="group" :aria-label="t('nadrawShow.wordSource')">
        <button
          type="button"
          class="sa-chip-btn"
          :class="{ 'sa-chip-btn--on': wordSource === 'manual' }"
          @click="wordSource = 'manual'"
        >
          {{ t('nadrawShow.wordSourceSegmentManual') }}
        </button>
        <button
          type="button"
          class="sa-chip-btn"
          :class="{ 'sa-chip-btn--on': wordSource === 'channel' }"
          @click="wordSource = 'channel'"
        >
          {{ t('nadrawShow.wordSourceSegmentSubscribers') }}
        </button>
        <button
          type="button"
          class="sa-chip-btn"
          :class="{ 'sa-chip-btn--on': wordSource === 'global' }"
          @click="wordSource = 'global'"
        >
          {{ t('nadrawShow.wordSourceSegmentGlobal') }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="sa-cta-accent"
      :disabled="startDisabled"
      @click="emit('start')"
    >
      {{ t('nadrawShow.startRound') }}
    </button>
  </section>
</template>
