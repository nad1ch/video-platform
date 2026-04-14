<script setup>
/**
 * «Зум-галерея» на лобі: міні-копія персонального HUD + камера (як глобальний /overlay).
 * Без публікації з цього клієнта (окремий identity lobby-*).
 */
import { computed, onMounted, onUnmounted, provide, ref, toRef, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { VideoQuality } from 'livekit-client'
import { useLiveKitRoom } from '../composables/useLiveKitRoom.js'
import { useMediaTracks } from '../composables/useMediaTracks.js'
import { useMosaicPlayerOrder } from '../composables/useMosaicPlayerOrder.js'
import { useLiveKitTileMap } from '../composables/useLiveKitTileMap.js'
import { useOverlayMosaicOrder } from '../composables/useOverlayMosaicOrder.js'
import VoiceVideoGrid from './VoiceVideoGrid.vue'
import LiveKitParticipantTile from './LiveKitParticipantTile.vue'
import OverlayPlayerCard from './OverlayPlayerCard.vue'
import { getLiveKitSubscribeQualityMode, liveKitConfigured } from '../config/livekit.js'
import { discordLikeGridDims } from '../utils/discordLikeGrid.js'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'
import { getOrCreateDeviceId } from '../utils/deviceId.js'
import { nominationsFromRoom } from '../services/gameService.js'
import { millisFromFirestore } from '../utils/firestoreTime.js'

const props = defineProps({
  gameId: { type: String, required: true },
  players: { type: Array, required: true },
  gameRoom: { type: Object, required: true },
  votes: { type: Array, default: () => [] },
  dataReady: { type: Boolean, default: false },
})

const route = useRoute()
const { t, te } = useI18n()

const liveKitIdentity = computed(() => {
  const dev = getOrCreateDeviceId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  return `lobby-${dev || 'browser'}`
})

const liveKitDisplayName = computed(() => t('join.zoomLiveKitName'))
const liveKitCanPublish = computed(() => false)

const liveKitPlayerNameMap = computed(() => {
  const m = {}
  for (const p of props.players) {
    const id = normalizePlayerSlotId(p.id)
    m[id] = typeof p.name === 'string' && p.name.trim() ? p.name : id
  }
  return m
})

const stageReady = computed(() => props.dataReady === true)

const lkRoomEnabled = computed(
  () =>
    liveKitConfigured() &&
    stageReady.value &&
    Boolean(String(props.gameId || '').trim()) &&
    Boolean(String(liveKitIdentity.value || '').trim()),
)

const lkVolumeByIdentity = ref({})

const activeSpotlightId = computed(() => {
  const a = props.gameRoom?.activePlayer
  if (a == null) return null
  const s = String(a).trim()
  return s.length ? s : null
})

const speakerForTimerId = computed(() => {
  const gr = props.gameRoom
  const cs = String(gr?.currentSpeaker ?? '').trim()
  if (cs) return cs
  const hasClock =
    (Number(gr?.speakingTimer) > 0 && gr?.timerStartedAt) ||
    (gr?.timerPaused === true && Number.isFinite(Number(gr?.timerRemainingFrozen)))
  if (hasClock) {
    const leg = String(gr?.activePlayer ?? '').trim()
    return leg || null
  }
  return null
})

const aliveInGame = computed(
  () => props.players.filter((p) => p.eliminated !== true).length,
)

const cinemaGrid = computed(() => aliveInGame.value === 4)
const dramaMode = computed(() => aliveInGame.value === 3)

const liveKitEliminatedSlots = computed(() => {
  const s = new Set()
  for (const p of props.players) {
    if (p.eliminated === true) s.add(normalizePlayerSlotId(p.id))
  }
  return s
})

const gameIdRef = computed(() => String(props.gameId || '').trim())

const lkMaxVideoSlots = computed(() => {
  const n = props.players.filter((p) => p.eliminated !== true).length
  return Math.min(24, Math.max(1, n || 8))
})

const lkSubscriberQualityCap = computed(() => {
  const q = String(route.query.lk_q ?? '').trim().toLowerCase()
  if (q === 'low' || q === '360' || q === '360p') return VideoQuality.LOW
  if (q === 'medium' || q === '480' || q === '480p') return VideoQuality.MEDIUM
  if (q === 'high' || q === 'off' || q === 'max') return null
  const env = getLiveKitSubscribeQualityMode()
  if (env === 'low') return VideoQuality.LOW
  if (env === 'medium') return VideoQuality.MEDIUM
  return null
})

const { room: lkRoom, connectionState: lkConnectionState, error: lkRoomError } = useLiveKitRoom({
  enabled: lkRoomEnabled,
  roomName: gameIdRef,
  identity: liveKitIdentity,
  displayName: liveKitDisplayName,
  canPublish: liveKitCanPublish,
})

const { tiles: lkTiles, tileMapRef: lkTileMap } = useMediaTracks(lkRoom, {
  spotlightSlot: activeSpotlightId,
  speakerSlot: speakerForTimerId,
  includeLocal: liveKitCanPublish,
  maxVideo: lkMaxVideoSlots,
  subscriberMaxQuality: lkSubscriberQualityCap,
  playerLabels: liveKitPlayerNameMap,
  volumeByIdentity: lkVolumeByIdentity,
  eliminatedSlots: liveKitEliminatedSlots,
})

provide('liveKitOverlayRoom', lkRoom)

const { speakingIdentities, liveKitTileForPlayer } = useLiveKitTileMap(lkTiles, lkTileMap)

const playersRef = toRef(props, 'players')

const { defaultOrderedPlayers: defaultOrderedPlayersForLobbyMosaic } = useOverlayMosaicOrder(
  playersRef,
  speakingIdentities,
)

function liveKitVolumeForPlayer(player) {
  const id = normalizePlayerSlotId(player.id)
  const v = lkVolumeByIdentity.value[id]
  return typeof v === 'number' ? v : 1
}

function setLiveKitVolumeForPlayer(player, v) {
  const id = normalizePlayerSlotId(player.id)
  lkVolumeByIdentity.value = { ...lkVolumeByIdentity.value, [id]: v }
}

const {
  playersDisplayOrdered: playersDisplayOrderedForLobbyMosaic,
  mosaicDragSourceId: lobbyMosaicDragSourceId,
  mosaicDropTargetId: lobbyMosaicDropTargetId,
  onMosaicDragStart: onLobbyMosaicDragStart,
  onMosaicDragEnd: onLobbyMosaicDragEnd,
  onMosaicDragOver: onLobbyMosaicDragOver,
  onMosaicDragEnterPlayer: onLobbyMosaicDragEnterPlayer,
  onMosaicDrop: onLobbyMosaicDrop,
} = useMosaicPlayerOrder(gameIdRef, defaultOrderedPlayersForLobbyMosaic)

const lobbyMosaicEl = ref(null)
const lobbyMosaicSize = ref({
  width: 640,
  height: 420,
})

watchEffect((onCleanup) => {
  const el = lobbyMosaicEl.value
  if (!el || typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver((entries) => {
    const cr = entries[0]?.contentRect
    if (!cr) return
    lobbyMosaicSize.value = {
      width: Math.max(1, cr.width),
      height: Math.max(1, cr.height),
    }
  })
  ro.observe(el)
  onCleanup(() => ro.disconnect())
})

const lobbyMosaicGridStyle = computed(() => {
  const n = playersDisplayOrderedForLobbyMosaic.value.length
  const { width: w, height: h } = lobbyMosaicSize.value
  const { cols, rows } = discordLikeGridDims(n, w, h)
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  }
})

const tick = ref(Date.now())
let tickId = null

onMounted(() => {
  tickId = window.setInterval(() => {
    tick.value = Date.now()
  }, 250)
})

onUnmounted(() => {
  if (tickId != null) {
    window.clearInterval(tickId)
    tickId = null
  }
})

const speakerTimeLeft = computed(() => {
  const gr = props.gameRoom
  if (gr?.timerPaused === true) {
    const f = Number(gr?.timerRemainingFrozen)
    if (Number.isFinite(f) && f >= 0) return f
    return undefined
  }
  const start = millisFromFirestore(gr?.timerStartedAt)
  const total = Number(gr?.speakingTimer) || 0
  if (start == null || total <= 0) return undefined
  const elapsed = Math.floor((tick.value - start) / 1000)
  return Math.max(0, total - elapsed)
})

const speakerTimerTotal = computed(() => Number(props.gameRoom?.speakingTimer) || 30)

function isSpotlightPlayer(p) {
  return activeSpotlightId.value != null && p.id === activeSpotlightId.value
}

function isTimerPlayer(p) {
  return speakerForTimerId.value != null && p.id === speakerForTimerId.value
}

function cardTimerProps(p) {
  if (!isTimerPlayer(p) || speakerTimeLeft.value === undefined) return {}
  return {
    speakerTimeLeft: speakerTimeLeft.value,
    speakerTimerTotal: speakerTimerTotal.value,
  }
}

const votingActive = computed(() => props.gameRoom?.voting?.active === true)
const votingTargetId = computed(() => String(props.gameRoom?.voting?.targetPlayer ?? '').trim())
const nominatedPlayerId = computed(() => String(props.gameRoom?.nominatedPlayer ?? '').trim())
const nominatedById = computed(() => String(props.gameRoom?.nominatedBy ?? '').trim())

function slotNumFromId(id) {
  const s = String(id ?? '')
  const m = s.match(/^p(\d+)$/i)
  if (m) return m[1]
  return s.replace(/^p/i, '') || s
}

function nominatorsLineFor(pid) {
  const id = String(pid ?? '')
  const list = nominationsFromRoom(props.gameRoom)
  const nums = list.filter((x) => String(x.target) === id).map((x) => slotNumFromId(x.by))
  if (nums.length) return nums.join(', ')
  const n = nominatedPlayerId.value
  const b = nominatedById.value
  if (n === id && b) return slotNumFromId(b)
  return ''
}

const roomRound = computed(() =>
  Math.min(8, Math.max(1, Math.floor(Number(props.gameRoom?.round) || 1))),
)

function votesForTarget(playerId) {
  const pid = String(playerId ?? '')
  return props.votes.filter(
    (v) => Number(v.round) === roomRound.value && String(v.targetPlayer) === pid,
  )
}

function handsMap() {
  const h = props.gameRoom?.hands
  return h && typeof h === 'object' ? h : {}
}

function isHandRaised(p) {
  return handsMap()[String(p.id)] === true
}

const handsRaisedAliveCount = computed(() =>
  props.players.filter((p) => p.eliminated !== true && isHandRaised(p)).length,
)

const handsClusterMode = computed(() => handsRaisedAliveCount.value > 3)

const zoomStatusLine = computed(() => {
  const phRaw = String(props.gameRoom?.gamePhase || 'intro')
  const pk = `gamePhase.${phRaw}`
  const ph = te(pk) ? t(pk) : phRaw
  const r = roomRound.value
  const n = props.players.length
  return t('overlayPage.phaseBanner', { phase: ph, round: r, n })
})
</script>

<template>
  <section class="lobby-zoom" aria-labelledby="lobby-zoom-title">
    <div class="lobby-zoom__head">
      <h2 id="lobby-zoom-title" class="lobby-zoom__title">{{ $t('join.zoomTitle') }}</h2>
      <p class="lobby-zoom__hint">{{ $t('join.zoomHint') }}</p>
      <p v-if="dataReady && players.length" class="lobby-zoom__status">{{ zoomStatusLine }}</p>
    </div>

    <VoiceVideoGrid
      v-if="liveKitConfigured()"
      :lk-connection-state="lkConnectionState"
      :lk-error="lkRoomError"
      :lk-room-enabled="lkRoomEnabled"
      :overlay-ready="stageReady"
      :can-publish="false"
      :spectator-mode="true"
      :speaker-slot="''"
      :spotlight-unmute-mode="false"
      :eliminated-local="false"
      :local-identity="String(liveKitIdentity)"
    />

    <div v-if="!dataReady" class="lobby-zoom__loading" role="status">
      <span class="lobby-zoom__spin" aria-hidden="true" />
      <span>{{ $t('join.zoomWaiting') }}</span>
    </div>

    <div v-else-if="!players.length" class="lobby-zoom__empty" role="status">
      {{ $t('join.zoomNoPlayers') }}
    </div>

    <div v-else class="lobby-zoom__canvas">
      <div
        v-if="liveKitConfigured() && lkRoomEnabled && playersDisplayOrderedForLobbyMosaic.length"
        ref="lobbyMosaicEl"
        class="lobby-zoom__mosaic"
        :style="lobbyMosaicGridStyle"
      >
        <div
          v-for="p in playersDisplayOrderedForLobbyMosaic"
          :key="p.id"
          class="lobby-zoom__cell"
          :class="{
            'lobby-zoom__cell--speaking': !!liveKitTileForPlayer(p)?.isSpeaking,
            'lobby-zoom__cell--drag-over':
              lobbyMosaicDropTargetId != null &&
              normalizePlayerSlotId(lobbyMosaicDropTargetId) === normalizePlayerSlotId(p.id),
            'lobby-zoom__cell--drag-source':
              lobbyMosaicDragSourceId === normalizePlayerSlotId(p.id),
          }"
          @dragover="
            (e) => {
              onLobbyMosaicDragOver(e)
              onLobbyMosaicDragEnterPlayer(p)
            }
          "
          @drop="onLobbyMosaicDrop(p, $event)"
        >
          <span
            class="lobby-mosaic-drag-handle"
            draggable="true"
            :title="$t('overlayPage.mosaicDragHandle')"
            :aria-label="$t('overlayPage.mosaicDragHandle')"
            role="button"
            tabindex="0"
            @dragstart="onLobbyMosaicDragStart(p, $event)"
            @dragend="onLobbyMosaicDragEnd"
            @click.stop
          >
            <span class="lobby-mosaic-drag-handle__grip" aria-hidden="true">⋮⋮</span>
          </span>
          <div class="lobby-zoom__cell-under">
            <LiveKitParticipantTile
              :player="p"
              :get-tile="liveKitTileForPlayer"
              :get-volume="liveKitVolumeForPlayer"
              layer
              mosaic-mode
              @update:volume="setLiveKitVolumeForPlayer(p, $event)"
            />
          </div>
          <div class="lobby-zoom__cell-over">
            <OverlayPlayerCard
              mosaic-tile
              solo
              :player="p"
              :is-spotlight="isSpotlightPlayer(p)"
              :is-timer-target="isTimerPlayer(p)"
              :cinema="cinemaGrid"
              :drama="dramaMode"
              :voting-active="votingActive"
              :voting-target-id="votingTargetId"
              :vote-interactive="false"
              :hide-vote-strip="true"
              :game-id="gameId"
              :nominated-player-id="nominatedPlayerId"
              :nominated-by-id="nominatedById"
              :nominators-line="nominatorsLineFor(p.id)"
              :room-round="roomRound"
              :votes-received="votesForTarget(p.id)"
              :has-voted-this-round="false"
              :is-vote-target-self="false"
              :hand-raised="isHandRaised(p)"
              :suppress-hand-badge="handsClusterMode"
              v-bind="cardTimerProps(p)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lobby-zoom {
  position: relative;
  margin: 1.5rem 0 2rem;
  padding: clamp(1rem, 2.5vw, 1.5rem);
  border-radius: 20px;
  border: 1px solid rgba(168, 85, 247, 0.22);
  background:
    radial-gradient(ellipse 90% 60% at 50% 0%, rgba(88, 28, 135, 0.22), transparent 55%),
    linear-gradient(165deg, rgba(10, 8, 22, 0.92) 0%, rgba(5, 3, 12, 0.96) 100%);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  min-height: min(72vh, 820px);
}
.lobby-zoom__head {
  flex-shrink: 0;
  text-align: center;
  margin-bottom: 1rem;
}
.lobby-zoom__title {
  margin: 0;
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: Orbitron, sans-serif;
  color: #e9d5ff;
}
.lobby-zoom__hint {
  margin: 0.4rem 0 0;
  font-size: clamp(0.72rem, 1.6vw, 0.82rem);
  line-height: 1.45;
  color: rgba(226, 220, 255, 0.72);
  max-width: 40rem;
  margin-left: auto;
  margin-right: auto;
}
.lobby-zoom__status {
  margin: 0.65rem 0 0;
  font-size: clamp(0.62rem, 1.4vw, 0.72rem);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-family: Orbitron, sans-serif;
  color: rgba(196, 181, 253, 0.75);
}
.lobby-zoom__loading,
.lobby-zoom__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  min-height: 12rem;
  font-size: 0.85rem;
  color: rgba(226, 220, 255, 0.75);
}
.lobby-zoom__spin {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid rgba(168, 85, 247, 0.25);
  border-top-color: rgba(196, 181, 253, 0.95);
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.lobby-zoom__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.lobby-zoom__mosaic {
  flex: 1;
  min-height: 240px;
  display: grid;
  gap: clamp(4px, 0.35vw, 8px);
  padding: clamp(2px, 0.25vw, 6px) 0;
  box-sizing: border-box;
}

.lobby-zoom__cell {
  container-type: size;
  position: relative;
  min-width: 0;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #050308;
  border: 1px solid rgba(168, 85, 247, 0.18);
}

.lobby-zoom__cell-under {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.lobby-zoom__cell-under :deep(.ptile--layer) {
  border-radius: 0;
  min-height: 100% !important;
  height: 100%;
}

.lobby-zoom__cell-over {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.lobby-mosaic-drag-handle {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 22;
  min-width: 1.6rem;
  min-height: 1.6rem;
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
.lobby-mosaic-drag-handle:active {
  cursor: grabbing;
}
.lobby-mosaic-drag-handle__grip {
  font-size: 0.6rem;
  line-height: 1;
  letter-spacing: -0.05em;
}
.lobby-zoom__cell--speaking {
  box-shadow:
    inset 0 0 0 3px rgba(34, 197, 94, 0.88),
    inset 0 0 18px rgba(34, 197, 94, 0.12);
}

.lobby-zoom__cell--drag-over {
  outline: 2px solid rgba(129, 140, 248, 0.92);
  outline-offset: -2px;
}
.lobby-zoom__cell--drag-source {
  opacity: 0.74;
}

</style>
