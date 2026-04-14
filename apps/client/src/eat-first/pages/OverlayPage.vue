<script setup>
import { computed, onUnmounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  subscribeToCharacter,
  subscribeToGameRoom,
  subscribeToPlayers,
  subscribeToVotes,
} from '../services/gameService'
import { normalizeGameRoomPayload } from '../utils/gameRoomNormalize.js'
import OverlayVideoLayer from '../components/overlay/OverlayVideoLayer.vue'
import OverlayUiLayer from '../components/overlay/OverlayUiLayer.vue'
import { mediasoupSignalingAvailable } from '../config/mediasoup.js'
import { getPersistedGameId, setPersistedGameId } from '../utils/persistedGameId.js'
import { useMosaicPlayerOrder } from '../composables/useMosaicPlayerOrder.js'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'
import { getOrCreateDeviceId } from '../utils/deviceId.js'
import { useEatOverlayMediasoup } from '../composables/useEatOverlayMediasoup.js'
import { useOverlayMediaTileMap } from '../composables/useOverlayMediaTileMap.js'
import { useOverlaySpeakerCountdown } from '../composables/useOverlaySpeakerCountdown.js'
import { useOverlayMosaicOrder } from '../composables/useOverlayMosaicOrder.js'
import { useOverlayCardViewModels } from '../composables/useOverlayCardViewModels.js'
import { useOverlayVolumeBindings } from '../composables/useOverlayVolumeBindings.js'
import { useOverlayRoomState } from '../composables/useOverlayRoomState.js'
import { useOverlayVotingState } from '../composables/useOverlayVotingState.js'
import { useOverlayUiState } from '../composables/useOverlayUiState.js'

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()

const gotGameRoomOv = ref(false)
const gotPrimaryOv = ref(false)

const gameId = computed(() => {
  const q = route.query.game
  if (q != null && String(q).trim()) return String(q).trim()
  const p = getPersistedGameId()
  if (p) return p
  return 'test1'
})

const personalPlayerId = computed(() => {
  const p = route.query.player
  if (p == null) return null
  const s = String(p).trim()
  return s.length ? s : null
})

const isPersonal = computed(() => personalPlayerId.value != null)

/** Унікальний peer id для глобального оверлею (spectator), щоб не зіткнутися з іншим учасником у кімнаті. */
const overlayPeerId = computed(() => {
  if (personalPlayerId.value) return normalizePlayerSlotId(personalPlayerId.value)
  const dev = getOrCreateDeviceId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  return `spectator-${dev || 'browser'}`
})

const lkSpotlightUnmute = computed(() => String(route.query.lk_focus ?? '') === '1')

const players = ref([])
const singlePlayer = ref(null)
const gameRoom = ref({})
const votes = ref([])
const aliveForCinema = ref(0)

/** Якщо в URL є ?token= і він не збігається з joinToken у Firestore — приховуємо картку. Без token — як раніше (OBS). */
const overlayTokenGateBlocks = computed(() => {
  if (!isPersonal.value) return false
  const urlTok = String(route.query.token ?? '').trim()
  if (!urlTok) return false
  const p = singlePlayer.value
  if (!p) return false
  const st = typeof p.joinToken === 'string' ? p.joinToken.trim() : ''
  if (!st) return false
  return urlTok !== st
})

const overlayDisplayName = computed(() => {
  if (personalPlayerId.value && singlePlayer.value && typeof singlePlayer.value.name === 'string') {
    return singlePlayer.value.name
  }
  if (personalPlayerId.value) return personalPlayerId.value
  return 'Spectator'
})

const overlayCanPublish = computed(() => {
  if (!personalPlayerId.value) return false
  if (overlayTokenGateBlocks.value) return false
  if (singlePlayer.value?.eliminated === true) return false
  return true
})

const overlayEliminatedLocal = computed(() => singlePlayer.value?.eliminated === true)

