<script setup lang="ts">
import { computed } from 'vue'
import type { WalletSnapshotDto } from '../api/economyApi'

const props = defineProps<{ wallet: WalletSnapshotDto | null; loading: boolean }>()

const coinBalance = computed(() => props.wallet?.coinBalance ?? 0)
const xpBalance = computed(() => props.wallet?.xpBalance ?? 0)
const level = computed(() => props.wallet?.level ?? 0)
const progress = computed(() => {
  const p = props.wallet?.progressToNextLevel ?? 0
  return Math.round(Math.max(0, Math.min(1, p)) * 100)
})
const pendingCoins = computed(() => props.wallet?.pendingCoins ?? 0)
const pendingXp = computed(() => props.wallet?.pendingXp ?? 0)
const currentLevelXp = computed(() => props.wallet?.currentLevelXp ?? 0)
const nextLevelXp = computed(() => props.wallet?.nextLevelXp ?? 0)
const boost = computed(() => props.wallet?.boosts ?? null)
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div
      class="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">Coins</p>
      <p class="mt-1 text-3xl font-semibold text-amber-100 tabular-nums">
        {{ loading && !wallet ? '—' : coinBalance.toLocaleString() }}
      </p>
      <p v-if="pendingCoins > 0" class="mt-1 text-xs text-amber-200/80">
        +{{ pendingCoins.toLocaleString() }} pending
      </p>
    </div>

    <div
      class="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/70">XP</p>
      <p class="mt-1 text-3xl font-semibold text-violet-100 tabular-nums">
        {{ loading && !wallet ? '—' : xpBalance.toLocaleString() }}
      </p>
      <p v-if="pendingXp > 0" class="mt-1 text-xs text-violet-200/80">
        +{{ pendingXp.toLocaleString() }} pending
      </p>
    </div>

    <div
      class="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:col-span-2"
    >
      <div class="flex items-baseline justify-between">
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
          Level
        </p>
        <p class="text-xs text-emerald-200/70 tabular-nums">
          {{ xpBalance.toLocaleString() }} / {{ nextLevelXp.toLocaleString() }} XP
        </p>
      </div>
      <p class="mt-1 text-3xl font-semibold text-emerald-100 tabular-nums">
        {{ loading && !wallet ? '—' : level }}
      </p>
      <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-950/60">
        <div
          class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-500"
          :style="{ width: `${progress}%` }"
        />
      </div>
      <p
        v-if="boost?.plan"
        class="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70"
      >
        Boost: {{ boost.plan }} · ×{{ boost.coinsMultiplier.toFixed(2) }} coins / ×{{
          boost.xpMultiplier.toFixed(2)
        }} XP
      </p>
      <p v-if="!boost?.plan" class="mt-2 text-[10px] uppercase tracking-[0.18em] text-emerald-200/40">
        No active boost
      </p>
      <p class="mt-1 text-[10px] uppercase tracking-[0.16em] text-emerald-200/40">
        Level start: {{ currentLevelXp.toLocaleString() }} XP
      </p>
    </div>
  </div>
</template>
