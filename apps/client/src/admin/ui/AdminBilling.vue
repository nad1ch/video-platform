<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  approveAdminPaymentRequest,
  cancelAdminSubscription,
  fetchAdminBillingList,
  fetchAdminSubscriptions,
  forceAdminMonoPoll,
  rejectAdminPaymentRequest,
  type AdminListDto,
  type AdminPaymentRequestRow,
  type AdminSubscriptionListDto,
  type AdminSubscriptionRow,
  type AdminTransactionRow,
} from '@/services/billingApi'
import { appConfirm } from '@/utils/appConfirm'

/**
 * Admin billing review queue.
 *
 * Lists every PaymentRequest in non-terminal state (waiting_payment, checking,
 * needs_review) plus recently observed unmatched transactions. Approving sets
 * the request to `approved` and activates Pro for the user; rejecting sets it
 * to `rejected`. Both endpoints are idempotent on the server.
 *
 * Per-row mutation is single-flight: while a row's approve/reject is in
 * flight, both buttons on that row are disabled. Refresh of the whole queue
 * happens after any mutation completes.
 *
 * Auto-refresh: the queue polls every `AUTO_REFRESH_MS` (≈6s) so freshly
 * marked-paid requests appear without a page reload. The poll is paused
 * while any approve/reject is in flight (avoids a race that could overwrite
 * the per-row "Pro активовано…" message), while the document is hidden
 * (battery / data), and while the manual "Оновити" call is in flight. List
 * is only replaced on a successful response — transient failures keep the
 * previous snapshot visible so the operator never stares at a blank page.
 */

const AUTO_REFRESH_MS = 6000

const data = ref<AdminListDto | null>(null)
const subscriptionsData = ref<AdminSubscriptionListDto | null>(null)

const loading = ref(false)
const lastError = ref<string | null>(null)
const lastFetchedAt = ref<string | null>(null)

const noteDraft = ref<Record<string, string>>({})

const pending = ref<Record<string, 'approve' | 'reject'>>({})
const rowMessage = ref<Record<string, string | null>>({})

const pendingSubCancel = ref<Record<string, true>>({})
const subRowMessage = ref<Record<string, string | null>>({})

const pollMonoPending = ref(false)
const pollMonoMessage = ref<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null)

const totalRequests = computed(() => data.value?.requests.length ?? 0)
const totalSubscriptions = computed(() => subscriptionsData.value?.subscriptions.length ?? 0)
const activeSubscriptions = computed(
  () => subscriptionsData.value?.subscriptions.filter((s) => s.isActive) ?? [],
)
const inactiveSubscriptions = computed(
  () => subscriptionsData.value?.subscriptions.filter((s) => !s.isActive) ?? [],
)
const hasPendingMutation = computed(
  () =>
    Object.keys(pending.value).length > 0 ||
    Object.keys(pendingSubCancel.value).length > 0 ||
    pollMonoPending.value,
)

let inflightLoad: Promise<void> | null = null
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let unmounted = false

/**
 * Single-flight parallel loader for both the payment-request queue and the
 * subscriptions list. Only the first concurrent caller actually fetches —
 * subsequent callers (manual + auto-refresh tick + post-mutation refresh)
 * piggy-back on the in-flight promise. Crucially, we DO NOT clear `data` /
 * `subscriptionsData` on load: a transient failure keeps the previous
 * snapshot visible (no flicker, no blank queue).
 */
async function load(): Promise<void> {
  if (inflightLoad) return inflightLoad
  loading.value = true
  inflightLoad = (async () => {
    try {
      const [reqRes, subRes] = await Promise.all([
        fetchAdminBillingList(),
        fetchAdminSubscriptions(),
      ])
      if (unmounted) return
      let nextError: string | null = null
      if (reqRes.ok) {
        data.value = reqRes.data
      } else {
        nextError = `${reqRes.code}: ${reqRes.message}`
      }
      if (subRes.ok) {
        subscriptionsData.value = subRes.data
      } else if (!nextError) {
        nextError = `${subRes.code}: ${subRes.message}`
      }
      if (reqRes.ok || subRes.ok) {
        lastFetchedAt.value = new Date().toISOString()
      }
      lastError.value = nextError
    } finally {
      loading.value = false
      inflightLoad = null
    }
  })()
  return inflightLoad
}

function shouldSkipAutoRefresh(): boolean {
  if (unmounted) return true
  if (inflightLoad) return true
  if (hasPendingMutation.value) return true
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true
  return false
}

async function autoRefreshTick(): Promise<void> {
  if (shouldSkipAutoRefresh()) return
  await load()
}