const overlayPlayerLabels = computed(() => {
  const m = {}
  if (isPersonal.value && singlePlayer.value) {
    const id = normalizePlayerSlotId(singlePlayer.value.id)
    m[id] =
      typeof singlePlayer.value.name === 'string' && singlePlayer.value.name.trim()
        ? singlePlayer.value.name
        : id
  }
  for (const p of players.value) {
    const id = normalizePlayerSlotId(p.id)
    m[id] = typeof p.name === 'string' && p.name.trim() ? p.name : id
  }
  return m
})

let unsubscribe = null
let unsubPlayersCount = null
let unsubGameRoom = null
let unsubVotes = null

watch(
  () => [route.path, String(route.query.game ?? '')],
  () => {
    if (String(route.query.view ?? '').toLowerCase() !== 'overlay') return
    if (String(route.query.game ?? '').trim()) return
    router.replace({
      name: 'eat',
      query: { ...route.query, view: 'overlay', game: gameId.value },
    })
  },
  { immediate: true, flush: 'post' },
)

function cleanupPlayerSub() {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (unsubPlayersCount) {
    unsubPlayersCount()
    unsubPlayersCount = null
  }
}

function cleanupGameRoom() {
  if (unsubGameRoom) {
    unsubGameRoom()
    unsubGameRoom = null
  }
}

function cleanupVotesSub() {
  if (unsubVotes) {
    unsubVotes()
    unsubVotes = null
  }
}

function setupGameRoom(gid) {
  gotGameRoomOv.value = false
  cleanupGameRoom()
  unsubGameRoom = subscribeToGameRoom(gid, (data) => {
    gameRoom.value = normalizeGameRoomPayload(data && typeof data === 'object' ? data : {})
    gotGameRoomOv.value = true
  })
}

function setupVotesSub(gid) {
  cleanupVotesSub()
  unsubVotes = subscribeToVotes(gid, (list) => {
    votes.value = list
  })
}

watch(
  gameId,
  (gid) => {
    setPersistedGameId(gid)
    setupGameRoom(gid)
    setupVotesSub(gid)
  },
  { immediate: true },
)

const {
  gamePhase,
  roomRound,
  activeSpotlightId,
  speakerForTimerId,
  overlayPaused,
  handsMap,
  nominationsRoomSlice,
} = useOverlayRoomState(gameRoom)

const { votingActive, votingTargetId, nominatedPlayerId, nominatedById } = useOverlayVotingState(gameRoom)

const aliveInGame = computed(
  () => players.value.filter((p) => p.eliminated !== true).length,
)

const cinemaGrid = computed(() => !isPersonal.value && aliveInGame.value === 4)
const cinemaHud = computed(() => isPersonal.value && aliveForCinema.value === 4)

watch(
  [gameId, personalPlayerId],
  () => {
    cleanupPlayerSub()
    const gid = gameId.value
    const pid = personalPlayerId.value
    aliveForCinema.value = 0
    gotPrimaryOv.value = false

    if (pid) {
      players.value = []
      singlePlayer.value = null
      unsubscribe = subscribeToCharacter(gid, pid, (data) => {
        singlePlayer.value = data ? { id: pid, ...data } : null
        gotPrimaryOv.value = true
      })
      unsubPlayersCount = subscribeToPlayers(gid, (list) => {
        aliveForCinema.value = list.filter((p) => p.eliminated !== true).length
      })
    } else {
      singlePlayer.value = null
      unsubscribe = subscribeToPlayers(gid, (list) => {
        players.value = list
        gotPrimaryOv.value = true
      })
    }
  },
  { immediate: true },
)

const overlayPageReady = computed(() => gotGameRoomOv.value && gotPrimaryOv.value)

const volumeByIdentity = ref({})

const { mediaVolumeForPlayer, setMediaVolumeForPlayer } = useOverlayVolumeBindings(volumeByIdentity)

const ms = useEatOverlayMediasoup({
  gameId,
  overlayReady: overlayPageReady,
  canPublish: overlayCanPublish,
  identity: overlayPeerId,
  displayName: overlayDisplayName,
  playerLabels: overlayPlayerLabels,
})

provide('eatOverlayVoiceUi', ms.voiceUi)

