<script setup lang="ts">
import { computed, useSlots } from 'vue'

/**
 * Single app header (eat-first chrome from theme.css). Use `title` when no #brand slot.
 * Optional `#center`: stream shell — nav left, title centered, actions right (no logo in brand row).
 */
withDefaults(
  defineProps<{
    /** Shown in the brand area when the #brand slot is empty. */
    title?: string
    /** Extra classes on `<header>` (e.g. host / vote modifiers). */
    headerClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  }>(),
  { title: '' },
)

const slots = useSlots()
const hasCenterSlot = computed(() => Boolean(slots.center))
</script>

<template>
  <header class="app-shell-header" :class="headerClass">
    <div
      class="app-shell-header__top"
      :class="{ 'app-shell-header__top--has-center': hasCenterSlot }"
    >
      <div class="app-shell-header__start">
        <slot name="start" />
        <span v-if="!hasCenterSlot" class="app-shell-brand">
          <slot name="brand">{{ title }}</slot>
        </span>
      </div>
      <div v-if="hasCenterSlot" class="app-shell-header__center">
        <slot name="center" />
      </div>
      <slot name="end" />
    </div>
    <slot name="below" />
  </header>
</template>