function startAutoRefresh(): void {
  if (autoRefreshTimer) return
  autoRefreshTimer = setInterval(() => {
    void autoRefreshTick()
  }, AUTO_REFRESH_MS)
}

function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

function onVisibilityChange(): void {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible') {
    
    void autoRefreshTick()
  }
}

async function approve(row: AdminPaymentRequestRow): Promise<void> {
  if (pending.value[row.id]) return
  pending.value = { ...pending.value, [row.id]: 'approve' }
  rowMessage.value = { ...rowMessage.value, [row.id]: null }
  try {
    const r = await approveAdminPaymentRequest(row.id, noteDraft.value[row.id] ?? null)
    if (!r.ok) {
      rowMessage.value = {
        ...rowMessage.value,
        [row.id]: `Помилка: ${r.code} — ${r.message}`,
      }
      return
    }
    rowMessage.value = {
      ...rowMessage.value,
      [row.id]: r.data.activated
        ? 'Pro активовано та запит відмічено як approved.'
        : `Без змін: статус — ${r.data.status}.`,
    }
    await load()
  } finally {
    const next = { ...pending.value }
    delete next[row.id]
    pending.value = next
  }
}

async function reject(row: AdminPaymentRequestRow): Promise<void> {
  if (pending.value[row.id]) return
  pending.value = { ...pending.value, [row.id]: 'reject' }
  rowMessage.value = { ...rowMessage.value, [row.id]: null }
  try {
    const r = await rejectAdminPaymentRequest(row.id, noteDraft.value[row.id] ?? null)
    if (!r.ok) {
      rowMessage.value = {
        ...rowMessage.value,
        [row.id]: `Помилка: ${r.code} — ${r.message}`,
      }
      return
    }
    rowMessage.value = {
      ...rowMessage.value,
      [row.id]: r.data.rejected
        ? 'Запит відхилено.'
        : `Без змін: статус — ${r.data.status}.`,
    }
    await load()
  } finally {
    const next = { ...pending.value }
    delete next[row.id]
    pending.value = next
  }
}

function isPending(row: AdminPaymentRequestRow): boolean {
  return Boolean(pending.value[row.id])
}

function isSubPending(row: AdminSubscriptionRow): boolean {
  return Boolean(pendingSubCancel.value[row.id])
}

/**
 * Admin: force-poll the monobank Personal API once, bypassing the in-process
 * 60s cool-down. Useful when a `checking` request is stuck because:
 *   - we just changed `MONO_ACCOUNT_ID` and want to verify it works;
 *   - the user just paid and wants to re-attempt without waiting.
 *
 * Surfaces a structured outcome:
 *   - "Отримано N транзакцій" — if any of them match a pending request, the
 *     queue auto-refresh (Promise.all) reflects it on the next tick.
 *   - "Mono API не налаштовано" — MONO_PERSONAL_TOKEN/ACCOUNT_ID missing.
 *   - "Mono обмежив запити" — server-side 429 (the in-process cool-down was
 *     bypassed but monobank still throttled us).
 *   - "Помилка mono: …" — network/auth/etc.
 */
async function onPollMonoNow(): Promise<void> {
  if (pollMonoPending.value) return
  pollMonoPending.value = true
  pollMonoMessage.value = null
  try {
    const r = await forceAdminMonoPoll()
    if (!r.ok) {
      pollMonoMessage.value = { kind: 'err', text: `${r.code}: ${r.message}` }
      return
    }
    if (r.data.ok) {
      pollMonoMessage.value = {
        kind: 'ok',
        text: `Отримано ${r.data.itemCount} транзакцій з рахунку ${r.data.accountId}.`,
      }
    } else if (r.data.reason === 'not_configured') {
      pollMonoMessage.value = {
        kind: 'warn',
        text: 'Mono API не налаштовано (MONO_PERSONAL_TOKEN або MONO_ACCOUNT_ID відсутні).',
      }
    } else if (r.data.reason === 'rate_limited') {
      pollMonoMessage.value = {
        kind: 'warn',
        text: 'Monobank обмежив запити (429). Зачекайте хвилину й повторіть.',
      }
    } else {
      pollMonoMessage.value = {
        kind: 'err',
        text: `Помилка mono: ${r.data.message ?? 'невідома'}.`,
      }
    }
    
    
    await load()
  } finally {
    pollMonoPending.value = false
  }
}

/**
 * Admin: deactivate an active Pro subscription. Idempotent on the server —
 * if the row is already inactive/expired, the response carries
 * `cancelledNow: false` and we surface that without re-confirming.
 *
 * The `appConfirm` step is the existing project pattern (see AdminUsers.vue).
 * Per-subscription `pendingSubCancel` map blocks double-submits at the FE
 * AND pauses the auto-refresh tick (via `hasPendingMutation`) so a refresh
 * cannot overwrite the row's "Підписку скасовано" message mid-flight.
 */
