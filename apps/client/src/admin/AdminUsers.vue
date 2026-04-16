<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '@/utils/apiUrl'

const { t, locale } = useI18n()

type Row = {
  id: string
  displayName: string
  avatar?: string
  provider: string
  role: 'admin' | 'user'
  wins: number
  gamesPlayed: number
}

const users = ref<Row[]>([])
const loading = ref(true)
const errorKey = ref<'load' | 'forbidden' | null>(null)
const databaseConfigured = ref(true)
const searchQuery = ref('')
const sortKey = ref<'name' | 'wins' | 'rating'>('name')
const lastUpdated = ref<Date | null>(null)
const copyFeedbackId = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const rating = (u: Row) => u.wins - Math.max(0, u.gamesPlayed - u.wins)

const empty = computed(() => !loading.value && !errorKey.value && users.value.length === 0)

const summary = computed(() => {
  if (!users.value.length) return null
  const admins = users.value.filter((u) => u.role === 'admin').length
  const avgWins = users.value.reduce((s, u) => s + u.wins, 0) / users.value.length
  return { total: users.value.length, admins, avgWins }
})

const filteredSorted = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = users.value
  if (q) {
    list = list.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.provider.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    )
  }
  const out = [...list]
  if (sortKey.value === 'name') {
    out.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  } else if (sortKey.value === 'wins') {
    out.sort((a, b) => b.wins - a.wins || a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  } else {
    out.sort(
      (a, b) =>
        rating(b) - rating(a) || a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
    )
  }
  return out
})

const showToolbar = computed(
  () => !loading.value && !errorKey.value && databaseConfigured.value && users.value.length > 0,
)

const noSearchMatches = computed(
  () => !loading.value && !errorKey.value && databaseConfigured.value && users.value.length > 0 && filteredSorted.value.length === 0,
)

