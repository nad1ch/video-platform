<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'

const { t } = useI18n()

const defaultWordleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK
const lastAction = ref<string | null>(null)

function stub(action: string) {
  lastAction.value = action
}
</script>

<template>
  <div class="w-full min-w-0 space-y-5">
    <header class="border-b border-slate-800/80 pb-4">
      <h2 class="text-xl font-semibold tracking-tight text-white">{{ t('adminPanel.gamesTitle') }}</h2>
      <p class="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{{ t('adminPanel.gamesLead') }}</p>
    </header>

    <div class="flex flex-wrap gap-2">
      <RouterLink
        :to="{ name: 'wordle-streamer', params: { streamer: defaultWordleStreamer } }"
        class="inline-flex items-center rounded-lg bg-slate-800/90 px-3 py-2 text-xs font-semibold text-slate-100 ring-1 ring-slate-600/60 transition hover:bg-slate-700/90"
      >
        {{ t('adminPanel.gamesOpenWordle') }}
      </RouterLink>
      <RouterLink
        :to="{ name: 'eat' }"
        class="inline-flex items-center rounded-lg bg-violet-950/80 px-3 py-2 text-xs font-semibold text-violet-100 ring-1 ring-violet-700/45 transition hover:bg-violet-900/80"
      >
        {{ t('adminPanel.gamesOpenEat') }}
      </RouterLink>
    </div>

    <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 ring-1 ring-white/[0.03]">
      <p class="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.gamesPanelTitle') }}</p>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-lg bg-emerald-800/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-600/30 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          @click="stub('start')"
        >
          {{ t('adminPanel.gamesStart') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-amber-800/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-amber-600/30 transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          @click="stub('stop')"
        >
          {{ t('adminPanel.gamesStop') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-rose-900/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-rose-700/40 transition hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          @click="stub('reset')"
        >
          {{ t('adminPanel.gamesReset') }}
        </button>
      </div>
      <p v-if="lastAction" class="mt-5 text-sm text-slate-400" role="status">
        {{ t('adminPanel.gamesStub') }}
        <span class="font-mono text-slate-300">{{ lastAction }}</span>
      </p>
    </div>
  </div>
</template>