async function onCancelSubscription(row: AdminSubscriptionRow): Promise<void> {
  if (pendingSubCancel.value[row.id]) return
  const confirmed = appConfirm(
    `Скасувати Pro для ${row.userDisplayName || row.userEmail || row.userId}? ` +
      'Доступ буде відключено негайно. Платіжна історія залишається без змін.',
  )
  if (!confirmed) return

  pendingSubCancel.value = { ...pendingSubCancel.value, [row.id]: true }
  subRowMessage.value = { ...subRowMessage.value, [row.id]: null }
  try {
    const r = await cancelAdminSubscription(row.id)
    if (!r.ok) {
      subRowMessage.value = {
        ...subRowMessage.value,
        [row.id]: `Помилка: ${r.code} — ${r.message}`,
      }
      return
    }
    subRowMessage.value = {
      ...subRowMessage.value,
      [row.id]: r.data.cancelledNow
        ? 'Підписку скасовано. Доступ Pro відключено.'
        : `Без змін: статус — ${r.data.subscription.status}.`,
    }
    await load()
  } finally {
    const next = { ...pendingSubCancel.value }
    delete next[row.id]
    pendingSubCancel.value = next
  }
}

function fmtIso(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClasses(status: AdminPaymentRequestRow['status']): string {
  if (status === 'needs_review') {
    return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40'
  }
  if (status === 'checking') {
    return 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/40'
  }
  if (status === 'auto_matched' || status === 'approved') {
    return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40'
  }
  if (status === 'rejected' || status === 'expired') {
    return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40'
  }
  return 'bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/40'
}

function subBadgeClasses(row: AdminSubscriptionRow): string {
  if (row.isActive) {
    return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40'
  }
  if (row.status === 'inactive') {
    return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40'
  }
  
  return 'bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/40'
}

function transactionLine(t: AdminTransactionRow): string {
  return `${t.amountUah} ${t.currency} · ${fmtIso(t.operationTime)} · ${t.description ?? '—'}`
}

onMounted(() => {
  void load()
  startAutoRefresh()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
})

onBeforeUnmount(() => {
  unmounted = true
  stopAutoRefresh()
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
})
</script>

<template>
  <div class="w-full min-w-0 space-y-5">
    <header
      class="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 class="text-xl font-semibold tracking-tight text-white">Білінг (StreamAssist Pro)</h2>
        <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">
          Перегляд запитів на оплату, що очікують матчу або ручного підтвердження.
          Активація Pro або відмова відбувається лише з цієї панелі чи автоматично
          сервером — фронтенд не керує доступом самостійно.
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg bg-amber-900/80 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-700/50 hover:bg-amber-800/80 disabled:opacity-50"
          :disabled="pollMonoPending"
          :title="
            'Bypass the 60s mono rate-limit and run one fetch+match. Useful when a payment ' +
            'is stuck in checking (likely MONO_ACCOUNT_ID misconfigured or rate-limited).'
          "
          @click="onPollMonoNow"
        >
          {{ pollMonoPending ? 'Опитуємо mono…' : 'Перевірити mono зараз' }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-cyan-950/80 px-3 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-700/50 hover:bg-cyan-900/80 disabled:opacity-50"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? 'Оновлення…' : 'Оновити' }}
        </button>
      </div>
    </header>

    <p
      v-if="pollMonoMessage"
      class="text-xs"
      :class="
        pollMonoMessage.kind === 'ok'
          ? 'text-emerald-200'
          : pollMonoMessage.kind === 'warn'
            ? 'text-amber-200'
            : 'text-rose-300'
      "
    >
      {{ pollMonoMessage.text }}
    </p>

    <div
      class="rounded-xl border border-amber-700/40 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-100/90"
    >
      <strong class="text-amber-200">Увага:</strong>
      підтверджуйте платіж лише після ручної перевірки надходження в monobank
      Jar/Banka. Підтвердження активує Pro; зміни через цю панель є незворотні
      (без флоу повернення в MVP).
    </div>

    <div v-if="lastError" class="rounded-lg border border-rose-700/40 bg-rose-950/40 p-3 text-xs text-rose-200">
      {{ lastError }}
    </div>

    <p v-if="lastFetchedAt" class="text-[11px] text-slate-500">
      Останнє оновлення: {{ fmtIso(lastFetchedAt) }} · Запитів у черзі: {{ totalRequests }}
    </p>

    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Запити на ручний перегляд
      </h3>

      <div
        v-if="!data && !loading"
        class="rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400"
      >
        Немає даних. Спробуйте оновити.
      </div>

      <div
        v-else-if="data && data.requests.length === 0"
        class="rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400"
      >
        Немає запитів, що потребують уваги.
      </div>

      <article
        v-for="row in data?.requests ?? []"
        :key="row.id"
        class="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.03]"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-slate-500">Payment Request</p>
            <p class="break-all font-mono text-xs text-slate-100">{{ row.id }}</p>
            <p class="text-xs text-slate-400">User ID: <span class="font-mono text-slate-200">{{ row.userId }}</span></p>
            <p class="text-xs text-slate-400">
              Email: <span class="text-slate-200">{{ row.userEmail ?? '—' }}</span>
              · Name: <span class="text-slate-200">{{ row.userDisplayName || '—' }}</span>
            </p>
          </div>
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase"
            :class="statusBadgeClasses(row.status)"
          >
            {{ row.status }}
          </span>
        </div>

        <dl class="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Amount</dt>
            <dd class="text-slate-200">{{ row.amountUah }} {{ row.currency }}</dd>
          </div>
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Created</dt>
            <dd class="text-slate-200">{{ fmtIso(row.createdAt) }}</dd>
          </div>
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Marked paid</dt>
            <dd class="text-slate-200">{{ fmtIso(row.markedPaidAt) }}</dd>
          </div>
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Expires</dt>
            <dd class="text-slate-200">{{ fmtIso(row.expiresAt) }}</dd>
          </div>
          <div v-if="row.adminNote" class="sm:col-span-2 md:col-span-3">
            <dt class="uppercase tracking-wide text-slate-500">Admin note</dt>
            <dd class="text-slate-200">{{ row.adminNote }}</dd>
          </div>
        </dl>

        <section class="mt-4 rounded-lg border border-slate-800/70 bg-slate-950/40 p-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Matched transaction
          </p>
          <p v-if="row.matchedTransaction" class="mt-1 text-xs text-slate-200">
            <span class="font-mono">{{ row.matchedTransaction.monoTransactionId }}</span>
            · {{ row.matchedTransaction.amountUah }} {{ row.matchedTransaction.currency }}
            · {{ fmtIso(row.matchedTransaction.operationTime) }}
          </p>
          <p v-else class="mt-1 text-xs text-slate-500">—</p>

          <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Candidate transactions
          </p>
          <ul
            v-if="row.candidateTransactions.length > 0"
            class="mt-1 space-y-1 text-xs text-slate-300"
          >
            <li v-for="t in row.candidateTransactions" :key="t.id" class="font-mono">
              {{ transactionLine(t) }}
            </li>
          </ul>
          <p v-else class="mt-1 text-xs text-slate-500">—</p>
        </section>

        <label class="mt-4 block text-xs text-slate-300">
          <span class="text-slate-400">Admin note (optional, ≤ 500 chars)</span>
          <textarea
            v-model="noteDraft[row.id]"
            class="mt-1 block w-full rounded-md border border-slate-700/70 bg-slate-950/70 p-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
            rows="2"
            maxlength="500"
            placeholder="Коментар, що буде збережено разом із запитом."
            :disabled="isPending(row)"
          />
        </label>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg bg-emerald-700/80 px-3 py-2 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-500/50 hover:bg-emerald-600/80 disabled:opacity-50"
            :disabled="isPending(row)"
            @click="approve(row)"
          >
            {{ pending[row.id] === 'approve' ? 'Підтверджуємо…' : 'Підтвердити (Approve)' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-rose-800/80 px-3 py-2 text-xs font-semibold text-rose-50 ring-1 ring-rose-500/50 hover:bg-rose-700/80 disabled:opacity-50"
            :disabled="isPending(row)"
            @click="reject(row)"
          >
            {{ pending[row.id] === 'reject' ? 'Відхиляємо…' : 'Відхилити (Reject)' }}
          </button>
          <p
            v-if="rowMessage[row.id]"
            class="text-xs"
            :class="rowMessage[row.id]?.startsWith('Помилка') ? 'text-rose-300' : 'text-emerald-200'"
          >
            {{ rowMessage[row.id] }}
          </p>
        </div>
      </article>
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Активні підписки
        <span v-if="totalSubscriptions > 0" class="ml-2 text-[11px] text-slate-500">
          ({{ activeSubscriptions.length }} активних · {{ totalSubscriptions }} всього)
        </span>
      </h3>

      <p
        class="rounded-lg border border-amber-700/30 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/80"
      >
        Скасування деактивує доступ Pro негайно. Платіжна історія
        (PaymentRequest) залишається без змін, повернення коштів через цю
        панель не виконується.
      </p>

      <div
        v-if="!subscriptionsData && !loading"
        class="rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400"
      >
        Немає даних. Спробуйте оновити.
      </div>

      <div
        v-else-if="subscriptionsData && totalSubscriptions === 0"
        class="rounded-lg border border-slate-800/70 bg-slate-900/40 p-4 text-sm text-slate-400"
      >
        Немає підписок.
      </div>

      <article
        v-for="row in activeSubscriptions"
        :key="row.id"
        class="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.03]"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-slate-500">Subscription</p>
            <p class="break-all font-mono text-xs text-slate-100">{{ row.id }}</p>
            <p class="text-xs text-slate-400">
              User ID: <span class="font-mono text-slate-200">{{ row.userId }}</span>
            </p>
            <p class="text-xs text-slate-400">
              Email: <span class="text-slate-200">{{ row.userEmail ?? '—' }}</span>
              · Name: <span class="text-slate-200">{{ row.userDisplayName || '—' }}</span>
            </p>
          </div>
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase"
            :class="subBadgeClasses(row)"
          >
            {{ row.isActive ? 'active' : row.status }}
          </span>
        </div>

        <dl class="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Plan</dt>
            <dd class="text-slate-200">{{ row.plan }}</dd>
          </div>
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Active until</dt>
            <dd class="text-slate-200">{{ fmtIso(row.expiresAt) }}</dd>
          </div>
          <div>
            <dt class="uppercase tracking-wide text-slate-500">Started</dt>
            <dd class="text-slate-200">{{ fmtIso(row.startsAt) }}</dd>
          </div>
        </dl>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg bg-rose-800/80 px-3 py-2 text-xs font-semibold text-rose-50 ring-1 ring-rose-500/50 hover:bg-rose-700/80 disabled:opacity-50"
            :disabled="isSubPending(row)"
            @click="onCancelSubscription(row)"
          >
            {{ isSubPending(row) ? 'Скасовуємо…' : 'Скасувати Pro' }}
          </button>
          <p
            v-if="subRowMessage[row.id]"
            class="text-xs"
            :class="
              subRowMessage[row.id]?.startsWith('Помилка')
                ? 'text-rose-300'
                : 'text-emerald-200'
            "
          >
            {{ subRowMessage[row.id] }}
          </p>
        </div>
      </article>

      <details
        v-if="inactiveSubscriptions.length > 0"
        class="rounded-xl border border-slate-800/70 bg-slate-950/30"
      >
        <summary
          class="cursor-pointer px-3 py-2 text-xs uppercase tracking-wide text-slate-400"
        >
          Неактивні / прострочені ({{ inactiveSubscriptions.length }})
        </summary>
        <table class="w-full text-xs">
          <thead class="bg-slate-900/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-3 py-2">User</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Plan</th>
              <th class="px-3 py-2">Was active until</th>
              <th class="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr
              v-for="row in inactiveSubscriptions"
              :key="row.id"
              class="text-slate-200"
            >
              <td class="px-3 py-2">
                <span class="block">{{ row.userDisplayName || '—' }}</span>
                <span class="block text-[11px] text-slate-500">{{ row.userEmail ?? '—' }}</span>
              </td>
              <td class="px-3 py-2">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase"
                  :class="subBadgeClasses(row)"
                >
                  {{ row.status }}
                </span>
              </td>
              <td class="px-3 py-2">{{ row.plan }}</td>
              <td class="px-3 py-2">{{ fmtIso(row.expiresAt) }}</td>
              <td class="px-3 py-2">{{ fmtIso(row.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </section>

    <section v-if="data && data.unmatchedTransactions.length > 0" class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Останні незметчені транзакції
      </h3>
      <div class="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 ring-1 ring-white/[0.03]">
        <table class="w-full text-xs">
          <thead class="bg-slate-900/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-2">Mono Tx ID</th>
              <th class="px-3 py-2">Amount</th>
              <th class="px-3 py-2">Direction</th>
              <th class="px-3 py-2">Operation time</th>
              <th class="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            <tr v-for="t in data.unmatchedTransactions" :key="t.id" class="text-slate-200">
              <td class="px-3 py-2 font-mono break-all">{{ t.monoTransactionId }}</td>
              <td class="px-3 py-2 tabular-nums">{{ t.amountUah }} {{ t.currency }}</td>
              <td class="px-3 py-2">{{ t.direction }}</td>
              <td class="px-3 py-2">{{ fmtIso(t.operationTime) }}</td>
              <td class="px-3 py-2 text-slate-300">{{ t.description ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
