<script setup lang="ts">
import '@/styles/coinhub-design-system.css'

withDefaults(
  defineProps<{
    label: string
    variant?: 'money' | 'speed' | 'luck'
  }>(),
  { variant: 'money' },
)
</script>

<template>
  <div
    :class="[
      'coinhub-boost-surface ch-ds-card ch-ds-card--interactive group relative flex min-h-[3.75rem] items-center gap-3 overflow-hidden rounded-[20px] px-4 py-3.5',
      `coinhub-boost-surface--${variant}`,
    ]"
  >
    <div
      class="coinhub-boost-ico flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-[border-color,box-shadow] group-hover:shadow-[0_0_12px_-2px_rgba(0,0,0,0.5)]"
      aria-hidden="true"
    >
      <span v-if="variant === 'money'">🪙</span>
      <span v-else-if="variant === 'speed'">⚡</span>
      <span v-else>🍀</span>
    </div>
    <div class="min-w-0 flex-1">
      <p
        class="text-sm font-semibold leading-snug text-[#FFFFFF] transition-colors"
      >
        {{ label }}
      </p>
      <p class="ch-ds-text-muted mt-0.5 text-sm font-medium uppercase tracking-wider">
        —
      </p>
    </div>
  </div>
</template>

<style scoped>
.coinhub-boost-surface {
  transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
}
.coinhub-boost-surface--money .coinhub-boost-ico {
  border-color: rgba(251, 191, 36, 0.25);
  background: linear-gradient(180deg, rgba(40, 32, 12, 0.9) 0%, rgba(8, 6, 4, 0.95) 100%);
  color: rgb(253 224 150);
}
.coinhub-boost-surface--speed .coinhub-boost-ico {
  border-color: rgba(34, 211, 238, 0.25);
  background: linear-gradient(180deg, rgba(8, 40, 50, 0.9) 0%, rgba(4, 12, 20, 0.95) 100%);
  color: rgb(165 243 252);
}
.coinhub-boost-surface--luck .coinhub-boost-ico {
  border-color: rgba(74, 222, 128, 0.25);
  background: linear-gradient(180deg, rgba(12, 40, 24, 0.9) 0%, rgba(4, 14, 8, 0.95) 100%);
  color: rgb(187 247 208);
}
</style>
