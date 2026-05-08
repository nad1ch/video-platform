<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminUsersState, type AdminUserRow } from '@/admin'
import { useAuth } from '@/composables/useAuth'
import { appConfirm } from '@/utils/appConfirm'
import { apiFetch } from '@/utils/apiFetch'
import { trackClientEvent } from '@/utils/clientAnalytics'

const { t, locale } = useI18n()
const auth = useAuth()

const { users, loading, errorKey, databaseConfigured, lastUpdated, load } = useAdminUsersState()

const searchQuery = ref('')
const sortKey = ref<'name' | 'wins' | 'rating'>('name')
const copyFeedbackId = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null
const rolePatchingId = ref<string | null>(null)
const rolePatchError = ref<string | null>(null)
const streamerOptions = ref<AdminStreamerOption[]>([])
const streamerOptionsLoading = ref(false)
const streamerOptionsLoaded = ref(false)
const streamerPickerUserId = ref<string | null>(null)
const streamerPickerSelection = ref('')
const detailUserId = ref<string | null>(null)
const detailActivity = ref<AdminUserActivityPayload | null>(null)
const detailActivityLoading = ref(false)
const detailActivityError = ref<string | null>(null)
let detailActivityRequestId = 0

type AdminUserActivityEvent = {
  event: string
  path: string | null
  createdAt: string
  metadata: unknown
}

type AdminUserErrorEvent = {
  message: string
  path: string | null
  source: string
  createdAt: string
  metadata: unknown
}

type AdminUserActivityPayload = {
  databaseConfigured?: boolean
  summary: {
    lastSeenAt: string | null
    totalSessions: number
    totalTimeSpentSeconds: number
    lastPath: string | null
  }
  gameSummary: {
    nadle: {
      gamesPlayed: number
      wins: number
      losses: number
      lastGameAt: string | null
    }
  }
  recentEvents: AdminUserActivityEvent[]
  recentErrors: AdminUserErrorEvent[]
}

type AdminStreamerOption = {
  id: string
  name: string
  username: string
  ownerId: string | null
}

const detailUser = computed(() => {
  if (!detailUserId.value) return null
  return users.value.find((u) => u.id === detailUserId.value) ?? null
})

const rating = (u: AdminUserRow) => u.wins - Math.max(0, u.gamesPlayed - u.wins)
type EditableRole = 'ADMIN' | 'STREAMER' | 'EAT_FIRST_OPERATOR'
type DisplayRole = 'USER' | EditableRole
const editableRoles: EditableRole[] = ['ADMIN', 'STREAMER', 'EAT_FIRST_OPERATOR']

const empty = computed(() => !loading.value && !errorKey.value && users.value.length === 0)

const summary = computed(() => {
  if (!users.value.length) return null
  const admins = users.value.filter((u) => hasSystemRole(u, 'ADMIN')).length
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
        displayRoles(u).toLowerCase().includes(q),
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

watch(users, (list) => {
  if (detailUserId.value && !list.some((u) => u.id === detailUserId.value)) {
    detailUserId.value = null
  }
})

watch(detailUserId, (userId) => {
  detailActivity.value = null
  detailActivityError.value = null
  detailActivityRequestId += 1
  if (userId) {
    void loadUserActivity(userId, detailActivityRequestId)
  }
})

function dashText(value: string | null | undefined): string {
  const s = typeof value === 'string' ? value.trim() : ''
  return s ? s : '—'
}

function formatUpdated(d: Date) {
  try {
    return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'short', timeStyle: 'short' }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

function formatIso(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return '—'
  }
  try {
    return formatUpdated(new Date(iso))
  } catch {
    return '—'
  }
}

function formatDuration(seconds: number | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0))
  if (total < 60) {
    return `${total}s`
  }
  const minutes = Math.floor(total / 60)
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return hours > 0 ? `${hours}h ${restMinutes}m` : `${minutes}m`
}

function formatMetadata(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '—'
  }
  try {
    const json = JSON.stringify(value)
    return json === '{}' ? '—' : json
  } catch {
    return '—'
  }
}

