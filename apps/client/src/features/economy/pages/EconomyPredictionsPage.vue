<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePredictionsStore } from '../state/predictionsStore'
import { useEconomyStore } from '../state/economyStore'
import PredictionCard from '../components/PredictionCard.vue'
import PredictionCreateForm from '../components/PredictionCreateForm.vue'

/**
 * Predictions page — viewer + streamer host UI on the same surface.
 *
 * URL pattern: `/app/predictions/:streamerId` (path param). The "host mode"
 * UI (create / lock / resolve / cancel) is exposed when the query parameter
 * `?host=1` is present; the server still enforces ownership server-side via
 * `isStreamerOwner`, so toggling the query flag without ownership has no
 * effect besides showing a hint UI that 403s on submit.
 */

const route = useRoute()
const store = usePredictionsStore()
const economy = useEconomyStore()
const { predictions, listLoading, listError, actionInflight, actionError } = storeToRefs(store)

const streamerId = computed(() => String(route.params.streamerId ?? ''))
const hostMode = computed(() => String(route.query.host ?? '') === '1')

function refresh(): void {
  if (streamerId.value) void store.loadForStreamer(streamerId.value)
}

onMounted(refresh)
watch(() => streamerId.value, refresh)

const showSkeleton = computed(() => listLoading.value && predictions.value.length === 0)
const hasPredictions = computed(() => predictions.value.length > 0)
const createError = computed(() =>
  actionInflight.value === 'create' ? null : actionError.value?.message ?? null,
)
const lastJoinedBalance = ref<number | null>(null)
watch(
  () => store.lastJoinedEntry,
  (v) => {
    if (v) lastJoinedBalance.value = v.coinBalanceAfter
  },
)

async function onJoin(payload: { predictionId: string; optionId: string; stake: number }) {
  const ok = await store.join(payload.predictionId, payload.optionId, payload.stake)
  if (ok) void economy.loadWallet({ silent: true })
}

async function onLock(predictionId: string) {
  await store.lock(predictionId)
}

async function onResolve(payload: { predictionId: string; winningOptionId: string }) {
  await store.resolve(payload.predictionId, payload.winningOptionId)
}

async function onCancel(predictionId: string) {
  if (!confirm('Cancel and refund all entries? This is irreversible.')) return
  await store.cancel(predictionId)
}

async function onCreate(payload: {
  streamerId: string
  title: string
  options: string[]
  durationMs: number
  minStake: number
  maxStake: number
}) {
  await store.create(payload)
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 text-slate-100">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">
          Viewer Economy
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-white">
          Predictions
          <span class="ml-2 text-xs font-normal uppercase tracking-[0.16em] text-slate-400">
            / Прогнози
          </span>
        </h1>
        <p class="mt-1 text-xs text-slate-400">Streamer: <span class="font-mono">{{ streamerId }}</span></p>
      </div>
      <button
        type="button"
        class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
        @click="refresh"
      >
        Refresh
      </button>
    </header>

    <div
      v-if="listError"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      Could not load predictions ({{ listError.code }}). {{ listError.message }}
    </div>

    <div
      v-if="lastJoinedBalance !== null"
      class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
    >
      Stake accepted. Balance now {{ lastJoinedBalance.toLocaleString() }} coins.
    </div>

    <div
      v-if="actionError && actionInflight !== 'create'"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      {{ actionError.code }} · {{ actionError.message }}
    </div>

    <PredictionCreateForm
      v-if="hostMode && streamerId"
      :streamer-id="streamerId"
      :busy="actionInflight === 'create'"
      :error-message="createError"
      @submit="onCreate"
    />

    <div v-if="showSkeleton" class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="i in 2"
        :key="i"
        class="h-48 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
      />
    </div>

    <p
      v-else-if="!hasPredictions && !listError"
      class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400"
    >
      No predictions right now.
    </p>

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <PredictionCard
        v-for="p in predictions"
        :key="p.id"
        :prediction="p"
        :host-mode="hostMode"
        :busy="!!actionInflight && actionInflight.endsWith(p.id)"
        @join="onJoin"
        @lock="onLock"
        @resolve="onResolve"
        @cancel="onCancel"
      />
    </div>
  </main>
</template>
