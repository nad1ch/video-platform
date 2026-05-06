<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import { decodeSpeakingNominationFlat } from '@/utils/speakingNominationQueue'
import mafiaVoteClear from '@/assets/mafia/ui/vote-clear.svg'
import mafiaVoteStart from '@/assets/mafia/ui/vote-start.svg'

const props = withDefaults(
  defineProps<{
    showTools?: boolean
  }>(),
  { showTools: false },
)

const { t } = useI18n()
const eatFirstShell = useEatFirstCallShellStore()
const { speakingQueue, speakingMode } = storeToRefs(eatFirstShell)

const readOnly = computed(() => !props.showTools)

const segments = computed(() =>
  decodeSpeakingNominationFlat(speakingQueue.value).map((seg) => ({
    id: `pair-${seg.pairIndex}`,
    pairIndex: seg.pairIndex,
    byLabel: seg.bySeat == null ? '?' : String(seg.bySeat),
    target: seg.targetSeat,
    targetLabel: String(seg.targetSeat),
  })),
)

const hudWidth = computed(() => {
  const n = segments.value.length
  if (readOnly.value) {
    return n === 0 ? 0 : Math.min(451, 14 + n * 22 + Math.max(0, n - 1) * 6)
  }
  if (n === 0) return 104
  return Math.min(451, 104 + 8 + n * 22 + Math.max(0, n - 1) * 6)
})

const canClear = computed(() => !readOnly.value && speakingQueue.value.length > 0)

function onSpeakingModeClick(ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) return
  eatFirstShell.toggleSpeakingMode()
}

function onClear(ev: MouseEvent): void {
  ev.stopPropagation()
  if (!canClear.value) return
  eatFirstShell.clearSpeakingQueue()
  if (speakingMode.value) eatFirstShell.toggleSpeakingMode()
}

function onRemove(pairIndex: number, ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) return
  eatFirstShell.removeSpeakingNominationPairAt(pairIndex)
}
</script>

<template>
  <div
    v-if="!readOnly || segments.length > 0"
    class="ef-vote-hud"
    :class="{
      'ef-vote-hud--empty': segments.length === 0,
      'ef-vote-hud--readonly': readOnly,
    }"
    :style="{ '--ef-vote-hud-width': `${hudWidth}px` }"
    role="region"
    :aria-label="t('eatFirstCall.speakingQueueAria')"
  >
    <div
      v-if="!readOnly"
      class="ef-vote-hud__tools"
      role="toolbar"
      :aria-label="t('eatFirstCall.hostInteractionModeLabel')"
    >
      <button
        type="button"
        class="ef-vote-hud__tool ef-vote-hud__tool--start"
        :class="{ 'ef-vote-hud__tool--on': speakingMode }"
        :title="t('eatFirstCall.speakingModeHint')"
        :aria-pressed="speakingMode"
        :aria-label="t('eatFirstCall.modeSpeaking')"
        @click="onSpeakingModeClick"
      >
        <img class="ef-vote-hud__tool-art" :src="mafiaVoteStart" alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="ef-vote-hud__tool ef-vote-hud__tool--clear"
        :disabled="!canClear"
        :title="t('eatFirstCall.speakingQueueClearAllTitle')"
        :aria-label="t('eatFirstCall.speakingQueueClearAllTitle')"
        @click="onClear"
      >
        <img class="ef-vote-hud__tool-art" :src="mafiaVoteClear" alt="" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="segments.length > 0"
      class="ef-vote-hud__chips"
      role="status"
    >
      <TransitionGroup name="ef-vote-chip">
        <button
          v-for="seg in segments"
          :key="seg.id"
          type="button"
          class="ef-vote-hud__chip"
          :disabled="readOnly"
          :title="readOnly
            ? t('eatFirstCall.speakingQueueChipViewOnly', { by: seg.byLabel, target: seg.targetLabel })
            : t('eatFirstCall.speakingQueueRemoveTitle', { by: seg.byLabel, target: seg.targetLabel })"
          :aria-label="readOnly
            ? t('eatFirstCall.speakingQueueChipViewOnly', { by: seg.byLabel, target: seg.targetLabel })
            : t('eatFirstCall.speakingQueueRemoveTitle', { by: seg.byLabel, target: seg.targetLabel })"
          @click="onRemove(seg.pairIndex, $event)"
        >
          <span class="ef-vote-hud__chip-voter">{{ seg.byLabel }}</span>
          <span class="ef-vote-hud__chip-arrow" aria-hidden="true">↓</span>
          <span class="ef-vote-hud__chip-target">{{ seg.targetLabel }}</span>
        </button>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.ef-vote-hud {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  width: min(var(--ef-vote-hud-width, 55px), calc(100vw - 16px));
  max-width: min(451px, calc(100vw - 16px));
  height: 55px;
  padding: 7px;
  gap: 8px;
  border-radius: 33px;
  background: rgb(32 20 51 / 0.29);
  color: #fff;
  pointer-events: auto;
  overflow: hidden;
  transition: width 0.26s ease, background 0.18s ease;
}