async function loadUserActivity(userId: string, requestId: number): Promise<void> {
  detailActivityLoading.value = true
  detailActivityError.value = null
  try {
    const r = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/activity`)
    if (!r.ok) {
      detailActivityError.value = 'Could not load activity.'
      return
    }
    const data = (await r.json()) as AdminUserActivityPayload
    if (requestId === detailActivityRequestId) {
      detailActivity.value = data
    }
  } catch {
    if (requestId === detailActivityRequestId) {
      detailActivityError.value = 'Could not load activity.'
    }
  } finally {
    if (requestId === detailActivityRequestId) {
      detailActivityLoading.value = false
    }
  }
}

function openUserDetail(u: AdminUserRow) {
  detailUserId.value = u.id
}

function closeUserDetail() {
  detailUserId.value = null
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !detailUserId.value) {
    return
  }
  closeUserDetail()
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
        escapeCsvCell(displayRoles(u)),
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

function normalizedRoles(u: AdminUserRow): Set<DisplayRole> {
  const roles = new Set<DisplayRole>(['USER'])
  for (const role of u.roles ?? []) {
    roles.add(role)
  }
  for (const permission of u.permissions ?? []) {
    roles.add(permission)
  }
  if (u.role === 'admin') {
    roles.add('ADMIN')
  } else if (u.role === 'host') {
    roles.add('EAT_FIRST_OPERATOR')
  }
  return roles
}

function hasSystemRole(u: AdminUserRow, role: DisplayRole): boolean {
  return normalizedRoles(u).has(role)
}

function displayRoles(u: AdminUserRow): string {
  return [...normalizedRoles(u)].map(roleLabel).join(', ')
}

function roleLabel(role: DisplayRole): string {
  if (role === 'EAT_FIRST_OPERATOR') {
    return 'Eat First operator'
  }
  return role === 'USER' ? t('adminPanel.roleUser') : role
}

function isSelfAdminRole(u: AdminUserRow, role: EditableRole): boolean {
  return role === 'ADMIN' && u.id === auth.user.value?.dbUserId
}

function roleToggleDisabled(u: AdminUserRow, role: EditableRole): boolean {
  if (rolePatchingId.value === u.id || isSelfAdminRole(u, role)) {
    return true
  }
  if (role === 'EAT_FIRST_OPERATOR' && hasSystemRole(u, 'ADMIN')) {
    return true
  }
  if (role === 'STREAMER' && !hasSystemRole(u, 'STREAMER') && !u.streamerId && !u.twitchId) {
    return true
  }
  return false
}

function canAssignStreamerViaPicker(u: AdminUserRow): boolean {
  return !hasSystemRole(u, 'STREAMER') && !u.streamerId && !u.twitchId
}

function closeStreamerRolePicker(): void {
  streamerPickerUserId.value = null
  streamerPickerSelection.value = ''
}

function streamerOptionLabel(option: AdminStreamerOption): string {
  const base = option.name.trim().length > 0 ? option.name : option.username
  return option.ownerId ? `${base} (${t('adminPanel.streamersOwnerShort')} ${option.ownerId.slice(0, 8)}…)` : base
}

async function ensureStreamerOptionsLoaded(): Promise<boolean> {
  if (streamerOptionsLoaded.value) {
    return true
  }
  streamerOptionsLoading.value = true
  try {
    const r = await apiFetch('/api/admin/streamers')
    if (!r.ok) {
      rolePatchError.value = t('adminPanel.usersStreamerOptionsLoadError')
      return false
    }
    const payload = (await r.json()) as {
      streamers?: Array<{
        id: string
        name: string
        username: string
        isActive: boolean
        ownerId: string | null
      }>
    }
    streamerOptions.value = (payload.streamers ?? [])
      .filter((streamer) => streamer.isActive)
      .map((streamer) => ({
        id: streamer.id,
        name: streamer.name,
        username: streamer.username,
        ownerId: streamer.ownerId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    streamerOptionsLoaded.value = true
    return true
  } catch {
    rolePatchError.value = t('adminPanel.usersStreamerOptionsLoadError')
    return false
  } finally {
    streamerOptionsLoading.value = false
  }
}

async function patchUserRoles(
  u: AdminUserRow,
  nextRoles: Set<DisplayRole>,
  streamerIdOverride?: string,
): Promise<boolean> {
  rolePatchError.value = null
  rolePatchingId.value = u.id
  try {
    const roles = [...nextRoles].filter((role): role is 'USER' | 'ADMIN' | 'STREAMER' =>
      role === 'USER' || role === 'ADMIN' || role === 'STREAMER',
    )
    const permissions = [...nextRoles].filter(
      (role): role is 'EAT_FIRST_OPERATOR' => role === 'EAT_FIRST_OPERATOR',
    )
    const streamerId =
      typeof streamerIdOverride === 'string' && streamerIdOverride.length > 0
        ? streamerIdOverride
        : u.streamerId
    const r = await apiFetch(`/api/admin/users/${encodeURIComponent(u.id)}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles, permissions, ...(streamerId ? { streamerId } : {}) }),
    })
    if (!r.ok) {
      rolePatchError.value = t('adminPanel.usersRolePatchError')
      return false
    }
    await load()
    return true
  } catch {
    rolePatchError.value = t('adminPanel.usersRolePatchError')
    return false
  } finally {
    rolePatchingId.value = null
  }
}

