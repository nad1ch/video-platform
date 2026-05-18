<script setup lang="ts">
/**
 * Admin diagnostics page — list/view/copy/download finalized
 * `RoomDiagnosticReport` rows produced by D1.3 persistence.
 *
 * No new component dependencies: plain HTML + Tailwind, fetch via the
 * shared `apiFetch` helper that every other admin page uses. Detail
 * view is a `Teleport`-based side panel matching `AdminUsers.vue`.
 *
 * Buttons: View, Copy JSON, Download JSON, Copy AI Prompt + JSON.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { apiFetch } from '@/utils/apiFetch'

interface ReportListItem {
  id: string
  roomId: string
  gameType: string | null
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  eventCount: number
  warningCount: number
  errorCount: number
  criticalCount: number
  hasErrors: boolean
  hasWarnings: boolean
  truncated: boolean
  hostUserId: string | null
  hostDisplayName: string | null
  participantCount: number | null
  finalizedReason: string | null
  createdAt: string
}

interface ReportListResponse {
  total: number
  limit: number
  offset: number
  items: ReportListItem[]
}

interface ReportDetail extends ReportListItem {
  reportJson: Record<string, unknown>
}

const DEFAULT_LIMIT = 50
const COPY_FEEDBACK_MS = 1600

const AI_PROMPT_PREAMBLE = [
  'Analyze this StreamAssist GameSessionReport.',
  '',
  'Find:',
  '1. What failed',
  '2. When it failed',
  '3. Who was affected',
  '4. Whether it is client/server/WS/WebRTC/playback/game/backend',
  '5. Events that happened right before the failure',
  '6. Most likely root cause',
  '7. Exact files/flows to inspect next',
  '8. Minimal fix direction',
  '9. QA checklist',
  '',
  'Report JSON:',
].join('\n')

const items = ref<ReportListItem[]>([])
const total = ref(0)
const offset = ref(0)
const loading = ref(false)
const errorKey = ref<string | null>(null)

const filterGameType = ref<string>('')
const filterRoomId = ref<string>('')
const filterHasErrors = ref<'' | '1' | '0'>('')
/**
 * `<input type="datetime-local">` values (`YYYY-MM-DDTHH:mm`) in the
 * admin's local timezone. Converted to a UTC ISO string via
 * `localDateTimeToIsoOrNull` before being sent to the API; invalid /
 * empty values are simply omitted so the existing default behavior
 * (no date filter) is preserved.
 */
const filterDateFrom = ref<string>('')
const filterDateTo = ref<string>('')

const detail = ref<ReportDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)
const copyFeedback = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const hasNext = computed(() => offset.value + items.value.length < total.value)
const hasPrev = computed(() => offset.value > 0)

