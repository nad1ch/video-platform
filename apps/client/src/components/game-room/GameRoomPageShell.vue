<script setup lang="ts">
/**
 * Shared page shell for call-based game routes. Owns ONLY the common
 * page layout, the optional signaling-session warning banner, and the
 * hover-elevation `:deep()` override that both `/app/mafia` and
 * `/app/game-template` previously duplicated byte-identically.
 *
 * Intentionally has zero store, zero composable, zero protocol, zero
 * call-core, and zero i18n coupling. Pages own their own
 * store/composable/protocol wiring and pass:
 *   - `routeClass` (`'mafia-page'` / `'game-template-page'`) — applied
 *     to the root for downstream stability; modifier classes
 *     `${routeClass}--view-mode` and `${routeClass}--stream-view`
 *     toggle on `isViewMode`. Vue's Boolean prop auto-coercion is
 *     harmless here because every consumer binds `isViewMode` to a
 *     real value.
 *   - `signalingWarningVisible` + `signalingWarningText` — pages
 *     compute visibility from their own host/auth/inCall predicates
 *     and pass the already-translated text.
 *
 * Slots:
 *   - `stage`      — the call-stage component (`<CallPage>` for Mafia,
 *                    `<GameTemplateCallPage>` for Game Template).
 *   - `adapters`   — mount-time adapters (speaking-hint toast, etc).
 *   - `host-panel` — optional; Mafia mounts `<MafiaHostPanel>` here.
 *                    Game Template leaves this slot empty (no host
 *                    panel in the generic protocol).
 *   - `overlays`   — timer + other overlays.
 *
 * Slot order matches the existing template byte-for-byte so DOM order
 * (which CSS-selector specificity / hover rules implicitly depend on)
 * is preserved.
 */
defineProps<{
  routeClass: string
  isViewMode: boolean
  signalingWarningVisible: boolean
  signalingWarningText: string
}>()
</script>

<template>
  <div
    class="game-room-page-shell"
    :class="[
      routeClass,
      {
        [`${routeClass}--view-mode`]: isViewMode,
        [`${routeClass}--stream-view`]: isViewMode,
      },
    ]"
  >
    <div
      v-if="signalingWarningVisible"
      class="game-room-page-shell__signaling-warning"
      role="alert"
    >
      {{ signalingWarningText }}
    </div>
    <slot name="stage" />
    <slot name="adapters" />
    <slot name="host-panel" />
    <slot name="overlays" />
  </div>
</template>

<style scoped>
.game-room-page-shell {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-height: 100%;
  overflow: hidden;
}

.game-room-page-shell__signaling-warning {
  flex: 0 0 auto;
  margin: 0 12px 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(180, 60, 60, 0.2);
  border: 1px solid rgba(255, 120, 120, 0.45);
  color: #fbeaea;
  font-size: 0.9rem;
  line-height: 1.35;
}

@media (hover: hover) {
  .game-room-page-shell :deep(.call-page__tile-wrap:hover:not(.call-page__tile-wrap--pinned)) {
    z-index: 50;
  }
}
</style>
