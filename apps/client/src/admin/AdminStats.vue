<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '@/utils/apiUrl'

const { t } = useI18n()

type StatsPayload = {
  databaseConfigured?: boolean
  userCount?: number
  wordleRounds?: number
  totalWinsRecorded?: number
  totalGamesPlayed?: number
  topWins?: { userId: string; displayName: string; wins: number }[]
  topRating?: { userId: string; displayName: string; rating: number; wins: number; losses: number }[]
}

const data = ref<StatsPayload | null>(null)
const loading = ref(true)
const errorKey = ref<'load' | 'forbidden' | null>(null)
const reloading = ref(false)

const databaseConfigured = computed(() => data.value?.databaseConfigured !== false)

async function fetchAdminStats() {
  const r = await fetch(apiUrl('/api/admin/stats'), { credentials: 'include' })
  if (r.status === 403) {
    errorKey.value = 'forbidden'
    data.value = null
    return
  }
  if (!r.ok) {
    errorKey.value = 'load'
    data.value = null
    return
  }
  errorKey.value = null
  try {
    data.value = (await r.json()) as StatsPayload
  } catch {
    errorKey.value = 'load'
    data.value = null
  }
}

async function load() {
  loading.value = true
  errorKey.value = null
  try {
    await fetchAdminStats()
  } catch {
    errorKey.value = 'load'
    data.value = null
  } finally {
    loading.value = false
  }
}

async function reload() {
  reloading.value = true
  errorKey.value = null
  try {
    await fetchAdminStats()
  } catch {
    errorKey.value = 'load'
    data.value = null
  } finally {
    reloading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="w-full min-w-0 space-y-6">
    <header class="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold tracking-tight text-white">{{ t('adminPanel.statsTitle') }}</h2>
        <p class="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{{ t('adminPanel.statsLead') }}</p>
      </div>
      <button
        v-if="!loading"
        type="button"
        class="shrink-0 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700/90 disabled:opacity-50"
        :disabled="reloading"
        @click="reload"
      >
        {{ reloading ? t('adminPanel.statsReloading') : t('adminPanel.statsReload') }}
      </button>
    </header>

    <p v-if="loading" class="text-sm text-slate-400">{{ t('adminPanel.statsLoading') }}</p>

    <div
      v-else-if="errorKey === 'forbidden'"
      class="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100/90"
    >
      {{ t('adminPanel.statsForbidden') }}
    </div>

    <div v-else-if="errorKey === 'load'" class="flex flex-wrap items-center gap-3">
      <p class="text-sm text-rose-300/90">{{ t('adminPanel.statsError') }}</p>
      <button
        type="button"
        class="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-600 hover:bg-slate-700"
        @click="load"
      >
        {{ t('adminPanel.commonRetry') }}
      </button>
    </div>

    <template v-else-if="data">
      <p v-if="!databaseConfigured" class="text-sm text-amber-200/90">{{ t('adminPanel.statsNoDb') }}</p>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03] lg:col-span-1"
        >
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.statUsers') }}</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-white">{{ data.userCount ?? 0 }}</p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]">
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {{ t('adminPanel.statWordleRounds') }}
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-cyan-300">{{ data.wordleRounds ?? 0 }}</p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]">
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {{ t('adminPanel.statTotalWinsInStats') }}
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-emerald-300">{{ data.totalWinsRecorded ?? 0 }}</p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]">
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {{ t('adminPanel.statTotalGamesPlayed') }}
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-slate-100">{{ data.totalGamesPlayed ?? 0 }}</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 ring-1 ring-white/[0.03]">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.topWins') }}</p>
          <ol class="mt-3 space-y-2">
            <li
              v-for="(u, i) in data.topWins ?? []"
              :key="u.userId"
              class="flex items-center justify-between gap-2 text-sm"
            >
              <span class="w-6 shrink-0 text-slate-500">{{ i + 1 }}.</span>
              <span class="min-w-0 flex-1 truncate font-medium text-slate-100">{{ u.displayName }}</span>
              <span class="shrink-0 tabular-nums font-semibold text-cyan-300">{{ u.wins }}</span>
            </li>
            <li v-if="!(data.topWins && data.topWins.length)" class="text-sm text-slate-500">—</li>
          </ol>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 ring-1 ring-white/[0.03]">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.topRating') }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ t('adminPanel.ratingHelp') }}</p>
          <ol class="mt-3 space-y-2">
            <li
              v-for="(u, i) in data.topRating ?? []"
              :key="u.userId"
              class="flex items-center justify-between gap-2 text-sm"
            >
              <span class="w-6 shrink-0 text-slate-500">{{ i + 1 }}.</span>
              <span class="min-w-0 flex-1 truncate font-medium text-slate-100">{{ u.displayName }}</span>
              <span class="shrink-0 tabular-nums font-semibold text-violet-200">{{ u.rating }}</span>
            </li>
            <li v-if="!(data.topRating && data.topRating.length)" class="text-sm text-slate-500">—</li>
          </ol>
        </div>
      </div>
    </template>
  </div>
</template>
