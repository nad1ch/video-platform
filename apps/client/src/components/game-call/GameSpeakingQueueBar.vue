<script setup lang="ts">
/**
 * GameSpeakingQueueBar — shared speaking-queue HUD for game-call pages.
 *
 * Extracted from `MafiaSpeakingQueueBar.vue` in Phase 5b so production Mafia
 * and the Game Template render the same HUD. The component is presentational:
 *
 *   - state arrives via props (`segments`, `speakingActive`, `showTools`)
 *   - actions leave via emits (`toggle-speaking-mode`, `remove-pair`, `clear-all`)
 *   - all locale strings arrive via the `labels` prop
 *
 * Hard isolation: NO Mafia store / composable / signaling / i18n key imports.
 * Asset paths live under the neutral `@/assets/game-call/` folder; the
 * SVG bytes are namespace-neutral and shared with Mafia / Game Template /
 * Eat First via the same component.
 *
 * CSS class names preserved as `.mafia-vote-hud*`. **This is intentional**:
 * `apps/client/src/components/call/CallPage.css` carries cross-component
 * `:deep()` rules that target these names from the stream-view + mobile
 * layout contexts (e.g. `.call-page__mafia-view-bottom :deep(.mafia-vote-hud)`).
 * Renaming the namespace would require touching `CallPage.css`, which the
 * Phase 5b constraints rule out. The component is still architecturally
 * generic — only the CSS *selector* carries the legacy "vote" name.
 */

import { computed } from 'vue'
import type { SpeakingNominationSegment } from '@/utils/speakingNominationQueue'
import mafiaVoteClear from '@/assets/game-call/vote-clear.svg'
import mafiaVoteStart from '@/assets/game-call/vote-start.svg'

export interface GameSpeakingQueueLabels {
  /** ARIA-label for the outer `<div role="region">`. */
  containerAria: string
  /** ARIA-label for the tools `<div role="toolbar">`. */
  toolbarAria: string
  /** Title on the speaking-mode toggle button. */
  speakingModeTitle: string
  /** ARIA-label on the speaking-mode toggle button. */
  speakingModeAria: string
  /** Title + ARIA on the clear-all button. */
  clearAllTitle: string
  /**
   * Title + ARIA on a queue chip when it's interactive (host view).
   * Receives the `by` and `target` seat strings.
   */
  chipRemoveTitle: (by: string, target: string) => string
  /**
   * Title + ARIA on a queue chip when it's read-only (non-host view).
   * Receives the `by` and `target` seat strings.
   */
  chipViewOnlyTitle: (by: string, target: string) => string
}

const props = withDefaults(
  defineProps<{
    /** Pair-decoded segments (use `decodeSpeakingNominationFlat` on the queue). */
    segments: readonly SpeakingNominationSegment[]
    /** True when host has speaking-mode currently selected. */
    speakingActive?: boolean
    /** When true, host controls (mode button, chip remove, clear-all) render. */
    showTools?: boolean
    /** Required i18n strings (component is locale-free). */
    labels: GameSpeakingQueueLabels
  }>(),
  {
    speakingActive: false,
    showTools: false,
  },
)

const emit = defineEmits<{
  /**
   * Emitted on speaking-mode button click. The adapter chooses the "off"
   * target (Mafia: 'night', Game Template: 'idle') based on `speakingActive`.
   */
  'toggle-speaking-mode': []
  'remove-pair': [pairIndex: number]
  'clear-all': []
}>()

/** Mafia uses `mafiaGameSeatText(seat) = String(seat)` — inlined here. */
function seatText(seat: number): string {
  return String(seat)
}

const decoratedSegments = computed(() =>
  props.segments.map((seg) => ({
    id: `pair-${seg.pairIndex}`,
    pairIndex: seg.pairIndex,
    byLabel: seg.bySeat == null ? '?' : seatText(seg.bySeat),
    targetLabel: seatText(seg.targetSeat),
  })),
)

const readOnly = computed(() => !props.showTools)

const hudWidth = computed(() => {
  const n = decoratedSegments.value.length
  if (readOnly.value) {
    return n === 0 ? 0 : Math.min(451, 14 + n * 22 + Math.max(0, n - 1) * 6)
  }
  if (n === 0) {
    return 104
  }
  return Math.min(451, 104 + 8 + n * 22 + Math.max(0, n - 1) * 6)
})

