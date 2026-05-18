<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  getStreamerSettings,
  getStreamerSummary,
  patchStreamerSettings,
  type EconomyApiError,
  type StreamerEconomySettingsDto,
  type StreamerEconomySummaryDto,
} from '../api/economyApi'

const route = useRoute()
const streamerId = computed(() => String(route.params.streamerId ?? ''))

const settings = ref<StreamerEconomySettingsDto | null>(null)
const summary = ref<StreamerEconomySummaryDto | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref<EconomyApiError | null>(null)
const flashMessage = ref<string | null>(null)

const form = reactive({
  chatRewardsEnabled: true,
  predictionsEnabled: true,
  caseDropsEnabled: true,
  maxCoinsPerViewerPerStream: 500,
  maxPredictionStake: 10_000,
  maxActivePredictions: 3,
})

function applyError(err: unknown): void {
  error.value =
    err && typeof err === 'object' && 'status' in (err as Record<string, unknown>)
      ? (err as EconomyApiError)
      : { status: 0, code: 'NETWORK', message: (err as Error)?.message ?? 'Network error' }
}

function hydrate(s: StreamerEconomySettingsDto): void {
  form.chatRewardsEnabled = s.chatRewardsEnabled
  form.predictionsEnabled = s.predictionsEnabled
  form.caseDropsEnabled = s.caseDropsEnabled
  form.maxCoinsPerViewerPerStream = s.maxCoinsPerViewerPerStream
  form.maxPredictionStake = s.maxPredictionStake
  form.maxActivePredictions = s.maxActivePredictions
}

async function refresh(): Promise<void> {
  if (!streamerId.value) return
  loading.value = true
  error.value = null
  try {
    const [s, sum] = await Promise.all([
      getStreamerSettings(streamerId.value),
      getStreamerSummary(streamerId.value).catch(() => null),
    ])
    settings.value = s.settings
    hydrate(s.settings)
    summary.value = sum?.summary ?? null
  } catch (err) {
    applyError(err)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (!streamerId.value || saving.value) return
  saving.value = true
  error.value = null
  try {
    const r = await patchStreamerSettings(streamerId.value, { ...form })
    settings.value = r.settings
    hydrate(r.settings)
    flashMessage.value = 'Settings saved'
    setTimeout(() => (flashMessage.value = null), 3_000)
  } catch (err) {
    applyError(err)
  } finally {
    saving.value = false
  }
}

onMounted(refresh)
watch(streamerId, refresh)
</script>

<template>
  <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 text-slate-100">
    <header class="flex flex-col gap-2">
      <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">
        Viewer Economy · Streamer
      </p>
      <h1 class="text-2xl font-semibold tracking-tight text-white">Streamer settings</h1>
      <p class="text-xs text-slate-400">
        Streamer: <span class="font-mono">{{ streamerId }}</span>
      </p>
    </header>

    <div
      v-if="flashMessage"
      class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
    >
      {{ flashMessage }}
    </div>

    <div
      v-if="error"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      {{ error.code }} · {{ error.message }}
    </div>

    <section class="grid gap-4 lg:grid-cols-2">
      <form
        class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4"
        @submit.prevent="save"
      >
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Toggles</h2>
        <label class="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span>Chat rewards</span>
          <input v-model="form.chatRewardsEnabled" type="checkbox" class="h-5 w-9 accent-violet-400" />
        </label>
        <label class="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span>Predictions</span>
          <input v-model="form.predictionsEnabled" type="checkbox" class="h-5 w-9 accent-violet-400" />
        </label>
        <label class="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span>Case drops</span>
          <input v-model="form.caseDropsEnabled" type="checkbox" class="h-5 w-9 accent-violet-400" />
        </label>

        <h2 class="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Caps</h2>
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          Max coins per viewer per stream
          <input
            v-model.number="form.maxCoinsPerViewerPerStream"
            type="number"
            min="0"
            class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          Max prediction stake
          <input
            v-model.number="form.maxPredictionStake"
            type="number"
            min="1"
            class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-slate-400">
          Max active predictions
          <input
            v-model.number="form.maxActivePredictions"
            type="number"
            min="0"
            class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <button
          type="submit"
          class="self-start rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="saving || loading"
        >
          {{ saving ? 'Saving…' : 'Save settings' }}
        </button>
      </form>

      <section class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
          Last 30 days
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-400">Chat coins</p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-amber-200">
              {{ (summary?.chatRewardCoinsLast30d ?? 0).toLocaleString() }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-400">Participation coins</p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-amber-200">
              {{ (summary?.participationCoinsLast30d ?? 0).toLocaleString() }}
            </p>
          </div>
        </div>

        <h3 class="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
          Top earners
        </h3>
        <ul
          v-if="summary?.topEarners?.length"
          class="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]"
        >
          <li
            v-for="row in summary.topEarners"
            :key="row.userId"
            class="flex items-center justify-between px-3 py-1.5 text-xs"
          >
            <span class="truncate text-slate-200">{{ row.displayName }}</span>
            <span class="tabular-nums text-amber-200">+{{ row.coins.toLocaleString() }}</span>
          </li>
        </ul>
        <p v-else class="text-xs text-slate-500">No earners yet.</p>

        <h3 class="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
          Recent predictions
        </h3>
        <ul
          v-if="summary?.recentPredictions?.length"
          class="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]"
        >
          <li
            v-for="row in summary.recentPredictions"
            :key="row.id"
            class="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
          >
            <span class="min-w-0 truncate text-slate-200">{{ row.title }}</span>
            <span class="shrink-0 text-slate-500">{{ row.status }}</span>
            <span class="shrink-0 tabular-nums text-amber-200">{{ row.totalPool }}</span>
          </li>
        </ul>
        <p v-else class="text-xs text-slate-500">No predictions yet.</p>
      </section>
    </section>
  </main>
</template>