const mediaLayerEnabled = computed(() => mediasoupSignalingAvailable())

const { speakingIdentities, mediaTileForPlayer } = useOverlayMediaTileMap(
  ms.orderTilesRef,
  ms.tileMapRef,
  mediaLayerEnabled,
)

const { defaultOrderedPlayers: defaultOrderedPlayersForGlobalMosaic } = useOverlayMosaicOrder(
  players,
  speakingIdentities,
)

const {
  playersDisplayOrdered: playersDisplayOrderedForGlobalMosaic,
  mosaicDragSourceId,
  mosaicDropTargetId,
  onMosaicDragStart,
  onMosaicDragEnd,
  onMosaicDragOver,
  onMosaicDragEnterPlayer,
  onMosaicDrop,
} = useMosaicPlayerOrder(gameId, defaultOrderedPlayersForGlobalMosaic)

const { speakerTimeLeft, speakerTimerTotal } = useOverlaySpeakerCountdown(gameRoom, gameId)

/** Банер лише при зміні раунду в кімнаті (не прив’язано до фази) */
const roundBannerVisible = ref(false)
let roundBannerTimer = null
const lastSeenRoundBanner = ref(null)

watch(
  roomRound,
  (r) => {
    if (lastSeenRoundBanner.value === null) {
      lastSeenRoundBanner.value = r
      return
    }
    if (r === lastSeenRoundBanner.value) return
    lastSeenRoundBanner.value = r
    if (roundBannerTimer) clearTimeout(roundBannerTimer)
    roundBannerVisible.value = true
    roundBannerTimer = setTimeout(() => {
      roundBannerVisible.value = false
    }, 1000)
  },
  { immediate: true, flush: 'post' },
)

const { dramaMode, dramaPersonal, overlayDrama, globalStatusLine } = useOverlayUiState({
  isPersonal,
  players,
  aliveForCinema,
  aliveInGame,
  gamePhase,
  roomRound,
  t,
  te,
})

function isHandRaised(p) {
  return handsMap.value[String(p.id)] === true
}

const personalHasVotedThisRound = computed(() => {
  const pid = personalPlayerId.value
  if (!pid) return false
  return votes.value.some((v) => v.id === pid && Number(v.round) === roomRound.value)
})

const personalIsVoteTarget = computed(
  () =>
    votingActive.value &&
    personalPlayerId.value != null &&
    votingTargetId.value === personalPlayerId.value,
)

const personalVoteBannerVisible = computed(
  () =>
    isPersonal.value &&
    votingActive.value &&
    Boolean(votingTargetId.value) &&
    singlePlayer.value != null,
)

const personalOverlayVoteTally = computed(() => {
  const t = votingTargetId.value
  if (!t) return { for: 0, against: 0 }
  let forC = 0
  let ag = 0
  for (const v of votes.value) {
    if (Number(v.round) !== roomRound.value) continue
    if (String(v.targetPlayer) !== t) continue
    if (v.choice === 'against') ag++
    else forC++
  }
  return { for: forC, against: ag }
})

const votesThisRoundCount = computed(
  () => votes.value.filter((v) => Number(v.round) === roomRound.value).length,
)

const showAllVotedBanner = computed(() => {
  if (!votingActive.value) return false
  if (isPersonal.value) {
    return aliveForCinema.value > 0 && votesThisRoundCount.value === aliveForCinema.value
  }
  return aliveInGame.value > 0 && votesThisRoundCount.value === aliveInGame.value
})

const handsRaisedAliveCount = computed(() => {
  if (isPersonal.value) return 0
  return players.value.filter((p) => p.eliminated !== true && isHandRaised(p)).length
})

const handsClusterMode = computed(() => handsRaisedAliveCount.value > 3)
const handsClusterExtra = computed(() => Math.max(0, handsRaisedAliveCount.value - 3))

const overlayRoundPulse = ref(false)
let overlayRoundTimer = null

