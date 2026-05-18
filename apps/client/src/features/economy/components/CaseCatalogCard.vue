<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogCase } from '../api/economyApi'

const props = defineProps<{
  entry: CatalogCase
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'open', slug: string): void
}>()

const tierStyles: Record<string, { ring: string; chip: string; label: string }> = {
  common: { ring: 'ring-slate-400/20', chip: 'bg-slate-700/40 text-slate-200', label: 'Common' },
  rare: { ring: 'ring-sky-400/30', chip: 'bg-sky-500/15 text-sky-200', label: 'Rare' },
  epic: { ring: 'ring-violet-400/40', chip: 'bg-violet-500/15 text-violet-200', label: 'Epic' },
  legendary: { ring: 'ring-amber-400/50', chip: 'bg-amber-500/15 text-amber-200', label: 'Legendary' },
}

const tier = computed(() => tierStyles[props.entry.rarityTier] ?? tierStyles.common!)

const visibleRewards = computed(() =>
  [...props.entry.rewards].sort((a, b) => b.weight - a.weight).slice(0, 6),
)
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#13091e] to-[#0b0617] p-4 ring-1"
    :class="tier.ring"
  >
    <header class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {{ entry.slug }}
        </p>
        <h3 class="mt-0.5 text-base font-semibold text-white">{{ entry.displayName }}</h3>
      </div>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
        :class="tier.chip"
      >
        {{ tier.label }}
      </span>
    </header>

    <div class="text-xs text-slate-400">
      Guaranteed minimum:
      <span class="font-semibold text-amber-200">{{ entry.guaranteedMinCoins }} coins</span>
      <span v-if="entry.pityFloorCount > 0">
        · Pity at <span class="font-semibold text-violet-200">{{ entry.pityFloorCount }}</span> opens
      </span>
    </div>

    <ul class="flex flex-col gap-1 rounded-xl border border-white/5 bg-[#0a0514]/70 p-3">
      <li v-for="r in visibleRewards" :key="r.id" class="flex items-center justify-between text-xs">
        <span class="text-slate-200">
          <span class="font-semibold uppercase tracking-[0.14em] text-slate-400">{{ r.kind }}</span>
          <span v-if="r.kind === 'coins' || r.kind === 'xp'" class="ml-1 text-slate-100"
            >+{{ r.value }}</span
          >
          <span v-else-if="r.referenceId" class="ml-1 text-slate-100">{{ r.referenceId }}</span>
        </span>
        <span class="tabular-nums text-slate-400">
          ≈ {{ (r.oddsApprox * 100).toFixed(1) }}%
        </span>
      </li>
    </ul>

    <button
      type="button"
      class="self-start rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(124,77,219,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="busy"
      @click="emit('open', entry.slug)"
    >
      {{ busy ? 'Opening…' : 'Open' }}
    </button>
  </article>
</template>
