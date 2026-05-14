<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CallToast } from '@/composables/game-room/useCallPresenceToasts'

/**
 * Block 28 — presentational shell for the presence / join-leave toast
 * stack. The wrapping `<div class="call-page__toasts">` +
 * `<TransitionGroup name="call-toast">` skeleton was byte-identical
 * between `CallPage.vue` and `GameTemplateCallPage.vue`; the toast data
 * is owned by `useCallPresenceToasts` (Block 25).
 *
 * CSS classes preserved verbatim against `CallPage.css`:
 *   - `.call-page__toasts`
 *   - `.call-page__toast-stack`
 *   - `.call-page__toast`
 *   - `.call-page__toast--join` / `.call-page__toast--leave`
 *
 * No emits. The page wraps this component with its own route-specific
 * `v-if` so the visibility gate stays page-owned.
 */

defineProps<{
  toasts: readonly CallToast[]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="call-page__toasts" role="region" :aria-label="t('callPage.toastStackAria')">
    <TransitionGroup name="call-toast" tag="div" class="call-page__toast-stack">
      <div
        v-for="x in toasts"
        :key="x.id"
        class="call-page__toast"
        :class="x.kind === 'leave' ? 'call-page__toast--leave' : 'call-page__toast--join'"
      >
        {{ x.text }}
      </div>
    </TransitionGroup>
  </div>
</template>