const canClearSpeakingQueue = computed(() => {
  if (readOnly.value) return false
  return props.segments.length > 0
})

function chipTitle(byLabel: string, targetLabel: string): string {
  return readOnly.value
    ? props.labels.chipViewOnlyTitle(byLabel, targetLabel)
    : props.labels.chipRemoveTitle(byLabel, targetLabel)
}

function onSpeakingModeClick(ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) return
  emit('toggle-speaking-mode')
}

function onRemove(pairIndex: number, ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) return
  emit('remove-pair', pairIndex)
}

function onClearAll(ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value || !canClearSpeakingQueue.value) return
  emit('clear-all')
}
</script>

<template>
  <!--
    Class names `mafia-vote-hud*` are kept (NOT renamed to a neutral
    namespace) because external `CallPage.css :deep()` rules target them
    from stream-view and mobile contexts. See the script-level comment for
    rationale.
  -->
  <div
    v-if="!readOnly || decoratedSegments.length > 0"
    class="mafia-vote-hud"
    :class="{
      'mafia-vote-hud--empty': decoratedSegments.length === 0,
      'mafia-vote-hud--readonly': readOnly,
    }"
    :style="{ '--mafia-vote-hud-width': `${hudWidth}px` }"
    role="region"
    :aria-label="labels.containerAria"
  >
    <div
      v-if="!readOnly"
      class="mafia-vote-hud__tools"
      role="toolbar"
      :aria-label="labels.toolbarAria"
    >
      <button
        type="button"
        class="mafia-vote-hud__tool mafia-vote-hud__tool--start"
        :class="{ 'mafia-vote-hud__tool--on': speakingActive }"
        :disabled="readOnly"
        :title="labels.speakingModeTitle"
        :aria-pressed="speakingActive"
        :aria-label="labels.speakingModeAria"
        @click="onSpeakingModeClick"
      >
        <img class="mafia-vote-hud__tool-art" :src="mafiaVoteStart" alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="mafia-vote-hud__tool mafia-vote-hud__tool--clear"
        :disabled="readOnly || !canClearSpeakingQueue"
        :title="labels.clearAllTitle"
        :aria-label="labels.clearAllTitle"
        @click="onClearAll"
      >
        <img class="mafia-vote-hud__tool-art" :src="mafiaVoteClear" alt="" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="decoratedSegments.length > 0"
      class="mafia-vote-hud__chips"
      role="status"
    >
      <TransitionGroup name="mafia-vote-chip">
        <button
          v-for="seg in decoratedSegments"
          :key="seg.id"
          type="button"
          class="mafia-vote-hud__chip"
          :disabled="readOnly"
          :title="chipTitle(seg.byLabel, seg.targetLabel)"
          :aria-label="chipTitle(seg.byLabel, seg.targetLabel)"
          @click="onRemove(seg.pairIndex, $event)"
        >
          <span class="mafia-vote-hud__chip-voter">{{ seg.byLabel }}</span>
          <span class="mafia-vote-hud__chip-arrow" aria-hidden="true">↓</span>
          <span class="mafia-vote-hud__chip-target">{{ seg.targetLabel }}</span>
        </button>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
/*
 * Class set + dimensions ported verbatim from the original
 * `MafiaSpeakingQueueBar.vue` (Phase 5b extraction). Namespace KEPT as
 * `mafia-vote-*` because `CallPage.css` `:deep()` rules target these
 * selectors externally; renaming would force a touch on `CallPage.css`.
 */

.mafia-vote-hud {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  width: min(var(--mafia-vote-hud-width, 104px), calc(100vw - 16px));
  max-width: min(451px, calc(100vw - 16px));
  height: 55px;
  padding: 7px;
  gap: 8px;
  border-radius: 33px;
  background: rgb(32 20 51 / 0.29);
  color: #fff;
  pointer-events: auto;
  overflow: hidden;
  transition:
    width 0.26s ease,
    background 0.18s ease;
}

.mafia-vote-hud--empty {
  justify-content: center;
  gap: 8px;
}

.mafia-vote-hud--readonly {
  justify-content: center;
}

.mafia-vote-hud__tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.mafia-vote-hud__tool,
.mafia-vote-hud__chip {
  margin: 0;
  font: inherit;
  border: 0;
  cursor: pointer;
}