async function onRoleToggle(u: AdminUserRow, role: EditableRole, ev: Event) {
  const input = ev.target as HTMLInputElement
  if (roleToggleDisabled(u, role)) {
    input.checked = hasSystemRole(u, role)
    return
  }
  trackClientEvent('admin_role_toggle_clicked', { targetUserId: u.id, role, enabled: input.checked })
  if (!input.checked && role === 'ADMIN' && !appConfirm(`Remove ADMIN from ${u.displayName}? They will lose admin panel access.`)) {
    input.checked = true
    return
  }
  if (
    !input.checked &&
    role === 'STREAMER' &&
    !appConfirm(`Remove STREAMER from ${u.displayName}? This clears streamer ownership and streamer context.`)
  ) {
    input.checked = true
    return
  }
  const nextRoles = normalizedRoles(u)
  if (input.checked) {
    nextRoles.add(role)
  } else {
    nextRoles.delete(role)
  }
  nextRoles.add('USER')
  if (nextRoles.has('ADMIN')) {
    nextRoles.delete('EAT_FIRST_OPERATOR')
  }
  const ok = await patchUserRoles(u, nextRoles)
  if (!ok) {
    input.checked = hasSystemRole(u, role)
  }
}

async function openStreamerRolePicker(u: AdminUserRow): Promise<void> {
  if (streamerPickerUserId.value === u.id) {
    closeStreamerRolePicker()
    return
  }
  rolePatchError.value = null
  const loaded = await ensureStreamerOptionsLoaded()
  if (!loaded) {
    return
  }
  streamerPickerUserId.value = u.id
  const firstFree = streamerOptions.value.find((streamer) => streamer.ownerId == null)
  streamerPickerSelection.value = firstFree?.id ?? streamerOptions.value[0]?.id ?? ''
}

