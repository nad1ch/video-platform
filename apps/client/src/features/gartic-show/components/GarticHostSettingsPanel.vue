<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GarticPromptRow } from '../orchestrator/useGarticShowOrchestrator'

withDefaults(
  defineProps<{
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
  clearCanvas: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="w-full space-y-2 border-t border-white/10 bg-slate-950/35 px-2 pb-2 pt-2">
    <button
      type="button"
      class="min-h-10 w-full rounded-lg border-2 border-slate-400/70 bg-slate-800/95 px-3 py-2.5 text-sm font-semibold text-slate-50 shadow-md hover:border-slate-300 hover:bg-slate-700/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400"
      @click="emit('clearCanvas')"
    >
      {{ t('garticShow.clearCanvas') }}
    </button>

    <details class="rounded-lg border border-slate-700/50 bg-slate-950/30">
      <summary
        class="cursor-pointer select-none px-2 py-1 text-[0.6rem] font-medium text-slate-500 hover:text-slate-300"
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
        <p v-if="promptsLoading" class="text-[0.55rem] text-slate-400">{{ t('garticShow.loading') }}</p>
        <ul v-else class="space-y-1 text-[0.55rem]">
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
  </div>
</template>
