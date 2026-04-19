<script setup>
import { computed, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import OverlayMediaVideoLayer from '../OverlayMediaVideoLayer.vue'
import ParticipantTile from '../ParticipantTile.vue'
import OverlayPlayerCard from '../OverlayPlayerCard.vue'
import OverlayStatusLayer from './OverlayStatusLayer.vue'
import { useAuth } from '@/composables/useAuth'
import { discordLikeGridDims } from '../../utils/discordLikeGrid.js'
import { normalizePlayerSlotId } from '../../utils/playerSlot.js'
import { overlayAvatarUrlForTile } from '../../utils/overlayParticipantDisplay.js'
const props = defineProps({
  /** Mediasoup / VITE_SIGNALING_URL доступні — показувати відеошар. */
  mediaLayerEnabled: { type: Boolean, required: true },
  overlayPageReady: { type: Boolean, required: true },
  isPersonal: { type: Boolean, required: true },
  overlayDrama: { type: Boolean, required: true },
  overlayPaused: { type: Boolean, required: true },
  overlayRoundPulse: { type: Boolean, required: true },
  showAllVotedBanner: { type: Boolean, required: true },
  handsClusterMode: { type: Boolean, required: true },
  handsClusterExtra: { type: Number, required: true },
  roundBannerVisible: { type: Boolean, required: true },
  roomRound: { type: Number, required: true },
  players: { type: Array, required: true },
  gameId: { type: String, required: true },
  globalStatusLine: { type: String, required: true },
  overlayTokenGateBlocks: { type: Boolean, required: true },
  personalPlayerId: { type: String, default: '' },
  singlePlayer: { type: Object, default: null },
  personalVoteBannerVisible: { type: Boolean, required: true },
  votingTargetId: { type: String, required: true },
  slotNumFromIdFn: { type: Function, required: true },
  personalIsVoteTarget: { type: Boolean, required: true },
  personalOverlayVoteTally: { type: Object, required: true },
  soloCardViewModel: { type: Object, default: null },
  mediaTileForPlayer: { type: Function, required: true },
  mediaVolumeForPlayer: { type: Function, required: true },
  setMediaVolumeForPlayer: { type: Function, required: true },
  globalMosaicCardViewModels: { type: Array, required: true },
  mosaicDragSourceId: { type: String, default: null },
  mosaicDropTargetId: { type: String, default: null },
  onMosaicDragStart: { type: Function, required: true },
  onMosaicDragEnd: { type: Function, required: true },
  onMosaicDragOver: { type: Function, required: true },
  onMosaicDragEnterPlayer: { type: Function, required: true },
  onMosaicDrop: { type: Function, required: true },
})

const { t } = useI18n()
const router = useRouter()
const { user } = useAuth()

function mosaicAvatarUrl(player, tile) {
  return overlayAvatarUrlForTile(player, Boolean(tile?.isLocal), user.value?.avatar)
}

const globalMosaicEl = ref(null)
const globalMosaicSize = ref({
  width: typeof window !== 'undefined' ? window.innerWidth : 1280,
  height: typeof window !== 'undefined' ? Math.max(320, window.innerHeight - 160) : 720,
})

watchEffect((onCleanup) => {
  const el = globalMosaicEl.value
  if (!el || typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver((entries) => {
    const cr = entries[0]?.contentRect
    if (!cr) return
    globalMosaicSize.value = {
      width: Math.max(1, cr.width),
      height: Math.max(1, cr.height),
    }
  })
  ro.observe(el)
  onCleanup(() => ro.disconnect())
})

const globalMosaicGridStyle = computed(() => {
  const n = props.globalMosaicCardViewModels.length
  const { width: w, height: h } = globalMosaicSize.value
  const { cols, rows } = discordLikeGridDims(n, w, h)
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  }
})

function slotNumForBanner() {
  return props.slotNumFromIdFn(props.votingTargetId)
}

/** Cached fns per slot — avoids new drag handler closures every mosaic re-render. */
const mosaicDragOverBySlot = new Map()
const mosaicDropBySlot = new Map()

function mosaicDragOverForPlayerId(rawId) {
  const id = normalizePlayerSlotId(rawId)
  let h = mosaicDragOverBySlot.get(id)
  if (!h) {
    h = (e) => {
      props.onMosaicDragOver(e)
      props.onMosaicDragEnterPlayer({ id })
    }
    mosaicDragOverBySlot.set(id, h)
  }
  return h
}

function mosaicDropForPlayerId(rawId) {
  const id = normalizePlayerSlotId(rawId)
  let h = mosaicDropBySlot.get(id)
  if (!h) {
    h = (e) => {
      props.onMosaicDrop({ id }, e)
    }
    mosaicDropBySlot.set(id, h)
  }
  return h
}

watch(
  () => props.globalMosaicCardViewModels.map((r) => normalizePlayerSlotId(r.player.id)).join('\0'),
  (key) => {
    const ids = new Set(key ? key.split('\0') : [])
    for (const k of mosaicDragOverBySlot.keys()) {
      if (!ids.has(k)) mosaicDragOverBySlot.delete(k)
    }
    for (const k of mosaicDropBySlot.keys()) {
      if (!ids.has(k)) mosaicDropBySlot.delete(k)
    }
  },
)
</script>

<template>
  <AppFullPageLoader
    :visible="!overlayPageReady"
    :label="t('overlayPage.sync')"
  />
  <div
    class="overlay-root"
    :class="{
      'overlay-root--personal': isPersonal,
      'overlay-root--global': !isPersonal,
      'overlay-root--drama': overlayDrama,
      'overlay-root--paused': overlayPaused,
      'overlay-root--round-pulse': overlayRoundPulse,
    }"
  >
    <OverlayStatusLayer
      :show-all-voted-banner="showAllVotedBanner"
      :hands-cluster-mode="handsClusterMode"
      :hands-cluster-extra="handsClusterExtra"
      :is-personal="isPersonal"
      :round-banner-visible="roundBannerVisible"
      :room-round="roomRound"
    />
    <div
      class="overlay-body"
      :class="{ 'overlay-body--all-voted': showAllVotedBanner }"
      data-onb="overlay-body"
    >
      <header
        v-if="!isPersonal"
        class="board-head"
      >
        <p class="eyebrow">{{ t('overlayPage.globalEyebrow', { game: gameId }) }}</p>
        <h1 class="title">{{ t('game.title') }}</h1>
        <p class="board-status">{{ globalStatusLine }}</p>
        <div v-if="players.length === 0" class="overlay-firestore-wait" role="status">
          <span class="overlay-firestore-wait__spin" aria-hidden="true" />
          <span class="overlay-firestore-wait__txt">{{ t('overlayPage.waitFirestore') }}</span>
        </div>
      </header>

      <div v-if="isPersonal && overlayTokenGateBlocks" class="overlay-token-wall" role="alert">
        <p class="overlay-token-wall__title">{{ t('overlayPage.tokenMismatchTitle') }}</p>
        <p class="overlay-token-wall__hint">{{ t('overlayPage.tokenMismatchHint') }}</p>
        <button type="button" class="overlay-token-wall__btn" @click="router.push({ name: 'eat', query: { view: 'join', game: gameId } })">
          {{ t('overlayPage.tokenMismatchCta') }}
        </button>
      </div>

      <div v-else-if="isPersonal && !singlePlayer" class="personal-wait" role="status">
        <span class="personal-wait__spin" aria-hidden="true" />
        <span class="personal-wait__msg">{{ t('overlayPage.noData', { id: personalPlayerId }) }}</span>
      </div>

      <div
        v-if="personalVoteBannerVisible"
        class="overlay-vote-top"
        role="status"
        aria-live="polite"
      >
        <p class="overlay-vote-top__k">{{ t('overlayPage.voting') }}</p>
        <p class="overlay-vote-top__line">{{ t('overlayPage.voteAgainst', { n: slotNumForBanner() }) }}</p>
        <p v-if="personalIsVoteTarget" class="overlay-vote-top__warn">{{ t('overlayPage.youAreTarget') }}</p>
        <p class="overlay-vote-top__sc">
          👍 {{ personalOverlayVoteTally.for }}
          <span class="overlay-vote-top__dot">·</span>
          👎 {{ personalOverlayVoteTally.against }}
        </p>
        <p class="overlay-vote-top__hint">{{ t('overlayPage.voteInPanel') }}</p>
      </div>

      <div
        v-if="isPersonal && !overlayTokenGateBlocks"
        class="single-stage-wrap"
        data-onb="overlay-content"
        data-stage="personal"
      >
        <div
          v-if="mediaLayerEnabled && overlayPageReady && singlePlayer"
          class="single-stage-wrap__under"
        >
          <OverlayMediaVideoLayer
            mode="solo"
            :solo-player="singlePlayer"
            :get-tile="mediaTileForPlayer"
            :get-volume="mediaVolumeForPlayer"
            @volume-change="({ player: pl, volume: vol }) => setMediaVolumeForPlayer(pl, vol)"
          />
        </div>
        <div class="single-stage single-stage--hud single-stage-wrap__over">
          <OverlayPlayerCard
            v-if="soloCardViewModel"
            v-bind="soloCardViewModel"
          />
        </div>
      </div>

      <div
        v-else-if="!isPersonal"
        ref="globalMosaicEl"
        class="overlay-global-mosaic"
        :style="globalMosaicGridStyle"
        data-onb="overlay-content"
        data-stage="global"
      >
        <template v-if="mediaLayerEnabled && overlayPageReady && globalMosaicCardViewModels.length">
          <div
            v-for="row in globalMosaicCardViewModels"
            :key="row.player.id"
            class="mosaic-cell"
            :class="{
              'mosaic-cell--speaking': !!row.tile?.isSpeaking,
              'mosaic-cell--drag-over':
                mosaicDropTargetId != null &&
                normalizePlayerSlotId(mosaicDropTargetId) === normalizePlayerSlotId(row.player.id),
              'mosaic-cell--drag-source': mosaicDragSourceId === normalizePlayerSlotId(row.player.id),
            }"
            @dragover="mosaicDragOverForPlayerId(row.player.id)"
            @drop="mosaicDropForPlayerId(row.player.id)"
          >
            <span
              class="mosaic-drag-handle"
              draggable="true"
              :title="t('overlayPage.mosaicDragHandle')"
              :aria-label="t('overlayPage.mosaicDragHandle')"
              role="button"
              tabindex="0"
              @dragstart="onMosaicDragStart(row.player, $event)"
              @dragend="onMosaicDragEnd"
              @click.stop
            >
              <span class="mosaic-drag-handle__grip" aria-hidden="true">⋮⋮</span>
            </span>
            <div class="mosaic-cell__under">
              <ParticipantTile
                v-if="row.tile && row.tile.mediaStream"
                layer
                mosaic-mode
                :media-stream="row.tile.mediaStream"
                :identity="row.tile.identity"
                :label="row.tile.label"
                :is-local="row.tile.isLocal"
                :show-video="row.tile.showVideo"
                :is-muted="row.tile.isMuted"
                :is-speaking="row.tile.isSpeaking"
                :volume="row.volume"
                :avatar-url="mosaicAvatarUrl(row.player, row.tile)"
                @update:volume="setMediaVolumeForPlayer(row.player, $event)"
              />
            </div>
            <div class="mosaic-cell__over">
              <OverlayPlayerCard v-bind="row.card" />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay-root {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #050308;
}