.mafia-vote-hud__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 41px;
  height: 41px;
  padding: 0;
  border-radius: 999px;
  background: transparent;
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.16s ease;
}

.mafia-vote-hud__tool:hover:not(:disabled) {
  transform: scale(1.025);
}

.mafia-vote-hud__chip:hover:not(:disabled),
.mafia-vote-hud__chip:focus-visible:not(:disabled) {
  filter: brightness(1.08);
  transform: scale(1.03);
}

.mafia-vote-hud__tool:focus-visible,
.mafia-vote-hud__chip:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.82);
  outline-offset: 2px;
}

.mafia-vote-hud__tool:disabled,
.mafia-vote-hud__chip:disabled {
  cursor: default;
}

.mafia-vote-hud__tool:disabled {
  opacity: 0.48;
}

.mafia-vote-hud__tool--on {
  filter: brightness(1.15);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, #facc15 70%, transparent),
    0 0 0 1px rgb(250 204 21 / 0.28);
}

.mafia-vote-hud__tool-art {
  --mafia-vote-tool-hover: 0;
  --mafia-vote-tool-x: 0px;
  --mafia-vote-tool-y: 0px;
  --mafia-vote-tool-scale: 0;
  --mafia-vote-tool-rotate: 0deg;
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--mafia-vote-tool-x) * var(--mafia-vote-tool-hover)),
      calc(var(--mafia-vote-tool-y) * var(--mafia-vote-tool-hover))
    )
    scale(calc(1 + var(--mafia-vote-tool-scale) * var(--mafia-vote-tool-hover)))
    rotate(calc(var(--mafia-vote-tool-rotate) * var(--mafia-vote-tool-hover)));
  transform-origin: center;
  animation: mafia-vote-tool-nudge 1.16s ease-in-out infinite;
  transition: --mafia-vote-tool-hover 0.24s ease;
}

.mafia-vote-hud__tool:hover:not(:disabled) .mafia-vote-hud__tool-art {
  --mafia-vote-tool-hover: 1;
}

.mafia-vote-hud__chips {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 22px;
  align-items: stretch;
  justify-content: start;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  height: 41px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.mafia-vote-hud__chips::-webkit-scrollbar {
  display: none;
}

.mafia-vote-hud__chip {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 41px;
  padding: 4px 0 3px;
  border-radius: 33px;
  background: rgb(102 56 143 / 0.47);
  color: #fff;
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transition:
    filter 0.16s ease,
    transform 0.16s ease;
}

.mafia-vote-chip-enter-active,
.mafia-vote-chip-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.mafia-vote-chip-enter-from,
.mafia-vote-chip-leave-to {
  opacity: 0;
  transform: scaleX(0.72);
}

.mafia-vote-hud__chip-voter,
.mafia-vote-hud__chip-arrow,
.mafia-vote-hud__chip-target {
  display: block;
  width: 100%;
  text-align: center;
}

.mafia-vote-hud__chip-voter {
  color: rgb(255 255 255 / 0.94);
}

.mafia-vote-hud__chip-arrow {
  margin: 2px 0 1px;
  color: rgb(255 255 255 / 0.72);
  font-size: 8px;
  line-height: 1;
}

.mafia-vote-hud__chip-target {
  color: #ffd455;
}

@media (max-width: 760px) {
  .mafia-vote-hud {
    width: min(var(--mafia-vote-hud-width, 104px), calc(100vw - 16px));
  }
}

@property --mafia-vote-tool-hover {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --mafia-vote-tool-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --mafia-vote-tool-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --mafia-vote-tool-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --mafia-vote-tool-rotate {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes mafia-vote-tool-nudge {
  0%,
  100% {
    --mafia-vote-tool-x: 0px;
    --mafia-vote-tool-y: 0px;
    --mafia-vote-tool-scale: 0;
    --mafia-vote-tool-rotate: 0deg;
  }

  40% {
    --mafia-vote-tool-y: -1.2px;
    --mafia-vote-tool-scale: 0.04;
    --mafia-vote-tool-rotate: -2deg;
  }

  72% {
    --mafia-vote-tool-y: -0.5px;
    --mafia-vote-tool-scale: 0.018;
    --mafia-vote-tool-rotate: 1.1deg;
  }
}
</style>
