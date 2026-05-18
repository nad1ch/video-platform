<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  adminGrant,
  adminPredictions,
  adminRevoke,
  adminUserHistory,
  type AdminHistoryRow,
  type AdminPredictionRow,
  type EconomyApiError,
} from '@/features/economy/api/economyApi'

/**
 * Admin Economy panel — grant/revoke coins and XP, browse a user's economy
 * history, and inspect predictions across streamers. Mounted under
 * /app/admin/economy via the admin shell. Backend already gates every route
 * with `requireAdmin`; this UI is purely a convenient surface.
 */

const targetUserId = ref('')
const coinAmount = ref<number | null>(null)
const xpAmount = ref<number | null>(null)
const reason = ref('')
const idempotencyKey = ref('')

const operation = ref<'grant' | 'revoke'>('grant')
const busy = ref(false)
const flashMessage = ref<string | null>(null)
const opError = ref<EconomyApiError | null>(null)
const lastResult = ref<{
  coinDelta: number
  xpDelta: number
  coinBalanceAfter: number
  xpBalanceAfter: number
  replay: boolean
} | null>(null)

function applyError(slot: 'op' | 'history' | 'predictions', err: unknown): EconomyApiError {
  const e: EconomyApiError =
    err && typeof err === 'object' && 'status' in (err as Record<string, unknown>)
      ? (err as EconomyApiError)
      : { status: 0, code: 'NETWORK', message: (err as Error)?.message ?? 'Network error' }
  if (slot === 'op') opError.value = e
  else if (slot === 'history') historyError.value = e
  else predictionsError.value = e
  return e
}

const canSubmit = computed(() => {
  if (busy.value) return false
  if (!targetUserId.value.trim()) return false
  const coin = coinAmount.value ?? 0
  const xp = xpAmount.value ?? 0
  if (coin <= 0 && xp <= 0) return false
  if (operation.value === 'revoke' && reason.value.trim().length === 0) return false
  return true
})

async function submitMutation(): Promise<void> {
  if (!canSubmit.value) return
  if (operation.value === 'revoke') {
    const ok = window.confirm(
      `Revoke ${coinAmount.value ?? 0} coins and ${xpAmount.value ?? 0} XP from user ${targetUserId.value}? This is irreversible.`,
    )
    if (!ok) return
  }
  busy.value = true
  opError.value = null
  flashMessage.value = null
  lastResult.value = null
  const payload = {
    coinAmount: coinAmount.value ?? 0,
    xpAmount: xpAmount.value ?? 0,
    reason: reason.value.trim() || null,
    idempotencyKey: idempotencyKey.value.trim() || null,
  }
  try {
    const r =
      operation.value === 'grant'
        ? await adminGrant(targetUserId.value.trim(), payload)
        : await adminRevoke(targetUserId.value.trim(), payload)
    lastResult.value = {
      coinDelta: r.coinDelta,
      xpDelta: r.xpDelta,
      coinBalanceAfter: r.coinBalanceAfter,
      xpBalanceAfter: r.xpBalanceAfter,
      replay: r.idempotentReplay,
    }
    flashMessage.value = r.idempotentReplay
      ? 'Idempotent replay — no new ledger row written.'
      : `${operation.value === 'grant' ? 'Granted' : 'Revoked'} successfully.`
    void loadHistory()
  } catch (err) {
    applyError('op', err)
  } finally {
    busy.value = false
  }
}

// History
const history = ref<AdminHistoryRow[]>([])
const historyLoading = ref(false)
const historyCursor = ref<string | null>(null)
const historyHasMore = ref(true)
const historyError = ref<EconomyApiError | null>(null)
const historyUserId = ref('')

async function loadHistory(opts?: { reset?: boolean }): Promise<void> {
  const id = targetUserId.value.trim()
  if (!id) return
  if (historyLoading.value) return
  const reset = opts?.reset === true || id !== historyUserId.value
  if (reset) {
    history.value = []
    historyCursor.value = null
    historyHasMore.value = true
    historyUserId.value = id
  }
  if (!historyHasMore.value && !reset) return
  historyLoading.value = true
  historyError.value = null
  try {
    const r = await adminUserHistory(id, { cursor: historyCursor.value, limit: 25 })
    history.value = reset ? r.rows : [...history.value, ...r.rows]
    historyCursor.value = r.nextCursor
    historyHasMore.value = r.nextCursor !== null
  } catch (err) {
    applyError('history', err)
  } finally {
    historyLoading.value = false
  }
}