.ef-vote-hud--empty {
  justify-content: center;
  gap: 8px;
}

.ef-vote-hud--readonly {
  justify-content: center;
}

.ef-vote-hud__tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.ef-vote-hud__tool,
.ef-vote-hud__chip {
  margin: 0;
  font: inherit;
  border: 0;
  cursor: pointer;
}

.ef-vote-hud__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 41px;
  height: 41px;
  padding: 0;
  border-radius: 999px;
  background: transparent;
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease;
}

.ef-vote-hud__tool:hover:not(:disabled) {
  transform: scale(1.025);
}

.ef-vote-hud__tool:focus-visible,
.ef-vote-hud__chip:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.82);
  outline-offset: 2px;
}

.ef-vote-hud__tool:disabled {
  opacity: 0.48;
}

.ef-vote-hud__tool--on {
  filter: brightness(1.15);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, #facc15 70%, transparent),
    0 0 0 1px rgb(250 204 21 / 0.28);
}

.ef-vote-hud__tool-art {
  --ef-vote-tool-hover: 0;
  --ef-vote-tool-y: 0px;
  --ef-vote-tool-scale: 0;
  --ef-vote-tool-rotate: 0deg;
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
  transform:
    translateY(calc(var(--ef-vote-tool-y) * var(--ef-vote-tool-hover)))
    scale(calc(1 + var(--ef-vote-tool-scale) * var(--ef-vote-tool-hover)))
    rotate(calc(var(--ef-vote-tool-rotate) * var(--ef-vote-tool-hover)));
  animation: ef-vote-tool-nudge 1.16s ease-in-out infinite;
  transition: --ef-vote-tool-hover 0.24s ease;
}

.ef-vote-hud__tool:hover:not(:disabled) .ef-vote-hud__tool-art {
  --ef-vote-tool-hover: 1;
}

.ef-vote-hud__chips {
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

.ef-vote-hud__chips::-webkit-scrollbar {
  display: none;
}

.ef-vote-hud__chip {
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
  transition: filter 0.16s ease, transform 0.16s ease;
}

.ef-vote-hud__chip:hover:not(:disabled),
.ef-vote-hud__chip:focus-visible:not(:disabled) {
  filter: brightness(1.08);
  transform: scale(1.03);
}

.ef-vote-hud__chip:disabled {
  cursor: default;
}

.ef-vote-hud__chip-voter,
.ef-vote-hud__chip-arrow,
.ef-vote-hud__chip-target {
  display: block;
  width: 100%;
  text-align: center;
}

.ef-vote-hud__chip-voter {
  color: rgb(255 255 255 / 0.94);
}

.ef-vote-hud__chip-arrow {
  margin: 2px 0 1px;
  color: rgb(255 255 255 / 0.72);
  font-size: 8px;
  line-height: 1;
}

.ef-vote-hud__chip-target {
  color: #ffd455;
}

.ef-vote-chip-enter-active,
.ef-vote-chip-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.ef-vote-chip-enter-from,
.ef-vote-chip-leave-to {
  opacity: 0;
  transform: scaleX(0.72);
}

@media (max-width: 760px) {
  .ef-vote-hud {
    width: min(var(--ef-vote-hud-width, 55px), calc(100vw - 16px));
  }
}

@property --ef-vote-tool-hover {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --ef-vote-tool-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --ef-vote-tool-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --ef-vote-tool-rotate {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes ef-vote-tool-nudge {
  0%, 100% {
    --ef-vote-tool-y: 0px;
    --ef-vote-tool-scale: 0;
    --ef-vote-tool-rotate: 0deg;
  }
  40% {
    --ef-vote-tool-y: -1.2px;
    --ef-vote-tool-scale: 0.04;
    --ef-vote-tool-rotate: -2deg;
  }
  72% {
    --ef-vote-tool-y: -0.5px;
    --ef-vote-tool-scale: 0.018;
    --ef-vote-tool-rotate: 1.1deg;
  }
}
</style>
