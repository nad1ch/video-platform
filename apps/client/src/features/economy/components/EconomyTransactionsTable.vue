<script setup lang="ts">
import { computed } from 'vue'
import type { TransactionRow } from '../api/economyApi'

const props = defineProps<{
  rows: TransactionRow[]
  loading: boolean
  hasMore: boolean
  kind: 'all' | 'coin' | 'xp'
}>()

const emit = defineEmits<{
  (e: 'load-more'): void
  (e: 'kind-change', kind: 'all' | 'coin' | 'xp'): void
}>()

const tabs: Array<{ key: 'all' | 'coin' | 'xp'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'coin', label: 'Coins' },
  { key: 'xp', label: 'XP' },
]

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

function deltaColor(delta: number): string {
  if (delta > 0) return 'text-emerald-300'
  if (delta < 0) return 'text-rose-300'
  return 'text-slate-400'
}

function fmtDelta(delta: number): string {
  if (delta > 0) return `+${delta.toLocaleString()}`
  return delta.toLocaleString()
}

const empty = computed(() => !props.loading && props.rows.length === 0)
</script>

<template>
  <div>
    <div class="mb-3 flex items-center gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="rounded-full border px-3 py-1 text-xs font-medium transition"
        :class="
          kind === tab.key
            ? 'border-violet-400/40 bg-violet-400/10 text-violet-100'
            : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-200'
        "
        @click="emit('kind-change', tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0719]/70">
      <table class="w-full table-fixed text-sm">
        <thead class="bg-white/[0.03] text-[11px] uppercase tracking-[0.16em] text-slate-400">
          <tr>
            <th class="px-4 py-2 text-left font-medium">When</th>
            <th class="w-16 px-2 py-2 text-left font-medium">Kind</th>
            <th class="w-28 px-2 py-2 text-right font-medium">Delta</th>
            <th class="hidden px-4 py-2 text-left font-medium md:table-cell">Source</th>
            <th class="hidden w-28 px-2 py-2 text-right font-medium tabular-nums md:table-cell">After</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr v-for="row in rows" :key="`${row.kind}:${row.id}`">
            <td class="px-4 py-2 text-xs text-slate-400 tabular-nums">{{ fmtTime(row.createdAt) }}</td>
            <td class="px-2 py-2 text-xs uppercase text-slate-300">{{ row.kind }}</td>
            <td class="px-2 py-2 text-right text-sm font-semibold tabular-nums" :class="deltaColor(row.delta)">
              {{ fmtDelta(row.delta) }}
            </td>
            <td class="hidden truncate px-4 py-2 text-xs text-slate-300 md:table-cell">
              {{ row.source }}<span v-if="row.sourceRef" class="text-slate-500"> · {{ row.sourceRef }}</span>
            </td>
            <td class="hidden px-2 py-2 text-right text-xs text-slate-400 tabular-nums md:table-cell">
              {{ row.balanceAfter.toLocaleString() }}
            </td>
          </tr>
          <tr v-if="empty">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">No transactions yet.</td>
          </tr>
          <tr v-if="loading && rows.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">Loading…</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="hasMore" class="mt-3 flex justify-center">
      <button
        type="button"
        class="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="loading"
        @click="emit('load-more')"
      >
        {{ loading ? 'Loading…' : 'Load more' }}
      </button>
    </div>
  </div>
</template>
