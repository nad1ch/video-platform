<script setup lang="ts">
/**
 * Single app header (eat-first chrome from theme.css). Use `title` when no #brand slot.
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
</script>

<template>
  <header class="app-shell-header" :class="headerClass">
    <div class="app-shell-header__top">
      <div class="app-shell-header__start">
        <slot name="start" />
        <span class="app-shell-brand">
          <slot name="brand">{{ title }}</slot>
        </span>
      </div>
      <slot name="end" />
    </div>
    <slot name="below" />
  </header>
</template>
