<script setup lang="ts">
/**
 * Block 27 — slot-only layout shell for the bottom cluster of the call
 * pages. The wrapping `<div class="call-page__bottom-cluster">` skeleton
 * was byte-identical between `CallPage.vue` and
 * `GameTemplateCallPage.vue`; only the children differed by route
 * (Mafia / EatFirst host-actions, the `<CallControlsDock>` mount, and
 * Mafia / EatFirst / GameRoom speaking-queue bars).
 *
 * Scope:
 *   - the three nested divs (`__left`, `__center`, modifiers preserved
 *     verbatim against `CallPage.css`)
 *   - three named slots — `host-actions`, `dock`, `speaking-queue` —
 *     to accept the route-specific mounts
 *
 * Not in scope:
 *   - the outer `v-if` (route-specific view-mode guard) — pages wrap
 *     this component with their own `v-if` (Mafia: `!mafiaViewUi && !eatFirstViewUi`;
 *     Game Template: `!gameRoomViewUi`)
 *   - any prop passthrough for `<CallControlsDock>` (the dock mount
 *     stays in the page's `#dock` slot with its v-models and refs intact)
 *
 * No props, no emits, no logic. Pure presentational composition.
 */
</script>

<template>
  <div class="call-page__bottom-cluster">
    <div
      class="call-page__bottom-cluster__left call-page__bottom-cluster__left--empty"
      aria-hidden="true"
    />
    <div
      class="call-page__bottom-cluster__center call-page__bottom-cluster__center--speak-dock"
    >
      <slot name="host-actions" />
      <slot name="dock" />
      <slot name="speaking-queue" />
    </div>
  </div>
</template>