function formatUpdated(d: Date) {
  try {
    return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'short', timeStyle: 'short' }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function exportCsv() {
  const headers = ['id', 'displayName', 'provider', 'role', 'wins', 'gamesPlayed', 'rating']
  const lines = [
    headers.join(','),
    ...filteredSorted.value.map((u) =>
      [
        escapeCsvCell(u.id),
        escapeCsvCell(u.displayName),
        escapeCsvCell(u.provider),
        escapeCsvCell(u.role),
        String(u.wins),
        String(u.gamesPlayed),
        String(rating(u)),
      ].join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
  } catch {
    return
  }
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
  copyFeedbackId.value = id
  copyFeedbackTimer = setTimeout(() => {
    copyFeedbackId.value = null
    copyFeedbackTimer = null
  }, 1600)
}

async function load() {
  loading.value = true
  errorKey.value = null
  try {
    const r = await fetch(apiUrl('/api/admin/users'), { credentials: 'include' })
    if (r.status === 403) {
      errorKey.value = 'forbidden'
      users.value = []
      return
    }
    if (!r.ok) {
      errorKey.value = 'load'
      users.value = []
      return
    }
    const j = (await r.json()) as { databaseConfigured?: boolean; users?: Row[] }
    databaseConfigured.value = j.databaseConfigured !== false
    users.value = Array.isArray(j.users) ? j.users : []
    lastUpdated.value = new Date()
  } catch {
    errorKey.value = 'load'
    users.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="w-full min-w-0 space-y-5">
    <header class="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold tracking-tight text-white">{{ t('adminPanel.usersTitle') }}</h2>
        <p class="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{{ t('adminPanel.usersLead') }}</p>
        <p v-if="lastUpdated && !loading" class="mt-2 text-xs text-slate-500">
          {{ t('adminPanel.usersUpdatedAt', { time: formatUpdated(lastUpdated) }) }}
        </p>
      </div>
      <button
        v-if="!loading"
        type="button"
        class="shrink-0 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm transition hover:bg-slate-700/90 disabled:opacity-50"
        :disabled="loading"
        @click="load"
      >
        {{ t('adminPanel.usersRefreshList') }}
      </button>
    </header>

    <p v-if="loading" class="text-sm text-slate-400">{{ t('adminPanel.usersLoading') }}</p>

    <div
      v-else-if="errorKey === 'forbidden'"
      class="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100/90"
    >
      {{ t('adminPanel.usersForbidden') }}
    </div>

    <div v-else-if="errorKey === 'load'" class="flex flex-wrap items-center gap-3">
      <p class="text-sm text-rose-300/90">{{ t('adminPanel.usersError') }}</p>
      <button
        type="button"
        class="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-600 hover:bg-slate-700"
        @click="load"
      >
        {{ t('adminPanel.commonRetry') }}
      </button>
    </div>

    <div
      v-else-if="!databaseConfigured"
      class="rounded-xl border border-amber-800/50 bg-gradient-to-br from-amber-950/30 to-slate-950/60 p-5 ring-1 ring-amber-700/20"
    >
      <p class="text-sm font-medium text-amber-100/95">{{ t('adminPanel.usersNoDb') }}</p>
      <p class="mt-2 text-xs leading-relaxed text-amber-200/70">{{ t('adminPanel.usersNoDbHint') }}</p>
    </div>

    <p v-else-if="empty" class="text-sm text-slate-400">{{ t('adminPanel.usersEmpty') }}</p>

    <template v-else>
      <div
        v-if="summary"
        class="grid gap-3 sm:grid-cols-3"
      >
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.04]">
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.usersSummaryTotal') }}</p>
          <p class="mt-1.5 text-2xl font-semibold tabular-nums text-white">{{ summary.total }}</p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.04]">
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.usersSummaryAdmins') }}</p>
          <p class="mt-1.5 text-2xl font-semibold tabular-nums text-cyan-300">{{ summary.admins }}</p>
        </div>
        <div class="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.04]">
          <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.usersSummaryAvgWins') }}</p>
          <p class="mt-1.5 text-2xl font-semibold tabular-nums text-violet-200">{{ summary.avgWins.toFixed(1) }}</p>
        </div>
      </div>

      <div
        v-if="showToolbar"
        class="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/35 p-3 ring-1 ring-white/[0.03] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      >
        <label class="flex min-w-[12rem] flex-1 flex-col gap-1.5 sm:max-w-md">
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.usersSearchLabel') }}</span>
          <input
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            class="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            :placeholder="t('adminPanel.usersSearchPlaceholder')"
          />
        </label>
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.usersSortLabel') }}</span>
            <select
              v-model="sortKey"
              class="min-w-[10rem] rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            >
              <option value="name">{{ t('adminPanel.usersSortName') }}</option>
              <option value="wins">{{ t('adminPanel.usersSortWins') }}</option>
              <option value="rating">{{ t('adminPanel.usersSortRating') }}</option>
            </select>
          </label>
          <button
            type="button"
            class="rounded-lg bg-indigo-900/80 px-3 py-2 text-xs font-semibold text-indigo-50 ring-1 ring-indigo-600/40 transition hover:bg-indigo-800/90"
            @click="exportCsv"
          >
            {{ t('adminPanel.usersExportCsv') }}
          </button>
        </div>
      </div>

      <p v-if="showToolbar" class="text-xs text-slate-500">
        {{ t('adminPanel.usersShowing', { n: filteredSorted.length, total: users.length }) }}
      </p>

      <p v-if="noSearchMatches" class="rounded-lg border border-slate-800/80 bg-slate-900/30 px-3 py-2 text-sm text-slate-400">
        {{ t('adminPanel.usersNoMatches') }}
      </p>

      <ul v-else class="space-y-2" role="list">
        <li
          v-for="u in filteredSorted"
          :key="u.id"
          class="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03] transition hover:border-slate-700/90 hover:bg-slate-900/55 sm:flex-row sm:items-center"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700"
            >
              <img
                v-if="u.avatar"
                :src="u.avatar"
                :alt="u.displayName"
                width="44"
                height="44"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-base font-semibold text-slate-400" aria-hidden="true">
                {{ u.displayName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-white">{{ u.displayName }}</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 break-all font-mono text-[10px] leading-snug text-slate-500">
                <span>
                  {{ t('adminPanel.idInternal') }}
                  <span class="text-slate-400">{{ u.id }}</span>
                </span>
                <button
                  type="button"
                  class="rounded border border-slate-700/80 bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-cyan-700/60 hover:text-cyan-200"
                  @click="copyId(u.id)"
                >
                  {{ copyFeedbackId === u.id ? t('adminPanel.usersCopied') : t('adminPanel.usersCopyId') }}
                </button>
                <span>· {{ u.provider }} ·</span>
                <span :class="u.role === 'admin' ? 'text-cyan-300' : 'text-slate-400'">{{ u.role }}</span>
              </p>
            </div>
          </div>
          <dl class="flex shrink-0 flex-wrap gap-4 text-right text-sm sm:justify-end">
            <div>
              <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.colWins') }}</dt>
              <dd class="font-semibold tabular-nums text-cyan-300">{{ u.wins }}</dd>
            </div>
            <div>
              <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.colGames') }}</dt>
              <dd class="font-semibold tabular-nums text-slate-200">{{ u.gamesPlayed }}</dd>
            </div>
            <div>
              <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.colRating') }}</dt>
              <dd class="font-semibold tabular-nums text-violet-200">{{ rating(u) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </template>
  </div>
</template>
