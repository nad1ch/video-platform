<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStatsState } from '@/admin'
import { apiFetch } from '@/utils/apiFetch'

const { t } = useI18n()

const { data, loading, errorKey, reloading, databaseConfigured, load, reload } = useAdminStatsState()

interface AnonymousAnalyticsPayload {
  databaseConfigured: boolean
  range: { from: string | null; to: string | null }
  sessions: { total: number; bounceRate: number; avgDurationSec: number }
  visitors24h: number
  visitors7d: number
  visitors30d: number
  activeNow: number
  topRoutes: Array<{ path: string; events: number; sessions: number }>
  topEvents: Array<{ event: string; count: number }>
}

const anonAnalytics = ref<AnonymousAnalyticsPayload | null>(null)
const anonAnalyticsLoading = ref(false)
const anonAnalyticsError = ref<string | null>(null)
/** Empty values let the server pick its 7-day default. */
const anonDateFromInput = ref('')
const anonDateToInput = ref('')

function localDateTimeToIsoOrNull(local: string): string | null {
  if (!local) return null
  const ms = Date.parse(local)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

async function loadAnonAnalytics(): Promise<void> {
  anonAnalyticsLoading.value = true
  anonAnalyticsError.value = null
  try {
    const qs = new URLSearchParams()
    const fromIso = localDateTimeToIsoOrNull(anonDateFromInput.value)
    if (fromIso) qs.set('dateFrom', fromIso)
    const toIso = localDateTimeToIsoOrNull(anonDateToInput.value)
    if (toIso) qs.set('dateTo', toIso)
    const query = qs.toString()
    const res = await apiFetch(`/api/admin/analytics/anonymous${query ? `?${query}` : ''}`)
    if (!res.ok) {
      anonAnalyticsError.value = `error_${res.status}`
      return
    }
    anonAnalytics.value = (await res.json()) as AnonymousAnalyticsPayload
  } catch (err) {
    anonAnalyticsError.value = err instanceof Error ? err.message : 'unknown_error'
  } finally {
    anonAnalyticsLoading.value = false
  }
}

function clearAnonRange(): void {
  anonDateFromInput.value = ''
  anonDateToInput.value = ''
  void loadAnonAnalytics()
}

function formatDurationSec(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m`
}

function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${Math.round(ratio * 100)}%`
}

function formatRangeIso(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

onMounted(() => {
  void load()
  void loadAnonAnalytics()
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
            {{ t('adminPanel.statNadleRounds') }}
          </p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-cyan-300">{{ data.nadleRounds ?? 0 }}</p>
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

    <section class="rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 ring-1 ring-white/[0.03]">
      <header class="flex flex-col gap-1 border-b border-slate-800/60 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <h3 class="text-base font-semibold tracking-tight text-white">Anonymous visitors</h3>
          <p class="mt-1 text-xs text-slate-400">
            Aggregated from existing client events for sessions without a signed-in user. Default range is the last 7 days; sessionId is sessionStorage-scoped, so refreshed tabs count as new sessions.
          </p>
        </div>
      </header>
      <div class="mt-3 flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          From
          <input
            v-model="anonDateFromInput"
            type="datetime-local"
            class="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
            @keyup.enter="loadAnonAnalytics"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          To
          <input
            v-model="anonDateToInput"
            type="datetime-local"
            class="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
            @keyup.enter="loadAnonAnalytics"
          />
        </label>
        <button
          type="button"
          class="rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-sm font-medium text-violet-50 hover:bg-violet-600/40"
          :disabled="anonAnalyticsLoading"
          @click="loadAnonAnalytics"
        >
          {{ anonAnalyticsLoading ? 'Loading…' : 'Apply' }}
        </button>
        <button
          type="button"
          class="rounded-md border border-white/10 bg-slate-800/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/70"
          @click="clearAnonRange"
        >
          Clear
        </button>
        <span v-if="anonAnalyticsError" class="ml-auto text-xs text-rose-300">{{ anonAnalyticsError }}</span>
      </div>
      <div v-if="anonAnalytics && anonAnalytics.databaseConfigured" class="mt-4 space-y-4">
        <p class="text-[11px] text-slate-500">
          Range: {{ formatRangeIso(anonAnalytics.range.from) }} → {{ formatRangeIso(anonAnalytics.range.to) }}
        </p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Sessions</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-white">{{ anonAnalytics.sessions.total }}</p>
            <p class="mt-1 text-xs text-slate-400">avg {{ formatDurationSec(anonAnalytics.sessions.avgDurationSec) }} · bounce {{ formatPercent(anonAnalytics.sessions.bounceRate) }}</p>
          </div>
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Active now</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-emerald-300">{{ anonAnalytics.activeNow }}</p>
            <p class="mt-1 text-xs text-slate-400">last event ≤ 5 min</p>
          </div>
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Last 24h / 7d</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-cyan-300">{{ anonAnalytics.visitors24h }} <span class="text-base text-slate-500">/ {{ anonAnalytics.visitors7d }}</span></p>
            <p class="mt-1 text-xs text-slate-400">unique sessionIds</p>
          </div>
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Last 30d</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-violet-200">{{ anonAnalytics.visitors30d }}</p>
            <p class="mt-1 text-xs text-slate-400">unique sessionIds</p>
          </div>
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Top routes</p>
            <ol class="mt-2 space-y-1.5 text-sm">
              <li
                v-for="(r, i) in anonAnalytics.topRoutes"
                :key="`${i}-${r.path}`"
                class="flex items-center gap-2"
              >
                <span class="w-6 shrink-0 text-slate-500">{{ i + 1 }}.</span>
                <span class="min-w-0 flex-1 truncate font-mono text-xs text-slate-200">{{ r.path }}</span>
                <span class="shrink-0 text-xs tabular-nums text-slate-400">{{ r.sessions }} sessions</span>
                <span class="w-14 shrink-0 text-right text-xs tabular-nums font-semibold text-cyan-300">{{ r.events }}</span>
              </li>
              <li v-if="!anonAnalytics.topRoutes.length" class="text-xs text-slate-500">—</li>
            </ol>
          </div>
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Top events</p>
            <ol class="mt-2 space-y-1.5 text-sm">
              <li
                v-for="(e, i) in anonAnalytics.topEvents"
                :key="`${i}-${e.event}`"
                class="flex items-center gap-2"
              >
                <span class="w-6 shrink-0 text-slate-500">{{ i + 1 }}.</span>
                <span class="min-w-0 flex-1 truncate font-mono text-xs text-slate-200">{{ e.event }}</span>
                <span class="w-14 shrink-0 text-right text-xs tabular-nums font-semibold text-violet-200">{{ e.count }}</span>
              </li>
              <li v-if="!anonAnalytics.topEvents.length" class="text-xs text-slate-500">—</li>
            </ol>
          </div>
        </div>
      </div>
      <p v-else-if="anonAnalytics && !anonAnalytics.databaseConfigured" class="mt-3 text-sm text-amber-200/90">
        Database not configured.
      </p>
      <p v-else-if="anonAnalyticsLoading" class="mt-3 text-sm text-slate-400">Loading anonymous visitor analytics…</p>
    </section>
  </div>
</template>