// Predictions list
const predictionsList = ref<AdminPredictionRow[]>([])
const predictionsLoading = ref(false)
const predictionsCursor = ref<string | null>(null)
const predictionsHasMore = ref(true)
const predictionsError = ref<EconomyApiError | null>(null)
const predictionsFilter = reactive({ status: '' as '' | 'open' | 'locked' | 'resolved' | 'cancelled' })

async function loadPredictions(opts?: { reset?: boolean }): Promise<void> {
  if (predictionsLoading.value) return
  if (opts?.reset) {
    predictionsList.value = []
    predictionsCursor.value = null
    predictionsHasMore.value = true
  }
  if (!predictionsHasMore.value && !opts?.reset) return
  predictionsLoading.value = true
  predictionsError.value = null
  try {
    const r = await adminPredictions({
      status: predictionsFilter.status || undefined,
      cursor: predictionsCursor.value,
      limit: 50,
    })
    predictionsList.value = opts?.reset ? r.rows : [...predictionsList.value, ...r.rows]
    predictionsCursor.value = r.nextCursor
    predictionsHasMore.value = r.nextCursor !== null
  } catch (err) {
    applyError('predictions', err)
  } finally {
    predictionsLoading.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-6 p-4 text-slate-100 md:p-6">
    <header class="flex flex-col gap-1">
      <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">Admin · Economy</p>
      <h1 class="text-xl font-semibold tracking-tight text-white">Grants, revokes, and audit</h1>
      <p class="text-xs text-slate-400">
        All mutations are server-authoritative and audited. Revokes refuse to drive the balance below zero.
      </p>
    </header>

    <div
      v-if="flashMessage"
      class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
    >
      {{ flashMessage }}
    </div>
    <div
      v-if="opError"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      {{ opError.code }} · {{ opError.message }}
    </div>

    <section class="grid gap-4 lg:grid-cols-[420px_1fr]">
      <form
        class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4"
        @submit.prevent="submitMutation"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-semibold transition"
            :class="
              operation === 'grant'
                ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100'
                : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
            "
            @click="operation = 'grant'"
          >
            Grant
          </button>
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-semibold transition"
            :class="
              operation === 'revoke'
                ? 'border-rose-300/40 bg-rose-400/10 text-rose-100'
                : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
            "
            @click="operation = 'revoke'"
          >
            Revoke
          </button>
        </div>

        <label class="flex flex-col gap-1 text-xs text-slate-400">
          User id (Prisma User.id)
          <input
            v-model="targetUserId"
            type="text"
            class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-400/40"
            placeholder="clxxxxxxxxxx…"
          />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-xs text-slate-400">
            Coins
            <input
              v-model.number="coinAmount"
              type="number"
              min="0"
              class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
            />
          </label>
          <label class="flex flex-col gap-1 text-xs text-slate-400">
            XP
            <input
              v-model.number="xpAmount"
              type="number"
              min="0"
              class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
            />
          </label>
        </div>
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          Reason {{ operation === 'revoke' ? '(required)' : '(optional)' }}
          <input
            v-model="reason"
            type="text"
            class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/40"
            placeholder="e.g. support-1234"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          Idempotency key (optional)
          <input
            v-model="idempotencyKey"
            type="text"
            class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-400/40"
          />
        </label>

        <p
          v-if="operation === 'revoke'"
          class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
        >
          Revoke is irreversible. The audit log records the actor; revoking below balance is refused.
        </p>

        <button
          type="submit"
          class="self-start rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          :class="
            operation === 'grant'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
              : 'bg-gradient-to-r from-rose-500 to-orange-500'
          "
          :disabled="!canSubmit"
        >
          {{ busy ? 'Working…' : operation === 'grant' ? 'Grant' : 'Revoke' }}
        </button>

        <div
          v-if="lastResult"
          class="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300"
        >
          <p>Coin delta: <span class="tabular-nums">{{ lastResult.coinDelta }}</span> → balance {{ lastResult.coinBalanceAfter }}</p>
          <p>XP delta: <span class="tabular-nums">{{ lastResult.xpDelta }}</span> → balance {{ lastResult.xpBalanceAfter }}</p>
          <p v-if="lastResult.replay" class="text-amber-200">Idempotent replay (no new ledger row).</p>
        </div>
      </form>

      <section class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
            User history
          </h2>
          <button
            type="button"
            class="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!targetUserId.trim() || historyLoading"
            @click="loadHistory({ reset: true })"
          >
            {{ historyLoading ? 'Loading…' : 'Load' }}
          </button>
        </div>
        <div
          v-if="historyError"
          class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
        >
          {{ historyError.code }} · {{ historyError.message }}
        </div>
        <div class="overflow-hidden rounded-xl border border-white/10 bg-[#0a0514]/70">
          <table class="w-full table-fixed text-xs">
            <thead class="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th class="px-3 py-1.5 text-left">When</th>
                <th class="w-14 px-2 py-1.5 text-left">Kind</th>
                <th class="w-24 px-2 py-1.5 text-right">Delta</th>
                <th class="px-3 py-1.5 text-left">Source</th>
                <th class="w-24 px-2 py-1.5 text-right">After</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr v-for="row in history" :key="`${row.kind}:${row.id}`">
                <td class="px-3 py-1.5 text-slate-400 tabular-nums">
                  {{ new Date(row.createdAt).toLocaleString() }}
                </td>
                <td class="px-2 py-1.5 uppercase text-slate-300">{{ row.kind }}</td>
                <td
                  class="px-2 py-1.5 text-right font-semibold tabular-nums"
                  :class="row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-rose-300' : 'text-slate-400'"
                >
                  {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
                </td>
                <td class="truncate px-3 py-1.5 text-slate-300">
                  {{ row.source }}<span v-if="row.sourceRef" class="text-slate-500"> · {{ row.sourceRef }}</span>
                </td>
                <td class="px-2 py-1.5 text-right text-slate-400 tabular-nums">{{ row.balanceAfter }}</td>
              </tr>
              <tr v-if="!historyLoading && history.length === 0">
                <td colspan="5" class="px-3 py-4 text-center text-slate-500">No history loaded.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="historyHasMore && history.length > 0" class="flex justify-center">
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="historyLoading"
            @click="loadHistory()"
          >
            {{ historyLoading ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </section>
    </section>

    <section class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Predictions</h2>
        <div class="flex items-center gap-2">
          <select
            v-model="predictionsFilter.status"
            class="rounded-full border border-white/10 bg-[#0a0514] px-3 py-1 text-xs text-slate-100"
          >
            <option value="">All statuses</option>
            <option value="open">open</option>
            <option value="locked">locked</option>
            <option value="resolved">resolved</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button
            type="button"
            class="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="predictionsLoading"
            @click="loadPredictions({ reset: true })"
          >
            {{ predictionsLoading ? 'Loading…' : 'Load' }}
          </button>
        </div>
      </div>
      <div
        v-if="predictionsError"
        class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
      >
        {{ predictionsError.code }} · {{ predictionsError.message }}
      </div>
      <div class="overflow-hidden rounded-xl border border-white/10 bg-[#0a0514]/70">
        <table class="w-full table-fixed text-xs">
          <thead class="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-slate-400">
            <tr>
              <th class="px-3 py-1.5 text-left">Created</th>
              <th class="px-3 py-1.5 text-left">Title</th>
              <th class="w-20 px-2 py-1.5 text-left">Status</th>
              <th class="w-24 px-2 py-1.5 text-right">Pool</th>
              <th class="w-24 px-2 py-1.5 text-right">Paid out</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-for="row in predictionsList" :key="row.id">
              <td class="px-3 py-1.5 text-slate-400 tabular-nums">
                {{ new Date(row.createdAt).toLocaleString() }}
              </td>
              <td class="truncate px-3 py-1.5 text-slate-100">{{ row.title }}</td>
              <td class="px-2 py-1.5 text-slate-300">{{ row.status }}</td>
              <td class="px-2 py-1.5 text-right text-slate-200 tabular-nums">{{ row.totalPool }}</td>
              <td class="px-2 py-1.5 text-right text-slate-200 tabular-nums">{{ row.totalPaidOut }}</td>
            </tr>
            <tr v-if="!predictionsLoading && predictionsList.length === 0">
              <td colspan="5" class="px-3 py-4 text-center text-slate-500">No predictions loaded.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="predictionsHasMore && predictionsList.length > 0" class="flex justify-center">
        <button
          type="button"
          class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="predictionsLoading"
          @click="loadPredictions()"
        >
          {{ predictionsLoading ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </section>
  </section>
</template>