function localDateTimeToIsoOrNull(local: string): string | null {
  if (!local) return null
  const ms = Date.parse(local)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

async function loadList(): Promise<void> {
  loading.value = true
  errorKey.value = null
  try {
    const qs = new URLSearchParams()
    qs.set('limit', String(DEFAULT_LIMIT))
    qs.set('offset', String(offset.value))
    if (filterGameType.value) qs.set('gameType', filterGameType.value)
    if (filterRoomId.value) qs.set('roomId', filterRoomId.value)
    if (filterHasErrors.value) qs.set('hasErrors', filterHasErrors.value)
    const dateFromIso = localDateTimeToIsoOrNull(filterDateFrom.value)
    if (dateFromIso) qs.set('dateFrom', dateFromIso)
    const dateToIso = localDateTimeToIsoOrNull(filterDateTo.value)
    if (dateToIso) qs.set('dateTo', dateToIso)
    const res = await apiFetch(`/api/admin/diagnostics/reports?${qs.toString()}`)
    if (!res.ok) {
      errorKey.value = `error_${res.status}`
      items.value = []
      total.value = 0
      return
    }
    const body = (await res.json()) as ReportListResponse
    items.value = body.items
    total.value = body.total
  } catch (err) {
    errorKey.value = err instanceof Error ? err.message : 'unknown_error'
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function openDetail(id: string): Promise<void> {
  detailLoading.value = true
  detailError.value = null
  detail.value = null
  try {
    const res = await apiFetch(`/api/admin/diagnostics/reports/${encodeURIComponent(id)}`)
    if (!res.ok) {
      detailError.value = `error_${res.status}`
      return
    }
    detail.value = (await res.json()) as ReportDetail
  } catch (err) {
    detailError.value = err instanceof Error ? err.message : 'unknown_error'
  } finally {
    detailLoading.value = false
  }
}

function closeDetail(): void {
  detail.value = null
  detailError.value = null
}

function showCopyFeedback(text: string): void {
  copyFeedback.value = text
  if (copyFeedbackTimer != null) clearTimeout(copyFeedbackTimer)
  copyFeedbackTimer = setTimeout(() => {
    copyFeedback.value = null
    copyFeedbackTimer = null
  }, COPY_FEEDBACK_MS)
}

async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    showCopyFeedback(`Copied: ${label}`)
  } catch {
    showCopyFeedback('Copy failed — clipboard blocked')
  }
}

function copyReportJson(report: ReportDetail): void {
  const json = JSON.stringify(report.reportJson, null, 2)
  void copyToClipboard(json, 'raw JSON')
}

function copyAiPrompt(report: ReportDetail): void {
  const json = JSON.stringify(report.reportJson, null, 2)
  void copyToClipboard(`${AI_PROMPT_PREAMBLE}\n${json}`, 'AI prompt + JSON')
}

function downloadReportJson(id: string): void {
  // The download endpoint returns the raw reportJson with the right
  // Content-Disposition header — opening it in a new tab triggers the
  // browser save dialog.
  window.open(
    `/api/admin/diagnostics/reports/${encodeURIComponent(id)}/download`,
    '_blank',
    'noopener',
  )
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function applyFilters(): void {
  offset.value = 0
  void loadList()
}

function clearFilters(): void {
  filterGameType.value = ''
  filterRoomId.value = ''
  filterHasErrors.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  applyFilters()
}

function nextPage(): void {
  if (!hasNext.value) return
  offset.value += DEFAULT_LIMIT
  void loadList()
}

function prevPage(): void {
  if (!hasPrev.value) return
  offset.value = Math.max(0, offset.value - DEFAULT_LIMIT)
  void loadList()
}

onMounted(() => {
  void loadList()
})

watch(filterHasErrors, () => applyFilters())
</script>

<template>
  <div class="flex flex-col gap-4 text-slate-100">
    <header class="flex flex-col gap-1 border-b border-white/5 pb-3">
      <h2 class="text-lg font-semibold tracking-tight text-white">RoomDiagnostics — Reports</h2>
      <p class="text-xs text-slate-400">
        Finalized reports for ended rooms. Reports finalize after the empty-room grace window.
        Click a row to view, copy raw JSON, copy an AI analysis prompt, or download the file.
      </p>
    </header>

    <section class="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        Game type
        <select
          v-model="filterGameType"
          class="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
          @change="applyFilters"
        >
          <option value="">Any</option>
          <option value="mafia">mafia</option>
          <option value="game-room">game-room</option>
          <option value="eat-first">eat-first</option>
          <option value="nadle">nadle</option>
          <option value="nadraw-show">nadraw-show</option>
          <option value="checkers">checkers</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        Room id (exact)
        <input
          v-model="filterRoomId"
          type="text"
          placeholder="mafia:foo"
          class="w-56 rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
          @keyup.enter="applyFilters"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        Errors
        <select
          v-model="filterHasErrors"
          class="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
        >
          <option value="">Any</option>
          <option value="1">Has errors</option>
          <option value="0">Clean</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        From (created)
        <input
          v-model="filterDateFrom"
          type="datetime-local"
          class="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
          @keyup.enter="applyFilters"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">
        To (created)
        <input
          v-model="filterDateTo"
          type="datetime-local"
          class="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100"
          @keyup.enter="applyFilters"
        />
      </label>
      <button
        type="button"
        class="rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-sm font-medium text-violet-50 hover:bg-violet-600/40"
        @click="applyFilters"
      >
        Apply
      </button>
      <button
        type="button"
        class="rounded-md border border-white/10 bg-slate-800/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/70"
        @click="clearFilters"
      >
        Clear
      </button>
      <span v-if="copyFeedback" class="ml-auto text-xs text-emerald-300">{{ copyFeedback }}</span>
    </section>

    <section class="rounded-2xl border border-white/10 bg-slate-950/40">
      <div class="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-slate-400">
        <span>{{ total }} total · showing {{ items.length }} from offset {{ offset }}</span>
        <span v-if="loading">Loading…</span>
        <span v-else-if="errorKey" class="text-red-300">{{ errorKey }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-white/5 text-sm">
          <thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-2 text-left">Created</th>
              <th class="px-3 py-2 text-left">Room id</th>
              <th class="px-3 py-2 text-left">Game</th>
              <th class="px-3 py-2 text-right">Duration</th>
              <th class="px-3 py-2 text-right">Events</th>
              <th class="px-3 py-2 text-right">Errors</th>
              <th class="px-3 py-2 text-right">Warns</th>
              <th class="px-3 py-2 text-left">Flags</th>
              <th class="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-if="items.length === 0 && !loading">
              <td colspan="9" class="px-3 py-6 text-center text-xs text-slate-500">No reports.</td>
            </tr>
            <tr v-for="row in items" :key="row.id" class="hover:bg-white/[0.04]">
              <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400">{{ formatDateTime(row.createdAt) }}</td>
              <td class="px-3 py-2 font-mono text-xs">{{ row.roomId }}</td>
              <td class="px-3 py-2 text-xs">{{ row.gameType ?? '—' }}</td>
              <td class="px-3 py-2 text-right font-mono text-xs">{{ formatDuration(row.durationMs) }}</td>
              <td class="px-3 py-2 text-right font-mono text-xs">{{ row.eventCount }}</td>
              <td
                class="px-3 py-2 text-right font-mono text-xs"
                :class="row.hasErrors ? 'text-red-300' : 'text-slate-500'"
              >
                {{ row.errorCount + row.criticalCount }}
              </td>
              <td
                class="px-3 py-2 text-right font-mono text-xs"
                :class="row.hasWarnings ? 'text-amber-300' : 'text-slate-500'"
              >
                {{ row.warningCount }}
              </td>
              <td class="px-3 py-2 text-xs">
                <span v-if="row.truncated" class="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-300">truncated</span>
                <span v-if="row.finalizedReason === 'forced'" class="ml-1 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-rose-300">forced</span>
              </td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-1">
                  <button
                    type="button"
                    class="rounded-md border border-white/10 bg-slate-800/70 px-2 py-1 text-xs hover:bg-slate-700/70"
                    @click="openDetail(row.id)"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-white/10 bg-slate-800/70 px-2 py-1 text-xs hover:bg-slate-700/70"
                    @click="downloadReportJson(row.id)"
                  >
                    Download
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between border-t border-white/5 px-3 py-2 text-xs text-slate-400">
        <button
          type="button"
          class="rounded-md border border-white/10 bg-slate-800/70 px-3 py-1 disabled:opacity-40"
          :disabled="!hasPrev"
          @click="prevPage"
        >
          Prev
        </button>
        <span>Page {{ Math.floor(offset / DEFAULT_LIMIT) + 1 }}</span>
        <button
          type="button"
          class="rounded-md border border-white/10 bg-slate-800/70 px-3 py-1 disabled:opacity-40"
          :disabled="!hasNext"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="detail || detailLoading || detailError"
        class="fixed inset-0 z-[90] flex"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          class="flex-1 cursor-default bg-black/55 backdrop-blur"
          aria-label="Close detail"
          @click="closeDetail"
        />
        <aside class="flex h-full w-full max-w-[820px] flex-col gap-3 overflow-hidden border-l border-white/10 bg-[#0a0512] p-5 text-slate-100 shadow-2xl">
          <header class="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
            <div class="min-w-0">
              <h3 class="truncate text-base font-semibold">
                {{ detail?.roomId ?? 'Loading…' }}
              </h3>
              <p class="text-xs text-slate-400">
                <span v-if="detail">
                  {{ detail.gameType ?? '—' }} · started {{ formatDateTime(detail.startedAt) }} ·
                  duration {{ formatDuration(detail.durationMs) }} ·
                  {{ detail.eventCount }} events
                </span>
              </p>
            </div>
            <button
              type="button"
              class="rounded-md border border-white/10 bg-slate-800/70 px-2 py-1 text-xs"
              @click="closeDetail"
            >
              Close
            </button>
          </header>
          <div v-if="detailLoading" class="text-sm text-slate-400">Loading detail…</div>
          <div v-else-if="detailError" class="text-sm text-red-300">{{ detailError }}</div>
          <div v-else-if="detail" class="flex min-h-0 flex-1 flex-col gap-3">
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-xs font-medium hover:bg-violet-600/40"
                @click="copyReportJson(detail)"
              >
                Copy raw JSON
              </button>
              <button
                type="button"
                class="rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-xs font-medium hover:bg-violet-600/40"
                @click="copyAiPrompt(detail)"
              >
                Copy AI prompt + JSON
              </button>
              <button
                type="button"
                class="rounded-md border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs"
                @click="downloadReportJson(detail.id)"
              >
                Download
              </button>
              <span v-if="copyFeedback" class="ml-auto self-center text-xs text-emerald-300">{{ copyFeedback }}</span>
            </div>
            <div class="rounded-md border border-white/10 bg-slate-950/60 p-3 text-xs">
              <p>Host: <span class="font-mono">{{ detail.hostDisplayName ?? '—' }}</span> ({{ detail.hostUserId ?? '—' }})</p>
              <p>Participants: {{ detail.participantCount ?? '—' }}</p>
              <p>
                Counts: errors {{ detail.errorCount }} · critical {{ detail.criticalCount }} ·
                warnings {{ detail.warningCount }}
              </p>
              <p>
                Flags:
                <span v-if="detail.hasErrors" class="text-red-300">has-errors</span>
                <span v-if="detail.hasWarnings" class="ml-2 text-amber-300">has-warnings</span>
                <span v-if="detail.truncated" class="ml-2 text-amber-300">truncated</span>
                <span v-if="detail.finalizedReason" class="ml-2 text-slate-400">finalized: {{ detail.finalizedReason }}</span>
              </p>
            </div>
            <pre class="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-200">{{ JSON.stringify(detail.reportJson, null, 2) }}</pre>
          </div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>
