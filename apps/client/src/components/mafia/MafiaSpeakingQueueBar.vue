<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { mafiaGameSeatText } from '@/utils/mafiaSeatLabel'
import type { MafiaHostInteractionMode } from '@/utils/mafiaGameTypes'
import mafiaVoteClear from '@/assets/mafia/ui/vote-clear.svg'
import mafiaVoteStart from '@/assets/mafia/ui/vote-start.svg'

const { t } = useI18n()
const mafia = useMafiaGameStore()
const { isMafiaHost, speakingQueue, hostInteractionMode, nightActions, hostSeatSwapSelectionPeerId } =
  storeToRefs(mafia)

const readOnly = computed(() => !isMafiaHost.value)

const segments = computed(() =>
  speakingQueue.value.map((targetSeat, i) => ({
    id: `${targetSeat}-${i}`,
    voter: i + 1,
    target: targetSeat,
    targetLabel: mafiaGameSeatText(targetSeat),
  })),
)

const hudWidth = computed(() => {
  const n = segments.value.length
  if (n === 0) {
    return 104
  }
  return Math.min(451, 104 + 8 + n * 22 + Math.max(0, n - 1) * 6)
})

const canClearAllSelections = computed(() => {
  if (readOnly.value) {
    return false
  }
  return (
    speakingQueue.value.length > 0 ||
    Object.keys(nightActions.value).length > 0 ||
    hostSeatSwapSelectionPeerId.value != null
  )
})

function onModeToolClick(mode: MafiaHostInteractionMode, ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) {
    return
  }
  mafia.setHostInteractionMode(hostInteractionMode.value === mode ? 'night' : mode)
}

function isModeOn(mode: MafiaHostInteractionMode): boolean {
  return hostInteractionMode.value === mode
}

function onRemove(targetSeat: number, ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) {
    return
  }
  mafia.removeSpeakingSeat(targetSeat)
}

function onClearAllSelections(ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value || !canClearAllSelections.value) {
    return
  }
  mafia.clearHostToolbarSelections()
}
</script>

<template>
  <div
    class="mafia-vote-hud"
    :class="{ 'mafia-vote-hud--empty': segments.length === 0 }"
    :style="{ '--mafia-vote-hud-width': `${hudWidth}px` }"
    role="region"
    :aria-label="t('mafiaPage.speakingQueueAria')"
  >
    <div
      class="mafia-vote-hud__tools"
      role="toolbar"
      :aria-label="t('mafiaPage.hostInteractionModeLabel')"
    >
      <button
        type="button"
        class="mafia-vote-hud__tool mafia-vote-hud__tool--start"
        :class="{ 'mafia-vote-hud__tool--on': isModeOn('speaking') }"
        :disabled="readOnly"
        :title="t('mafiaPage.speakingModeHint')"
        :aria-pressed="isModeOn('speaking')"
        :aria-label="t('mafiaPage.modeSpeaking')"
        @click="onModeToolClick('speaking', $event)"
      >
        <img class="mafia-vote-hud__tool-art" :src="mafiaVoteStart" alt="" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="mafia-vote-hud__tool mafia-vote-hud__tool--clear"
        :disabled="readOnly || !canClearAllSelections"
        :title="t('mafiaPage.clearAllHostSelectionsTitle')"
        :aria-label="t('mafiaPage.clearAllHostSelectionsTitle')"
        @click="onClearAllSelections"
      >
        <img class="mafia-vote-hud__tool-art" :src="mafiaVoteClear" alt="" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="segments.length > 0"
      class="mafia-vote-hud__chips"
      role="status"
    >
      <TransitionGroup name="mafia-vote-chip">
        <button
          v-for="seg in segments"
          :key="seg.id"
          type="button"
          class="mafia-vote-hud__chip"
          :disabled="readOnly"
          :title="
            readOnly
              ? t('mafiaPage.speakingQueueChipViewOnly', { n: seg.target })
              : t('mafiaPage.speakingQueueRemoveTitle', { n: seg.target })
          "
          :aria-label="
            readOnly
              ? t('mafiaPage.speakingQueueChipViewOnly', { n: seg.target })
              : t('mafiaPage.speakingQueueRemoveTitle', { n: seg.target })
          "
          @click="onRemove(seg.target, $event)"
        >
          <span class="mafia-vote-hud__chip-voter">{{ seg.voter }}</span>
          <span class="mafia-vote-hud__chip-target">{{ seg.targetLabel }}</span>
        </button>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
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
    filter 0.16s ease,
    transform 0.16s ease,
    opacity 0.16s ease;
}

.mafia-vote-hud__tool:hover:not(:disabled),
.mafia-vote-hud__tool:focus-visible:not(:disabled),
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
}

.mafia-vote-hud__tool-art {
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
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
  padding: 5px 0 4px;
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
.mafia-vote-hud__chip-target {
  display: block;
  width: 100%;
  text-align: center;
}

.mafia-vote-hud__chip-voter {
  color: rgb(255 255 255 / 0.94);
}

.mafia-vote-hud__chip-target {
  margin-top: 7px;
  color: #ffd455;
}

@media (max-width: 760px) {
  .mafia-vote-hud {
    width: min(var(--mafia-vote-hud-width, 104px), calc(100vw - 16px));
  }
}
</style>
