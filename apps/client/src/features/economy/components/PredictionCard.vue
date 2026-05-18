<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PredictionDto } from '../api/economyApi'

const props = defineProps<{
  prediction: PredictionDto
  hostMode: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'join', payload: { predictionId: string; optionId: string; stake: number }): void
  (e: 'lock', predictionId: string): void
  (e: 'resolve', payload: { predictionId: string; winningOptionId: string }): void
  (e: 'cancel', predictionId: string): void
}>()

const selectedOptionId = ref<string | null>(null)
const stakeInput = ref<number>(props.prediction.minStake)
const resolveOptionId = ref<string | null>(null)

const isOpen = computed(() => props.prediction.status === 'open')
const isLocked = computed(() => props.prediction.status === 'locked')
const isResolved = computed(() => props.prediction.status === 'resolved')
const isCancelled = computed(() => props.prediction.status === 'cancelled')

const statusChip = computed(() => {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-emerald-500/15 text-emerald-200' },
    locked: { label: 'Locked', cls: 'bg-amber-500/15 text-amber-200' },
    resolved: { label: 'Resolved', cls: 'bg-violet-500/15 text-violet-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-500/15 text-slate-300' },
  }
  return map[props.prediction.status] ?? map.open!
})

const totalPool = computed(() => props.prediction.totalPool)
const winningOptionLabel = computed(() => {
  if (!props.prediction.winningOptionId) return null
  return props.prediction.options.find((o) => o.id === props.prediction.winningOptionId)?.label ?? null
})

function onJoin(): void {
  if (!selectedOptionId.value) return
  emit('join', {
    predictionId: props.prediction.id,
    optionId: selectedOptionId.value,
    stake: stakeInput.value,
  })
}

function onResolve(): void {
  if (!resolveOptionId.value) return
  emit('resolve', {
    predictionId: props.prediction.id,
    winningOptionId: resolveOptionId.value,
  })
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return 'lock passed'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#13091e] to-[#0b0617] p-4"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-base font-semibold text-white">{{ prediction.title }}</h3>
        <p class="mt-0.5 text-[11px] text-slate-400 tabular-nums">
          Pool {{ totalPool.toLocaleString() }} ·
          stake {{ prediction.minStake }}–{{ prediction.maxStake }} ·
          lock in {{ fmtTime(prediction.lockAt) }}
        </p>
      </div>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
        :class="statusChip.cls"
      >
        {{ statusChip.label }}
      </span>
    </header>

    <div class="flex flex-col gap-2">
      <label
        v-for="opt in prediction.options"
        :key="opt.id"
        class="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/5 bg-[#0a0514]/70 px-3 py-2 text-sm transition hover:border-violet-300/30"
        :class="{
          'border-emerald-300/40 bg-emerald-500/5': winningOptionLabel === opt.label,
        }"
      >
        <span class="flex items-center gap-2">
          <input
            v-if="isOpen && !hostMode"
            v-model="selectedOptionId"
            type="radio"
            :name="`pred-${prediction.id}`"
            :value="opt.id"
            class="h-4 w-4 accent-violet-400"
          />
          <span class="text-slate-100">{{ opt.label }}</span>
        </span>
        <span class="text-[11px] text-slate-400 tabular-nums">
          {{ opt.totalStakes.toLocaleString() }} staked
        </span>
      </label>
    </div>

    <!-- viewer join -->
    <div v-if="!hostMode && isOpen" class="flex items-center gap-2">
      <input
        v-model.number="stakeInput"
        type="number"
        :min="prediction.minStake"
        :max="prediction.maxStake"
        class="w-24 rounded-xl border border-white/10 bg-[#0a0514] px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-400/40"
      />
      <button
        type="button"
        class="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-sm font-semibold text-amber-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="busy || !selectedOptionId || stakeInput < prediction.minStake || stakeInput > prediction.maxStake"
        @click="onJoin"
      >
        {{ busy ? 'Joining…' : 'Stake coins' }}
      </button>
    </div>

    <!-- host actions -->
    <div v-if="hostMode" class="flex flex-col gap-2 border-t border-white/5 pt-3">
      <div v-if="isOpen" class="flex gap-2">
        <button
          type="button"
          class="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="busy"
          @click="emit('lock', prediction.id)"
        >
          Lock
        </button>
        <button
          type="button"
          class="rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="busy"
          @click="emit('cancel', prediction.id)"
        >
          Cancel + refund
        </button>
      </div>
      <div v-if="isOpen || isLocked" class="flex items-center gap-2">
        <select
          v-model="resolveOptionId"
          class="rounded-xl border border-white/10 bg-[#0a0514] px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-400/40"
        >
          <option :value="null" disabled>Winning option…</option>
          <option v-for="opt in prediction.options" :key="opt.id" :value="opt.id">
            {{ opt.label }}
          </option>
        </select>
        <button
          type="button"
          class="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="busy || !resolveOptionId"
          @click="onResolve"
        >
          Resolve
        </button>
      </div>
      <p v-if="isResolved" class="text-xs text-violet-200">
        Resolved — paid out
        <span class="font-semibold tabular-nums">{{ prediction.totalPaidOut.toLocaleString() }}</span>
        across {{ winningOptionLabel ? `“${winningOptionLabel}”` : 'winners' }}.
      </p>
      <p v-if="isCancelled" class="text-xs text-slate-300">Cancelled — entries refunded.</p>
    </div>
  </article>
</template>
