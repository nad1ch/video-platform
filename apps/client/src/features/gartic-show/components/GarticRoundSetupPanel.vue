<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import type { GarticRoundSetupWordSource } from '../core/garticTypes'
import type { GarticPromptRow } from '../orchestrator/useGarticShowOrchestrator'

const wordSource = defineModel<GarticRoundSetupWordSource>('wordSource', { required: true })
const roundDurationSec = defineModel<number>('roundDurationSec', { required: true })
const roundCount = defineModel<number>('roundCount', { required: true })

withDefaults(
  defineProps<{
    startDisabled: boolean
    prompts?: GarticPromptRow[]
    promptsLoading?: boolean
  }>(),
  {
    prompts: () => [],
    promptsLoading: false,
  },
)

const emit = defineEmits<{
  loadPrompts: []
  approvePrompt: [id: string]
  deletePrompt: [id: string]
  start: []
}>()

const { t } = useI18n()

const durationChoices = [60, 90, 120, 180, 240, 300] as const
const roundCountChoices = [5, 10, 15, 30, 50] as const

function chipActive(active: boolean): string {
  return active
    ? 'border-slate-500/80 bg-slate-800/95 text-slate-50 shadow-sm'
    : 'border-slate-700/50 bg-slate-950/50 text-slate-500 hover:border-slate-600/70 hover:bg-slate-800/60 hover:text-slate-300'
}
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 shadow-md backdrop-blur-sm"
    :aria-label="t('garticShow.roundSetupTitle')"
  >
    <h2 class="text-left text-sm font-bold tracking-wide text-slate-200">
      {{ t('garticShow.roundSetupTitle') }}
    </h2>

    <div class="flex flex-col gap-1.5 text-left">
      <p class="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {{ t('garticShow.roundDurationLabel') }}
      </p>
      <div class="flex flex-wrap gap-1" role="group" :aria-label="t('garticShow.roundDurationLabel')">
        <button
          v-for="sec in durationChoices"
          :key="sec"
          type="button"
          class="rounded-md border px-2 py-1 text-[0.68rem] font-semibold tabular-nums transition-colors"
          :class="chipActive(roundDurationSec === sec)"
          @click="roundDurationSec = sec"
        >
          {{ sec }}s
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5 text-left">
      <p class="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {{ t('garticShow.roundCountLabel') }}
      </p>
      <div class="flex flex-wrap gap-1" role="group" :aria-label="t('garticShow.roundCountLabel')">
        <button
          v-for="n in roundCountChoices"
          :key="n"
          type="button"
          class="rounded-md border px-2.5 py-1 text-[0.68rem] font-semibold tabular-nums transition-colors"
          :class="chipActive(roundCount === n)"
          @click="roundCount = n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5 text-left">
      <p class="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {{ t('garticShow.wordSource') }}
      </p>
      <div
        class="grid grid-cols-3 gap-0.5 rounded-xl border border-slate-700/60 bg-slate-950/40 p-0.5"
        role="group"
        :aria-label="t('garticShow.wordSource')"
      >
        <button
          type="button"
          class="rounded-lg px-1 py-1.5 text-[0.62rem] font-bold leading-tight transition-colors sm:text-[0.65rem]"
          :class="chipActive(wordSource === 'manual')"
          @click="wordSource = 'manual'"
        >
          {{ t('garticShow.wordSourceSegmentManual') }}
        </button>
        <button
          type="button"
          class="rounded-lg px-1 py-1.5 text-[0.62rem] font-bold leading-tight transition-colors sm:text-[0.65rem]"
          :class="chipActive(wordSource === 'channel')"
          @click="wordSource = 'channel'"
        >
          {{ t('garticShow.wordSourceSegmentSubscribers') }}
        </button>
        <button
          type="button"
          class="rounded-lg px-1 py-1.5 text-[0.62rem] font-bold leading-tight transition-colors sm:text-[0.65rem]"
          :class="chipActive(wordSource === 'global')"
          @click="wordSource = 'global'"
        >
          {{ t('garticShow.wordSourceSegmentGlobal') }}
        </button>
      </div>
    </div>

    <details class="rounded-lg border border-slate-700/50 bg-slate-950/30">
      <summary
        class="cursor-pointer select-none px-2 py-1.5 text-left text-[0.6rem] font-medium text-slate-500 hover:text-slate-300"
      >
        {{ t('garticShow.promptsTitle') }}
      </summary>
      <div class="max-h-28 space-y-1 overflow-y-auto border-t border-slate-800/80 px-2 py-1.5">
        <div class="flex justify-end">
          <button
            type="button"
            class="rounded border border-slate-600 bg-slate-800/80 px-1.5 py-0.5 text-[0.55rem] font-medium text-slate-200 hover:bg-slate-700"
            @click="emit('loadPrompts')"
          >
            {{ t('garticShow.refresh') }}
          </button>
        </div>
        <p v-if="promptsLoading" class="text-left text-[0.55rem] text-slate-400">{{ t('garticShow.loading') }}</p>
        <ul v-else class="space-y-1 text-left text-[0.55rem]">
          <li
            v-for="p in prompts"
            :key="p.id"
            class="flex flex-wrap items-center gap-1 border-b border-slate-800/60 pb-1 last:border-0 last:pb-0"
          >
            <span class="min-w-0 flex-1 font-medium leading-snug" :class="{ 'text-amber-400': !p.approved }">
              {{ p.text }}
            </span>
            <button
              v-if="!p.approved"
              type="button"
              class="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-slate-200 hover:bg-slate-700"
              @click="emit('approvePrompt', p.id)"
            >
              {{ t('garticShow.approve') }}
            </button>
            <button
              type="button"
              class="rounded border border-red-900/60 px-1 py-0.5 text-red-400 hover:bg-red-950/40"
              @click="emit('deletePrompt', p.id)"
            >
              {{ t('garticShow.delete') }}
            </button>
          </li>
        </ul>
      </div>
    </details>

    <AppButton
      variant="primary"
      type="button"
      class="w-full !min-h-11 !py-3 !text-sm"
      :disabled="startDisabled"
      @click="emit('start')"
    >
      {{ t('garticShow.startRound') }}
    </AppButton>
  </section>
</template>