.overlay-root--round-pulse {
  animation: roundScene 0.25s ease both;
}

@keyframes roundScene {
  0% {
    transform: scale(1.02);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.overlay-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transform-origin: top center;
  transition: transform 0.35s ease;
}

.overlay-global-mosaic {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: grid;
  gap: clamp(4px, 0.35vw, 8px);
  padding: clamp(4px, 0.35vw, 8px);
  box-sizing: border-box;
}

.mosaic-cell {
  container-type: size;
  container-name: mosaic;
  position: relative;
  min-width: 0;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #050308;
  border: 1px solid rgba(168, 85, 247, 0.18);
}

.mosaic-cell__under {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.mosaic-cell__under :deep(.ptile--layer) {
  border-radius: 0;
  min-height: 100% !important;
  height: 100%;
}

.mosaic-cell__over {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.mosaic-drag-handle {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 22;
  min-width: 1.65rem;
  min-height: 1.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  pointer-events: auto;
  border-radius: 8px;
  background: rgba(5, 3, 12, 0.78);
  border: 1px solid rgba(168, 85, 247, 0.38);
  color: rgba(226, 220, 255, 0.9);
  user-select: none;
}
.mosaic-drag-handle:active {
  cursor: grabbing;
}
.mosaic-drag-handle__grip {
  font-size: 0.62rem;
  line-height: 1;
  letter-spacing: -0.06em;
}
.mosaic-cell--speaking {
  box-shadow:
    inset 0 0 0 3px rgba(34, 197, 94, 0.88),
    inset 0 0 18px rgba(34, 197, 94, 0.12);
}

.mosaic-cell--drag-over {
  outline: 2px solid rgba(129, 140, 248, 0.92);
  outline-offset: -2px;
}
.mosaic-cell--drag-source {
  opacity: 0.74;
}

.overlay-body--all-voted {
  transform: scale(1.01);
}

.overlay-root--personal .overlay-body {
  flex: 1;
  min-height: 100vh;
}

.overlay-vote-top {
  position: fixed;
  top: max(0.5rem, env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  margin: 0;
  padding: 0.45rem 1rem 0.55rem;
  max-width: min(92vw, 28rem);
  text-align: center;
  pointer-events: none;
  font-family: var(--sa-font-display);
  border-radius: 12px;
  background: rgba(8, 6, 22, 0.88);
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

.overlay-vote-top__k {
  margin: 0;
  font-size: clamp(0.48rem, min(1.2vw, 1.35vh), 0.58rem);
  font-weight: 900;
  letter-spacing: 0.2em;
  color: rgba(125, 211, 252, 0.95);
}

.overlay-vote-top__line {
  margin: 0.2rem 0 0;
  font-size: clamp(0.62rem, min(1.65vw, 1.75vh), 0.78rem);
  font-weight: 800;
  color: #f8fafc;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.75);
}

.overlay-vote-top__warn {
  margin: 0.35rem 0 0;
  font-size: clamp(0.58rem, min(1.5vw, 1.6vh), 0.72rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #fecaca;
  animation: overlayVotePulse 1.4s ease-in-out infinite;
}

@keyframes overlayVotePulse {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}

.overlay-vote-top__sc {
  margin: 0.35rem 0 0;
  font-size: clamp(0.7rem, min(1.85vw, 2vh), 0.88rem);
  font-weight: 800;
  color: #e2e8f0;
}

.overlay-vote-top__dot {
  margin: 0 0.35rem;
  opacity: 0.5;
}

.overlay-vote-top__hint {
  margin: 0.3rem 0 0;
  font-size: clamp(0.48rem, min(1.25vw, 1.35vh), 0.58rem);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(203, 213, 225, 0.88);
}

.overlay-root--global {
  padding: clamp(0.85rem, 2vw, 1.35rem) clamp(0.75rem, 2vw, 1.5rem) 2rem;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(88, 28, 135, 0.35), transparent 55%),
    linear-gradient(180deg, #070510 0%, #030208 100%);
}

.overlay-root--personal {
  position: relative;
  min-height: 100vh;
  background: transparent;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.overlay-root--drama {
  position: relative;
  filter: contrast(1.08) brightness(0.92);
  animation: overlayDramaHeartbeat 1.2s ease-in-out infinite;
}

.overlay-root--paused:not(.overlay-root--drama) {
  filter: brightness(0.7);
}

.overlay-root--drama.overlay-root--paused {
  animation: overlayDramaHeartbeatPaused 1.2s ease-in-out infinite;
}

.overlay-root--personal.overlay-root--drama {
  animation: overlayDramaHeartbeat 1.2s ease-in-out infinite;
}

@keyframes overlayDramaHeartbeat {
  0%,
  100% {
    filter: contrast(1.06) brightness(0.93);
  }
  50% {
    filter: contrast(1.14) brightness(0.87);
  }
}

@keyframes overlayDramaHeartbeatPaused {
  0%,
  100% {
    filter: contrast(1.06) brightness(0.65);
  }
  50% {
    filter: contrast(1.12) brightness(0.6);
  }
}

.overlay-root--drama::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 35%,
    rgba(90, 20, 30, 0.38) 100%
  );
  animation: dramaVignettePulse 1.2s ease-in-out infinite;
}

@keyframes dramaVignettePulse {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}

.overlay-root--drama .board-head {
  position: relative;
  z-index: 1;
}

.board-head {
  flex-shrink: 0;
  text-align: center;
  margin-bottom: 1.1rem;
  max-width: 960px;
  margin-left: auto;
  margin-right: auto;
}

.board-status {
  margin: 0.5rem 0 0;
  font-size: clamp(0.68rem, 1.5vw, 0.82rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: var(--sa-font-display);
  color: rgba(196, 181, 253, 0.72);
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(196, 181, 253, 0.45);
}

.title {
  margin: 0;
  font-size: clamp(1.2rem, 2.8vw, 1.75rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #f5f3ff;
  font-family: var(--sa-font-display);
  line-height: 1.15;
  text-shadow: 0 0 28px rgba(168, 85, 247, 0.2);
}

.overlay-firestore-wait {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0.85rem 0 0;
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(168, 85, 247, 0.2);
  animation: ui-slide-up 0.55s var(--motion-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

.overlay-firestore-wait__spin {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  border: 2px solid rgba(168, 85, 247, 0.25);
  border-top-color: rgba(196, 181, 253, 0.95);
  animation: panelSpin 0.7s linear infinite;
}

.overlay-firestore-wait__txt {
  font-size: 0.82rem;
  color: rgba(226, 220, 255, 0.88);
}

.overlay-token-wall {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 1.5rem;
  text-align: center;
  background: rgba(10, 8, 18, 0.92);
  color: rgba(226, 220, 255, 0.95);
  animation: ui-fade-in 0.35s ease both;
}

.overlay-token-wall__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.overlay-token-wall__hint {
  margin: 0;
  max-width: 22rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: rgba(226, 220, 255, 0.72);
}

.overlay-token-wall__btn {
  margin-top: 0.35rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  border: 1px solid rgba(196, 181, 253, 0.45);
  background: rgba(168, 85, 247, 0.25);
  color: rgba(251, 245, 255, 0.98);
}

.overlay-token-wall__btn:hover {
  filter: brightness(1.08);
}

.personal-wait {
  position: absolute;
  top: 0.35rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  padding: 0.35rem 0.75rem;
  font-size: 0.65rem;
  color: rgba(226, 220, 255, 0.85);
  z-index: 10;
  pointer-events: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(168, 85, 247, 0.22);
  animation: ui-fade-in 0.4s ease both;
}

.personal-wait__spin {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  border: 2px solid rgba(168, 85, 247, 0.3);
  border-top-color: rgba(251, 191, 36, 0.9);
  animation: panelSpin 0.65s linear infinite;
}

.personal-wait__msg {
  white-space: nowrap;
}

@keyframes panelSpin {
  to {
    transform: rotate(360deg);
  }
}

.single-stage-wrap {
  position: relative;
  flex: 1;
  min-height: 100vh;
  width: 100%;
}
.single-stage-wrap__under {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.single-stage-wrap__over {
  position: relative;
  z-index: 1;
  pointer-events: none;
}
.single-stage--hud {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
