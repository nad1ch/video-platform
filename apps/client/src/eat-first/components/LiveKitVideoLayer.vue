<script setup>
/**
 * Повноекранний / сітковий шар відео LiveKit (OBS-friendly).
 * camGridOnly: без рамки «дошки» — тільки великі плитки камер (глобальний /overlay).
 */
import { computed } from 'vue'
import LiveKitParticipantTile from './LiveKitParticipantTile.vue'

const props = defineProps({
  /** 'grid' — сітка слотів; 'solo' — одне відео на весь кадр */
  mode: { type: String, required: true },
  /** true: лише камери на всю ширину, без підкладки під HUD-картки */
  camGridOnly: { type: Boolean, default: false },
  cinema: { type: Boolean, default: false },
  players: { type: Array, default: () => [] },
  soloPlayer: { type: Object, default: null },
  getTile: { type: Function, required: true },
  getVolume: { type: Function, required: true },
})

const emit = defineEmits(['volumeChange'])

function onVolume(player, v) {
  emit('volumeChange', { player, volume: v })
}

const soloReady = computed(() => {
  const sp = props.soloPlayer
  return Boolean(sp && props.getTile(sp))
})
</script>

<template>
  <div
    class="lkvl"
    :class="{
      'lkvl--solo': mode === 'solo',
      'lkvl--grid': mode === 'grid',
      'lkvl--cam-only': mode === 'grid' && camGridOnly,
    }"
    :aria-hidden="mode === 'grid' && camGridOnly ? false : true"
  >
    <template v-if="mode === 'grid'">
      <div
        v-if="camGridOnly"
        class="lkvl__fill"
        :class="{ 'lkvl__fill--cinema': cinema }"
      >
        <div class="grid lkvl__grid-fill" :class="{ 'grid--cinema': cinema }">
          <div v-for="p in players" :key="p.id" class="lkvl__cell lkvl__cell--fill">
            <LiveKitParticipantTile
              :player="p"
              :get-tile="getTile"
              :get-volume="getVolume"
              layer
              @update:volume="onVolume(p, $event)"
            />
          </div>
        </div>
      </div>
      <div v-else class="board-frame" :class="{ 'board-frame--cinema': cinema }">
        <div class="grid" :class="{ 'grid--cinema': cinema }">
          <div v-for="p in players" :key="p.id" class="lkvl__cell">
            <LiveKitParticipantTile
              :player="p"
              :get-tile="getTile"
              :get-volume="getVolume"
              layer
              @update:volume="onVolume(p, $event)"
            />
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-if="soloReady" class="lkvl__solo-inner">
        <LiveKitParticipantTile
          :player="soloPlayer"
          :get-tile="getTile"
          :get-volume="getVolume"
          layer
          solo-fill
          @update:volume="onVolume(soloPlayer, $event)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Дзеркалимо layout board-frame / grid з OverlayPage — відео збігається з клітинками карток */
.lkvl {
  pointer-events: none;
}
.lkvl--cam-only {
  pointer-events: auto;
}
.lkvl--grid {
  width: 100%;
  height: 100%;
}
.lkvl__fill {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: clamp(0.35rem, 1vw, 0.75rem);
  box-sizing: border-box;
  min-height: min(calc(100vh - 6rem), 900px);
}
.lkvl__fill--cinema {
  padding-bottom: 0.5rem;
}
.lkvl__grid-fill {
  max-width: none;
  width: 100%;
  min-height: min(78vh, 820px);
  align-content: stretch;
}
.lkvl__cell--fill {
  min-height: min(38vh, 400px);
}
@media (min-width: 900px) {
  .lkvl__cell--fill {
    min-height: min(42vh, 480px);
  }
}
.board-frame {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(0.85rem, 2vw, 1.35rem);
  border-radius: 20px;
  border: 1px solid rgba(168, 85, 247, 0.18);
  background: rgba(6, 4, 16, 0.25);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}
.board-frame--cinema {
  max-width: 1320px;
  padding-bottom: 1rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.85rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  align-content: stretch;
}
.grid--cinema {
  gap: 1.35rem 1.5rem;
  max-width: 1280px;
  padding-bottom: 0.5rem;
}
.lkvl__cell {
  min-height: min(42vh, 320px);
  display: flex;
  align-items: stretch;
}
.lkvl__cell :deep(.ptile--layer) {
  flex: 1;
}
@media (min-width: 900px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 520px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.lkvl--solo {
  position: absolute;
  inset: 0;
  width: 100%;
  min-height: 100%;
}
.lkvl__solo-inner {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: stretch;
}
.lkvl__solo-inner :deep(.ptile--layer) {
  flex: 1;
}
</style>
