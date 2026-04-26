<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import '@/styles/coinhub-design-system.css'

withDefaults(
  defineProps<{
    name: string
    statusLabel?: string
    /** e.g. viewer count */
    viewersLabel?: string
    live?: boolean
  }>(),
  { statusLabel: undefined, viewersLabel: undefined, live: false },
)

const { t } = useI18n()
</script>

<template>
  <div
    class="coinhub-streamer ch-ds-card ch-ds-card--interactive group relative flex items-center gap-3 overflow-hidden rounded-[20px] py-3 pl-3 pr-4"
  >
    <div
      class="coinhub-streamer__avatar h-10 w-10 shrink-0 rounded-full border border-violet-500/25 bg-gradient-to-b from-slate-600 to-slate-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_8px_rgba(0,0,0,0.45)] transition-shadow group-hover:border-violet-400/30"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <p class="truncate text-sm font-semibold text-[#FFFFFF]">
          {{ name }}
        </p>
        <span
          v-if="live"
          class="shrink-0 rounded border border-rose-500/50 bg-rose-950/80 px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide text-rose-200 shadow-[0_0_10px_-2px_rgba(244,63,94,0.45)]"
        >{{ t('coinHub.liveBadge') }}</span>
      </div>
      <p
        v-if="statusLabel"
        class="ch-ds-text-muted mt-0.5"
      >
        {{ statusLabel }}
      </p>
    </div>
    <p
      v-if="viewersLabel"
      class="shrink-0 text-sm font-bold tabular-nums text-[#9CA3AF]"
    >
      {{ viewersLabel }}
    </p>
  </div>
</template>

<style scoped>
.coinhub-streamer {
  transition: transform 0.16s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
}
</style>
