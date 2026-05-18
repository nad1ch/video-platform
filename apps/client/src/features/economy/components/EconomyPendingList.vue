<script setup lang="ts">
import { computed } from 'vue'
import type { PendingRewardDto } from '../api/economyApi'

const props = defineProps<{
  pending: PendingRewardDto[]
  busyById: string | null
}>()

const emit = defineEmits<{
  (e: 'claim', pendingRewardId: string): void
}>()

const KIND_LABELS: Record<string, string> = {
  daily: 'Daily',
  chat_activity: 'Chat',
  watch_time: 'Watch time',
  game_participation: 'Game',
  streak: 'Streak',
  event: 'Event',
  prediction_payout: 'Prediction',
  subscription_chest: 'Sub chest',
  streamer_loyalty: 'Loyalty',
  legacy: 'Legacy',
}

function labelFor(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

function formatExpiresIn(iso: string): string {
  const ms = Date.parse(iso) - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return 'expired'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

const sorted = computed(() => [...props.pending].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
</script>

<template>
  <ul v-if="sorted.length > 0" class="divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#0c0719]/70">
    <li
      v-for="row in sorted"
      :key="row.id"
      class="flex items-center justify-between gap-3 px-4 py-3"
    >
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-slate-100">{{ labelFor(row.kind) }}</p>
        <p class="mt-0.5 text-[11px] text-slate-400 tabular-nums">
          <span v-if="row.coinAmount > 0">+{{ row.coinAmount.toLocaleString() }} coins</span>
          <span v-if="row.coinAmount > 0 && row.xpAmount > 0"> · </span>
          <span v-if="row.xpAmount > 0">+{{ row.xpAmount.toLocaleString() }} XP</span>
          <span class="ml-2 text-slate-500">expires in {{ formatExpiresIn(row.expiresAt) }}</span>
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busyById === row.id"
        @click="emit('claim', row.id)"
      >
        {{ busyById === row.id ? '…' : 'Claim' }}
      </button>
    </li>
  </ul>
  <p v-else class="rounded-2xl border border-white/5 bg-[#0c0719]/40 px-4 py-6 text-center text-sm text-slate-400">
    No pending rewards. Earn some by chatting, playing, or claiming daily.
  </p>
</template>