watch(roomRound, (r, prev) => {
  if (prev === undefined || prev === r) return
  overlayRoundPulse.value = true
  if (overlayRoundTimer) clearTimeout(overlayRoundTimer)
  overlayRoundTimer = setTimeout(() => {
    overlayRoundPulse.value = false
  }, 260)
})

/** Персональний оверлей: тихий стан «ніхто не говорить» (не під час голосування). */
const showIdleWaitingCue = computed(
  () =>
    isPersonal.value &&
    !speakerForTimerId.value &&
    !votingActive.value &&
    singlePlayer.value != null &&
    singlePlayer.value.eliminated !== true,
)

const { slotNumFromId, soloCardViewModel, globalMosaicCardViewModels } = useOverlayCardViewModels({
  gameId,
  nominationsRoomSlice,
  handsMap,
  votes,
  roomRound,
  singlePlayer,
  activeSpotlightId,
  speakerForTimerId,
  speakerTimeLeft,
  speakerTimerTotal,
  cinemaGrid,
  cinemaHud,
  dramaMode,
  dramaPersonal,
  votingActive,
  votingTargetId,
  nominatedPlayerId,
  nominatedById,
  personalHasVotedThisRound,
  personalIsVoteTarget,
  showIdleWaitingCue,
  handsClusterMode,
  isHandRaised,
  playersDisplayOrderedForGlobalMosaic,
  mediaTileForPlayer,
  mediaVolumeForPlayer,
})

onUnmounted(() => {
  cleanupPlayerSub()
  cleanupGameRoom()
  cleanupVotesSub()
  if (overlayRoundTimer) clearTimeout(overlayRoundTimer)
  if (roundBannerTimer) clearTimeout(roundBannerTimer)
})
</script>

<template>
  <div class="overlay-page">
    <OverlayVideoLayer
      :overlay-ready="overlayPageReady"
      :can-publish="overlayCanPublish"
      :spectator-mode="!isPersonal"
      :speaker-slot="speakerForTimerId ?? ''"
      :spotlight-unmute-mode="lkSpotlightUnmute"
      :eliminated-local="overlayEliminatedLocal"
      :local-identity="overlayPeerId"
    />
    <OverlayUiLayer
      :media-layer-enabled="mediaLayerEnabled"
      :overlay-page-ready="overlayPageReady"
      :is-personal="isPersonal"
      :overlay-drama="overlayDrama"
      :overlay-paused="overlayPaused"
      :overlay-round-pulse="overlayRoundPulse"
      :show-all-voted-banner="showAllVotedBanner"
      :hands-cluster-mode="handsClusterMode"
      :hands-cluster-extra="handsClusterExtra"
      :round-banner-visible="roundBannerVisible"
      :room-round="roomRound"
      :players="players"
      :game-id="gameId"
      :global-status-line="globalStatusLine"
      :overlay-token-gate-blocks="overlayTokenGateBlocks"
      :personal-player-id="personalPlayerId ?? ''"
      :single-player="singlePlayer"
      :personal-vote-banner-visible="personalVoteBannerVisible"
      :voting-target-id="votingTargetId"
      :slot-num-from-id-fn="slotNumFromId"
      :personal-is-vote-target="personalIsVoteTarget"
      :personal-overlay-vote-tally="personalOverlayVoteTally"
      :solo-card-view-model="soloCardViewModel"
      :media-tile-for-player="mediaTileForPlayer"
      :media-volume-for-player="mediaVolumeForPlayer"
      :set-media-volume-for-player="setMediaVolumeForPlayer"
      :global-mosaic-card-view-models="globalMosaicCardViewModels"
      :mosaic-drag-source-id="mosaicDragSourceId"
      :mosaic-drop-target-id="mosaicDropTargetId"
      :on-mosaic-drag-start="onMosaicDragStart"
      :on-mosaic-drag-end="onMosaicDragEnd"
      :on-mosaic-drag-over="onMosaicDragOver"
      :on-mosaic-drag-enter-player="onMosaicDragEnterPlayer"
      :on-mosaic-drop="onMosaicDrop"
    />
  </div>
</template>

<style scoped>
.overlay-page {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}
</style>
