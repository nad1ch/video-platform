<script setup lang="ts">
import { computed } from 'vue'
import type { OpenCaseResult } from '../api/economyApi'

const props = defineProps<{ result: OpenCaseResult | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const kindLabel: Record<string, string> = {
  coins: 'Coins',
  xp: 'XP',
  badge: 'Badge',
  cosmetic: 'Cosmetic',
  fragment: 'Fragment',
}

const subtitle = computed(() => {
  if (!props.result) return ''
  const r = props.result.reward
  if (r.kind === 'coins') return `+${r.value} coins`
  if (r.kind === 'xp') return `+${r.value} XP`
  if (r.referenceId) return `${kindLabel[r.kind] ?? r.kind} · ${r.referenceId}`
  return kindLabel[r.kind] ?? r.kind
})
</script>

<template>
  <Transition name="case-result">
    <div
      v-if="result"
      class="fixed inset-0 z-[13000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div
        class="mx-4 w-full max-w-md rounded-3xl border border-violet-300/30 bg-gradient-to-br from-[#1b0f33] via-[#150a26] to-[#0c0617] p-6 text-center shadow-[0_28px_80px_rgba(15,5,40,0.55)]"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
          Case opened
        </p>
        <h3 class="mt-2 text-2xl font-semibold text-white">{{ result.caseSlug }}</h3>
        <p class="mt-3 text-3xl font-bold text-amber-200 tabular-nums">{{ subtitle }}</p>
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-400">Inventory left</p>
            <p class="mt-0.5 text-lg font-semibold tabular-nums text-white">
              {{ result.inventoryRemaining }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-400">Pity</p>
            <p class="mt-0.5 text-lg font-semibold tabular-nums text-white">
              {{ result.pityCountAfter }}
            </p>
          </div>
        </div>
        <p v-if="result.pityTriggered" class="mt-3 text-xs text-amber-200">
          Pity reward triggered.
        </p>
        <button
          type="button"
          class="mt-5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.case-result-enter-active,
.case-result-leave-active {
  transition: opacity 0.18s ease;
}
.case-result-enter-from,
.case-result-leave-to {
  opacity: 0;
}
</style>