async function assignStreamerRoleFromPicker(u: AdminUserRow): Promise<void> {
  const streamerId = streamerPickerSelection.value
  if (!streamerId) {
    rolePatchError.value = t('adminPanel.usersStreamerPickerRequired')
    return
  }
  const nextRoles = normalizedRoles(u)
  nextRoles.add('STREAMER')
  nextRoles.add('USER')
  if (nextRoles.has('ADMIN')) {
    nextRoles.delete('EAT_FIRST_OPERATOR')
  }
  const ok = await patchUserRoles(u, nextRoles, streamerId)
  if (ok) {
    closeStreamerRolePicker()
  }
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

onMounted(() => {
  void load()
  document.addEventListener('keydown', onDocKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
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
      <p v-if="rolePatchError" class="mb-2 text-sm text-rose-300/90">{{ rolePatchError }}</p>
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
          class="flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03] transition hover:border-slate-700/90 hover:bg-slate-900/55 sm:flex-row sm:items-center"
          @click="openUserDetail(u)"
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
                  @click.stop="copyId(u.id)"
                >
                  {{ copyFeedbackId === u.id ? t('adminPanel.usersCopied') : t('adminPanel.usersCopyId') }}
                </button>
                <span>· {{ u.provider }} ·</span>
                <span class="rounded border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-slate-300">
                  {{ roleLabel('USER') }}
                </span>
                <span class="inline-flex flex-wrap items-center gap-1" @click.stop>
                  <label
                    v-for="role in editableRoles"
                    :key="role"
                    class="inline-flex items-center gap-1 rounded border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-slate-200"
                    :class="{ 'opacity-50': roleToggleDisabled(u, role) }"
                  >
                    <input
                      type="checkbox"
                      class="h-3 w-3 accent-cyan-500"
                      :checked="hasSystemRole(u, role)"
                      :disabled="roleToggleDisabled(u, role)"
                      :aria-label="`${roleLabel(role)} ${u.displayName}`"
                      @change="onRoleToggle(u, role, $event)"
                    />
                    <span>{{ roleLabel(role) }}</span>
                  </label>
                </span>
                <button
                  v-if="canAssignStreamerViaPicker(u)"
                  type="button"
                  class="rounded border border-violet-600/70 bg-violet-900/50 px-1.5 py-0.5 text-[10px] font-medium text-violet-100 transition hover:bg-violet-800/70"
                  @click.stop="openStreamerRolePicker(u)"
                >
                  {{ t('adminPanel.usersAddStreamerRole') }}
                </button>
                <span
                  v-if="streamerPickerUserId === u.id"
                  class="mt-1 inline-flex flex-wrap items-center gap-1 rounded border border-slate-700/70 bg-slate-950/80 px-2 py-1"
                  @click.stop
                >
                  <span class="text-[10px] text-slate-400">{{ t('adminPanel.usersStreamerPickerLabel') }}</span>
                  <span v-if="streamerOptionsLoading" class="text-[10px] text-slate-400">
                    {{ t('adminPanel.usersStreamerPickerLoading') }}
                  </span>
                  <template v-else>
                    <select
                      v-model="streamerPickerSelection"
                      class="min-w-[10rem] rounded border border-slate-700/80 bg-slate-950/80 px-1.5 py-1 text-[10px] text-slate-100 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                    >
                      <option disabled value="">{{ t('adminPanel.usersStreamerPickerPlaceholder') }}</option>
                      <option v-for="streamer in streamerOptions" :key="streamer.id" :value="streamer.id">
                        {{ streamerOptionLabel(streamer) }}
                      </option>
                    </select>
                    <button
                      type="button"
                      class="rounded border border-cyan-700/70 bg-cyan-900/50 px-1.5 py-1 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-800/70 disabled:opacity-50"
                      :disabled="rolePatchingId === u.id || streamerOptions.length === 0"
                      @click.stop="assignStreamerRoleFromPicker(u)"
                    >
                      {{ t('adminPanel.usersStreamerPickerApply') }}
                    </button>
                    <button
                      type="button"
                      class="rounded border border-slate-700/80 bg-slate-900/70 px-1.5 py-1 text-[10px] font-medium text-slate-200 transition hover:bg-slate-800/70"
                      @click.stop="closeStreamerRolePicker"
                    >
                      {{ t('adminPanel.usersStreamerPickerCancel') }}
                    </button>
                    <span v-if="streamerOptions.length === 0" class="text-[10px] text-amber-300/90">
                      {{ t('adminPanel.usersStreamerPickerEmpty') }}
                    </span>
                  </template>
                </span>
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

      <Teleport to="body">
        <div
          v-if="detailUser"
          class="fixed inset-0 z-[90] flex justify-end"
          role="presentation"
        >
          <button
            type="button"
            class="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            :aria-label="t('adminPanel.usersDetailClose')"
            @click="closeUserDetail"
          />
          <aside
            class="relative flex h-full w-full max-w-md flex-col border-l border-slate-800/90 bg-slate-950 shadow-2xl shadow-black/40"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="'admin-user-detail-title'"
          >
            <div class="flex items-start justify-between gap-3 border-b border-slate-800/80 p-4">
              <h3 id="admin-user-detail-title" class="min-w-0 text-lg font-semibold tracking-tight text-white">
                {{ t('adminPanel.usersDetailTitle') }}
              </h3>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                @click="closeUserDetail"
              >
                {{ t('adminPanel.usersDetailClose') }}
              </button>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-4">
              <div class="flex gap-4">
                <div
                  class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700"
                >
                  <img
                    v-if="detailUser.avatar"
                    :src="detailUser.avatar"
                    :alt="detailUser.displayName"
                    width="64"
                    height="64"
                    class="h-full w-full object-cover"
                  />
                  <span v-else class="text-xl font-semibold text-slate-400" aria-hidden="true">
                    {{ detailUser.displayName.charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-base font-medium text-white">{{ detailUser.displayName }}</p>
                  <p class="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {{ dashText(detailUser.id) }}
                  </p>
                  <button
                    type="button"
                    class="mt-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-700/50 hover:text-cyan-200"
                    @click="copyId(detailUser.id)"
                  >
                    {{
                      copyFeedbackId === detailUser.id ? t('adminPanel.usersCopied') : t('adminPanel.usersCopyId')
                    }}
                  </button>
                </div>
              </div>
              <dl class="mt-6 space-y-3 text-sm">
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.colProvider') }}
                  </dt>
                  <dd class="text-slate-200">{{ dashText(detailUser.provider) }}</dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.usersDetailLegacyRole') }}
                  </dt>
                  <dd class="font-mono text-slate-200">{{ dashText(detailUser.role) }}</dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.usersDetailRoles') }}
                  </dt>
                  <dd class="text-slate-200">{{ dashText(displayRoles(detailUser)) }}</dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.usersDetailTwitchId') }}
                  </dt>
                  <dd class="break-all font-mono text-slate-200">{{ dashText(detailUser.twitchId) }}</dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.usersDetailStreamerId') }}
                  </dt>
                  <dd class="break-all font-mono text-slate-200">{{ dashText(detailUser.streamerId) }}</dd>
                </div>
                <div class="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {{ t('adminPanel.colWins') }}
                    </dt>
                    <dd class="font-semibold tabular-nums text-cyan-300">{{ detailUser.wins }}</dd>
                  </div>
                  <div>
                    <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {{ t('adminPanel.colGames') }}
                    </dt>
                    <dd class="font-semibold tabular-nums text-slate-200">{{ detailUser.gamesPlayed }}</dd>
                  </div>
                  <div>
                    <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {{ t('adminPanel.colRating') }}
                    </dt>
                    <dd class="font-semibold tabular-nums text-violet-200">{{ rating(detailUser) }}</dd>
                  </div>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.usersDetailCreated') }}
                  </dt>
                  <dd class="text-slate-200">{{ formatIso(detailUser.createdAt) }}</dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {{ t('adminPanel.usersDetailUpdated') }}
                  </dt>
                  <dd class="text-slate-200">{{ formatIso(detailUser.updatedAt) }}</dd>
                </div>
              </dl>
              <section class="mt-6 border-t border-slate-800/80 pt-5">
                <div class="flex items-center justify-between gap-3">
                  <h4 class="text-sm font-semibold text-white">Activity</h4>
                  <span v-if="detailActivityLoading" class="text-xs text-slate-500">Loading…</span>
                </div>
                <p v-if="detailActivityError" class="mt-2 text-xs text-rose-300">{{ detailActivityError }}</p>
                <template v-else-if="detailActivity">
                  <dl class="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div class="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3">
                      <dt class="uppercase tracking-wide text-slate-500">Last seen</dt>
                      <dd class="mt-1 text-slate-200">{{ formatIso(detailActivity.summary.lastSeenAt) }}</dd>
                    </div>
                    <div class="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3">
                      <dt class="uppercase tracking-wide text-slate-500">Sessions</dt>
                      <dd class="mt-1 tabular-nums text-slate-200">{{ detailActivity.summary.totalSessions }}</dd>
                    </div>
                    <div class="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3">
                      <dt class="uppercase tracking-wide text-slate-500">Time spent</dt>
                      <dd class="mt-1 tabular-nums text-slate-200">
                        {{ formatDuration(detailActivity.summary.totalTimeSpentSeconds) }}
                      </dd>
                    </div>
                    <div class="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3">
                      <dt class="uppercase tracking-wide text-slate-500">Last path</dt>
                      <dd class="mt-1 break-all font-mono text-[11px] text-slate-200">
                        {{ dashText(detailActivity.summary.lastPath) }}
                      </dd>
                    </div>
                  </dl>

                  <div class="mt-5 rounded-lg border border-slate-800/80 bg-slate-900/35 p-3">
                    <h5 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Nadle / Wordle</h5>
                    <dl class="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <dt class="text-slate-500">Played</dt>
                        <dd class="tabular-nums text-slate-200">{{ detailActivity.gameSummary.nadle.gamesPlayed }}</dd>
                      </div>
                      <div>
                        <dt class="text-slate-500">Wins</dt>
                        <dd class="tabular-nums text-cyan-300">{{ detailActivity.gameSummary.nadle.wins }}</dd>
                      </div>
                      <div>
                        <dt class="text-slate-500">Losses</dt>
                        <dd class="tabular-nums text-slate-200">{{ detailActivity.gameSummary.nadle.losses }}</dd>
                      </div>
                      <div>
                        <dt class="text-slate-500">Last</dt>
                        <dd class="text-slate-200">{{ formatIso(detailActivity.gameSummary.nadle.lastGameAt) }}</dd>
                      </div>
                    </dl>
                  </div>

                  <div class="mt-5">
                    <h5 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity events</h5>
                    <p v-if="detailActivity.recentEvents.length === 0" class="mt-2 text-xs text-slate-500">No events yet.</p>
                    <ul v-else class="mt-2 space-y-2">
                      <li
                        v-for="event in detailActivity.recentEvents"
                        :key="`${event.event}-${event.createdAt}`"
                        class="rounded-lg border border-slate-800/80 bg-slate-900/35 p-3 text-xs"
                      >
                        <p class="font-medium text-slate-200">{{ event.event }}</p>
                        <p class="mt-1 break-all font-mono text-[11px] text-slate-500">{{ dashText(event.path) }}</p>
                        <p class="mt-1 text-slate-500">{{ formatIso(event.createdAt) }}</p>
                        <p class="mt-1 break-all font-mono text-[10px] text-slate-600">
                          {{ formatMetadata(event.metadata) }}
                        </p>
                      </li>
                    </ul>
                  </div>

                  <div class="mt-5">
                    <h5 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent errors</h5>
                    <p v-if="detailActivity.recentErrors.length === 0" class="mt-2 text-xs text-slate-500">No errors yet.</p>
                    <ul v-else class="mt-2 space-y-2">
                      <li
                        v-for="event in detailActivity.recentErrors"
                        :key="`${event.source}-${event.createdAt}`"
                        class="rounded-lg border border-rose-950/70 bg-rose-950/15 p-3 text-xs"
                      >
                        <p class="font-medium text-rose-100">{{ event.message }}</p>
                        <p class="mt-1 break-all font-mono text-[11px] text-slate-500">{{ dashText(event.path) }}</p>
                        <p class="mt-1 text-slate-500">{{ event.source }} · {{ formatIso(event.createdAt) }}</p>
                        <p class="mt-1 break-all font-mono text-[10px] text-slate-600">
                          {{ formatMetadata(event.metadata) }}
                        </p>
                      </li>
                    </ul>
                  </div>
                </template>
              </section>
              <p class="mt-6 text-xs leading-relaxed text-slate-500">{{ t('adminPanel.usersDetailHint') }}</p>
            </div>
          </aside>
        </div>
      </Teleport>
    </template>
  </div>
</template>
