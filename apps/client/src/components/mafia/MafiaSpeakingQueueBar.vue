<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { mafiaGameSeatText } from '@/utils/mafiaSeatLabel'
import type { MafiaHostInteractionMode } from '@/utils/mafiaGameTypes'

const { t } = useI18n()
const mafia = useMafiaGameStore()
const { isMafiaHost, speakingQueue, hostInteractionMode, nightActions, hostSeatSwapSelectionPeerId } =
  storeToRefs(mafia)

const readOnly = computed(() => !isMafiaHost.value)

const segments = computed(() => {
  const o = speakingQueue.value
  if (o.length === 0) {
    return [] as { seat: number; id: string; label: string }[]
  }
  return o.map((seat, i) => ({
    seat,
    id: `${seat}-${i}`,
    label: mafiaGameSeatText(seat),
  }))
})

const canClearAllSelections = computed(() => {
  if (readOnly.value) {
    return false
  }
  if (speakingQueue.value.length > 0) {
    return true
  }
  if (Object.keys(nightActions.value).length > 0) {
    return true
  }
  if (hostSeatSwapSelectionPeerId.value != null) {
    return true
  }
  return false
})

/**
 * Speaking-queue mode: click toggles off → night (tile clicks use night / host panel).
 */
function onModeToolClick(mode: MafiaHostInteractionMode, ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) {
    return
  }
  if (hostInteractionMode.value === mode) {
    mafia.setHostInteractionMode('night')
    return
  }
  mafia.setHostInteractionMode(mode)
}

function isModeOn(mode: MafiaHostInteractionMode): boolean {
  return hostInteractionMode.value === mode
}

function onRemove(seat: number, ev: MouseEvent): void {
  ev.stopPropagation()
  if (readOnly.value) {
    return
  }
  mafia.removeSpeakingSeat(seat)
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
    class="mafia-host-hud"
    role="region"
    :aria-label="t('mafiaPage.speakingQueueAria')"
  >
    <div
      v-if="!readOnly"
      class="mafia-host-hud__tools"
      role="toolbar"
      :aria-label="t('mafiaPage.hostInteractionModeLabel')"
    >
      <button
        type="button"
        class="mafia-host-hud__fab h-focus-ring"
        :class="{ 'mafia-host-hud__fab--on': isModeOn('speaking') }"
        :title="t('mafiaPage.speakingModeHint')"
        :aria-pressed="isModeOn('speaking')"
        :aria-label="t('mafiaPage.modeSpeaking')"
        @click="onModeToolClick('speaking', $event)"
      >
        <span class="mafia-host-hud__fab-ico mafia-host-hud__fab-ico--emoji" aria-hidden="true">🎤</span>
      </button>
      <button
        type="button"
        class="mafia-host-hud__clear-all h-focus-ring"
        :disabled="!canClearAllSelections"
        :title="t('mafiaPage.clearAllHostSelectionsTitle')"
        :aria-label="t('mafiaPage.clearAllHostSelectionsTitle')"
        @click="onClearAllSelections"
      >
        <span class="mafia-host-hud__clear-all-ico" aria-hidden="true">×</span>
      </button>
    </div>
    <div class="mafia-host-hud__queue" role="status">
      <div class="mafia-host-hud__queue-surface">
        <div
          class="mafia-host-hud__queue-head-scroll"
          :class="{
            'mafia-host-hud__queue-head-scroll--empty': segments.length === 0,
          }"
        >
          <div v-if="segments.length" class="mafia-host-hud__body">
            <span
              v-for="(seg, i) in segments"
              :key="seg.id"
              class="mafia-host-hud__queue-seg"
            >
              <span v-if="i > 0" class="mafia-host-hud__sep" aria-hidden="true">→</span>
              <button
                type="button"
                class="mafia-host-hud__chip h-focus-ring"
                :class="{ 'mafia-host-hud__chip--readonly': readOnly }"
                :disabled="readOnly"
                :title="
                  readOnly
                    ? t('mafiaPage.speakingQueueChipViewOnly', { n: seg.seat })
                    : t('mafiaPage.speakingQueueRemoveTitle', { n: seg.seat })
                "
                :aria-label="
                  readOnly
                    ? t('mafiaPage.speakingQueueChipViewOnly', { n: seg.seat })
                    : t('mafiaPage.speakingQueueRemoveTitle', { n: seg.seat })
                "
                @click="onRemove(seg.seat, $event)"
              >
                {{ seg.label }}
              </button>
            </span>
          </div>
          <span
            v-else
            class="mafia-host-hud__empty"
            role="img"
            :aria-label="t('mafiaPage.speakingQueueEmpty')"
          >—</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="@/components/mafia/callMafiaHostHud.css"></style>
