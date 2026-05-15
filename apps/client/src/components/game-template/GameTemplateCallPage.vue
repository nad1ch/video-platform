<script setup lang="ts">
/**
 * GameTemplateCallPage — fork of `components/call/CallPage.vue` for the
 * `/app/game-template` route. The file was originally cut byte-faithful
 * from CallPage; Phase 3C migrated it off the Mafia runtime to the
 * generic GameRoom client layer, and Phase 4A cleaned up local naming
 * left over from the migration.
 *
 * Current runtime wiring on this file:
 *   - signaling room prefix: `gameroom:<base>` via `useGameRoomMediaRoom`.
 *   - WS protocol: `GameRoomWs.*` (`@/composables/gameRoomWsProtocol`).
 *   - host signaling: `useGameRoomHostSignaling` (no Mafia inbound parsers).
 *   - audio mix:      `useGameRoomAudioMixSignaling`.
 *   - tile-click host UI: `useGameRoomCallHostUi` (swap + speaking only,
 *     no Mafia night-action branch).
 *   - game store:    `useGameTemplateGameStore` (no roles, no night
 *     actions, no old/new mode, no background galleries).
 *   - players store: `useGameTemplatePlayersStore`.
 *   - view mode:     `useGameRoomViewMode` (gated on
 *     `route.name === 'game-template'`).
 *
 * Shared infrastructure deliberately kept:
 *   - `useCallOrchestrator` from call-core (mediasoup + media SSOT).
 *   - `ParticipantTile.vue` is consumed via its neutral `game-*` prop /
 *     emit aliases (`game-seat-index`, `game-life-state`,
 *     `@game-toggle-life`, etc.). The component still exposes its
 *     legacy `mafia-*` API in parallel for production Mafia; the alias
 *     pair resolves to the same internal state.
 *   - Stylesheet: `<style src="@/components/call/CallPage.css">`. Mafia
 *     and Game Template share the same class names (`call-page__*`,
 *     `mafia-vote-hud*`, `mafia-host-mode-*`); renaming those classes
 *     is the same coordinated future phase.
 *
 * Phase 4B stripped the EatFirst dead-code branches inherited from the
 * original CallPage byte-faithful fork (trait/action-card/slot-claim
 * helpers, EatFirst-only watchers, the `<EatFirstHostActionsBar>` /
 * `<EatFirstSpeakingQueueBar>` mounts, the `route.name === 'eat'`
 * disjuncts in `isCallAppRoute` / `switchToRoom` / route watcher /
 * `qSignaling` ternary). EatFirst logic still lives in its own
 * `apps/client/src/eat-first/**` tree and on `/app/eat`, untouched.
 */
import { storeToRefs } from 'pinia'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { CallEngineRole } from 'call-core'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  getAudioAnalysisAudioContext,
  normalizeDisplayName,
  useCallOrchestrator,
  VIDEO_QUALITY_PRESETS,
  type InboundVideoDebugRow,
  type VideoQualityPreset,
} from 'call-core'
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual'
import { useAuth } from '@/composables/useAuth'
import { createLogger } from '@/utils/logger'
import { saveCallTileLocalDisplayOverrides } from '@/utils/callTileLocalDisplayNames'
import { resolveHostPeerIdForGrid, sortPeerIdsHostLast } from '@/components/call/callTileOrderRules'

const callPageLog = createLogger('call-page')
import ParticipantTile from '@/components/call/ParticipantTile.vue'
import MediaDiagnosticsPanel from '@/components/call/MediaDiagnosticsPanel.vue'
import { isMediaDebugEnabled } from '@/utils/mediaDebugRuntime'
import { useMediaStallRecovery } from '@/components/call/useMediaStallRecovery'
import CallRoomPopover from '@/components/call/CallRoomPopover.vue'
import CallControlsDock from '@/components/call/CallControlsDock.vue'
import CallChatPanel from '@/components/call/CallChatPanel.vue'
import { useCallChatPanel } from '@/components/call/useCallChatPanel'
import { GAP, useCallTileLayoutFlip } from '@/composables/game-room/useCallTileLayoutFlip'
import {
  SPOTLIGHT_STRIP_VISIBLE_LIMIT,
  useCallSpotlightLayout,
} from '@/composables/game-room/useCallSpotlightLayout'
import { useFullPowerMode } from '@/composables/game-room/useFullPowerMode'
import { useCallMediaDebugTaps } from '@/composables/game-room/useCallMediaDebugTaps'
import { useCallPresenceToasts } from '@/composables/game-room/useCallPresenceToasts'
import { useCallDevicePickers } from '@/composables/game-room/useCallDevicePickers'
import { useRemoteTileBudget } from '@/composables/game-room/useRemoteTileBudget'
import { useCallRoomCodeChip } from '@/composables/game-room/useCallRoomCodeChip'
import { useCallDisplayNames } from '@/composables/game-room/useCallDisplayNames'
import { useCallChatInboundToasts } from '@/composables/game-room/useCallChatInboundToasts'
import { useCallTileOrdering } from '@/composables/game-room/useCallTileOrdering'
import { useCallRouteHtmlClass } from '@/composables/game-room/useCallRouteHtmlClass'
import { useCallToastEventListeners } from '@/composables/game-room/useCallToastEventListeners'
import { useCallPageBootstrap } from '@/composables/game-room/useCallPageBootstrap'
import GameRoomCallBottomCluster from '@/components/game-room/GameRoomCallBottomCluster.vue'
import GameRoomCallPresenceToastsPanel from '@/components/game-room/GameRoomCallPresenceToastsPanel.vue'
import GameRoomCallChatInboundToastsPanel from '@/components/game-room/GameRoomCallChatInboundToastsPanel.vue'
import GameRoomCallDebugOverlay from '@/components/game-room/GameRoomCallDebugOverlay.vue'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import tilePinIcon from '@/assets/mafia/ui/tile-pin.svg'
import { generateCallRoomCode } from '@/utils/callRoomUi'
import { useCallRoomHeaderJoinStore } from '@/stores/callRoomHeaderJoin'
import { useGameRoomHostSignaling } from '@/composables/useGameRoomHostSignaling'
import { useGameRoomCallHostUi } from '@/composables/useGameRoomCallHostUi'
import {
  gameRoomBaseRoomIdFromSignaling,
  gameRoomSignalingRoomId,
  GAME_ROOM_SIGNALING_ROOM_PREFIX,
} from '@/composables/useGameRoomMediaRoom'
// GameTemplate fork: mounts the GameTemplate adapters that wrap the
// shared `GameHostActionsBar` / `GameSpeakingQueueBar` presentational
// primitives under `components/game-call/`. (Mafia mounts its own
// parallel adapters from `components/mafia/`; both stacks share the
// same shared primitives.)
import GameTemplateSpeakingQueueBar from '@/components/game-template/GameTemplateSpeakingQueueBar.vue'
import GameTemplateHostActionsBar from '@/components/game-template/GameTemplateHostActionsBar.vue'
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame'
import { useGameTemplatePlayersStore } from '@/stores/gameTemplatePlayers'
// `mafiaEliminationAvatarKindForPeerId` is intentionally not imported —
// the Mafia-specific elimination avatar variant has no generic equivalent.
// ParticipantTile receives `undefined` for `game-elimination-kind` on
// the game-template route, which renders the default tile chrome.
import { GAME_ROOM_OBS_URL_TOAST_EVENT, GAME_ROOM_SETTINGS_TOAST_EVENT } from '@/composables/gameRoomStreamViewRoute'
import { GameRoomWs } from '@/composables/gameRoomWsProtocol'
import { useGameRoomAudioMixSignaling } from '@/composables/useGameRoomAudioMixSignaling'
import tilePinActiveIcon from '@/assets/mafia/ui/tile-pin-active.svg'

type VideoQualityUiChoice = 'auto' | VideoQualityPreset

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, ensureAuthLoaded, isAdmin } = useAuth()

/**
 * GameTemplate fork: this file is only mounted on `/app/game-template`.
 * `isGameRoomRoute` is the single route predicate every downstream
 * branch checks; the WS protocol (`gameroom:*`) and signaling room
 * prefix (`gameroom:<base>`) are owned by the generic GameRoom client
 * layer — see this file's top-of-script docblock.
 *
 * `isCallAppRoute` is kept as an alias of `isGameRoomRoute` because
 * several call-shell side effects (HTML class toggle, route-watch
 * room-code generation, normalize-session-room-id, chat panel inbound
 * toasts) historically guarded on a generic "in a call-app route"
 * boolean and we keep the same name to minimize the diff inside those
 * branches.
 */
const isGameRoomRoute = computed(() => route.name === 'game-template')
const isCallAppRoute = isGameRoomRoute

const props = withDefaults(
  defineProps<{
    gameRoomStreamView?: boolean
  }>(),
  { gameRoomStreamView: false },
)

const gameRoomViewUi = computed(() => isGameRoomRoute.value && props.gameRoomStreamView)

/**
 * HTML5 drag-and-drop tile reorder is intentionally disabled inside Game
 * Template (host uses the swap-mode click flow); the drag affordance and
 * its "Drag to reorder" tooltip must stay in lock-step. Bind
 * `:draggable`, `:title`, and `:aria-label` to this single computed so a
 * future change to the gate is impossible to apply to just one of them.
 */
const canReorderTiles = computed(
  () => !gameRoomViewUi.value && !isGameRoomRoute.value,
)

/**
 * Game Template `?mode=view`: recv-only in call-core — no camera/mic publish
 * (`wireCallMediaAfterRoomState` skips send transport for `viewer`).
 */
const callEngineRole = computed((): CallEngineRole =>
  gameRoomViewUi.value ? 'viewer' : 'participant',
)

// `sa-call-route` <html> class toggle + onUnmounted cleanup — Block 27.
useCallRouteHtmlClass(isCallAppRoute)


const allowManualVideoQuality = computed(() => isAdmin.value)

/** Sent with `join-room` and used as local tile `avatarUrl` SSOT (same URL remotes receive via roster). */
const joinAvatarUrl = computed(() => {
  const a = user.value?.avatar
  return typeof a === 'string' && a.trim().length > 0 ? a.trim() : undefined
})
const joinUserId = computed(() => {
  const id = user.value?.id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : undefined
})


const showCallDebugControls = computed(() => isAdmin.value || import.meta.env.DEV)

const {
  session,
  joining,
  joinError,
  joinCall,
  leaveCall,
  tiles,
  sizeTier,
  activeSpeakerPeerId,
  localAudioSourceStream,
  micEnabled,
  camEnabled,
  callDeafened,
  toggleMic,
  toggleCam,
  toggleCallDeafen,
  audioInputDevices,
  videoInputDevices,
  audioOutputDevices,
  refreshMediaDevices,
  localAudioInputDeviceId,
  localVideoInputDeviceId,
  setCallAudioInputDevice,
  setCallVideoInputDevice,
  wsStatus,
  callDebugSnapshot,
  refreshInboundVideoDebugStats,
  callPresenceMessages,
  setRemoteListenVolume,
  setRemoteListenMuted,
  callChatMessages,
  sendChatMessage,
  handRaised,
  toggleRaiseHand,
  screenSharing,
  toggleScreenShare,
  sendSignalingMessage,
  subscribeSignalingMessage,
  receiveDeviceProfile,
  serverActiveSpeakerPeerId,
  playbackRenderFpsPressureByPeerId,
  setPeerVisible,
  requestForcedProducerResync,
  requestHardProducerResync,
} = useCallOrchestrator({ allowManualVideoQuality, joinAvatarUrl, joinUserId, role: callEngineRole })

/** Dev-only: gate for the floating `<MediaDiagnosticsPanel>` and the `__MEDIA_DEBUG__` console helpers. */
const mediaDebugPanelEnabled = isMediaDebugEnabled()

/**
 * OBS / `?mode=view` safety gate. Read by `useMediaStallRecovery` to skip the
 * hard producer resync (which would broadcast a synchronous all-cameras
 * flicker to stream viewers) and by anything else that needs to know whether
 * this CallPage instance is acting as a public OBS source rather than a
 * normal participant.
 */
function isOperatingAsObsViewSource(): boolean {
  return gameRoomViewUi.value
}

const {
  remotePlaybackWaitingPeerIds,
  onRemotePlaybackStall,
  onTileVideoStall,
  onTileAudioStall,
} = useMediaStallRecovery({
  tiles,
  isOperatingAsObsViewSource,
  requestForcedProducerResync,
  requestHardProducerResync,
})

/**
 * Global health for **playback budget / full-power** only (strong profile).
 * Not used for per-tile FPS — one struggling remote must not throttle everyone else.
 */
const isSystemHealthy = computed(() => {
  if (remotePlaybackWaitingPeerIds.value.size > 0) {
    return false
  }
  for (const p of playbackRenderFpsPressureByPeerId.value.values()) {
    if (p !== 'good') {
      return false
    }
  }
  return true
})





const { isFullPowerMode } = useFullPowerMode({
  isSystemHealthy,
  receiveDeviceProfile,
})

if (import.meta.env.DEV) {
  watch(
    callEngineRole,
    (role) => {
      callPageLog.info('[call-qa:role] callEngineRole', {
        role,
        gameRoomViewUi: gameRoomViewUi.value,
        routeName: route.name,
        isGameRoomRoute: isGameRoomRoute.value,
      })
    },
    { immediate: true },
  )
}

useGameRoomHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus)

// Diagnostics-only WS / signaling counters + probes + env-info stamp +
// optional `__MEDIA_DEBUG__` global install live in `useCallMediaDebugTaps`
// (Block 24). The env-info payload is route-specific (Game Template
// stamps `isGameRoomView`) and is supplied as a thunk; the shared
// `mediaDebugRuntime` reader ORs that key into the `isViewMode` summary.
useCallMediaDebugTaps({
  wsStatus,
  subscribeSignalingMessage,
  requestForcedProducerResync,
  envInfo: () => ({
    isGameRoomView: gameRoomViewUi.value,
  }),
})

const { selfPeerId, selfDisplayName, remoteDisplayNames } = storeToRefs(session)

const GAME_ROOM_FORCE_CAMERA_OFF_SIGNAL = GameRoomWs.forceCameraOff
const GAME_ROOM_FORCE_MUTE_ALL_SIGNAL = GameRoomWs.forceMuteAll

function gameRoomSignalPayload(data: unknown, type: string): Record<string, unknown> | null {
  if (data == null || typeof data !== 'object') {
    return null
  }
  const rec = data as { type?: unknown; payload?: unknown }
  if (rec.type !== type || rec.payload == null || typeof rec.payload !== 'object') {
    return null
  }
  return rec.payload as Record<string, unknown>
}

const offGameRoomForceControls = subscribeSignalingMessage((data) => {
  if (!isGameRoomRoute.value) {
    return
  }
  const nickPayload = gameRoomSignalPayload(data, GameRoomWs.playerNicknameUpdate)
  if (nickPayload != null) {
    const peerId = typeof nickPayload.peerId === 'string' ? nickPayload.peerId.trim() : ''
    if (!peerId) {
      return
    }
    const displayName = typeof nickPayload.displayName === 'string' ? nickPayload.displayName.trim().slice(0, 64) : ''
    const next = { ...nicknameOverrideByPeerId.value }
    if (!displayName) {
      delete next[peerId]
    } else {
      next[peerId] = displayName
    }
    nicknameOverrideByPeerId.value = next
    // Ensure an older local-only rename doesn't shadow the server-synced nickname.
    if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, peerId)) {
      const cleaned = { ...localTileDisplayOverrides.value }
      delete cleaned[peerId]
      localTileDisplayOverrides.value = cleaned
      saveCallTileLocalDisplayOverrides(cleaned)
    }
    return
  }
  const mutePayload = gameRoomSignalPayload(data, GAME_ROOM_FORCE_MUTE_ALL_SIGNAL)
  if (mutePayload != null) {
    if (gameStore.isGameRoomHost) {
      return
    }
    const muted = mutePayload.muted !== false
    if (muted && micEnabled.value) {
      void toggleMic()
    } else if (!muted && !micEnabled.value) {
      void toggleMic()
    }
    return
  }
  const cameraPayload = gameRoomSignalPayload(data, GAME_ROOM_FORCE_CAMERA_OFF_SIGNAL)
  const peerId = cameraPayload?.peerId
  if (typeof peerId === 'string' && peerId === selfPeerId.value && camEnabled.value) {
    void toggleCam()
  }
  // Per-peer game-room mic-force (server-emitted side effect of kick/revive
  // via `gameroom:force-peer-mic`). `muted: true` flips the local mic UI off
  // through the existing call-core `toggleMic` action so the killed peer
  // stops trying to talk into a server-paused producer. `muted: false` is a
  // UI hint clear only — we do NOT auto-unmute the user; they unmute
  // manually after revive.
  const forcePeerMicPayload = gameRoomSignalPayload(data, GameRoomWs.forcePeerMic)
  if (forcePeerMicPayload != null) {
    const targetPeerId = forcePeerMicPayload.peerId
    const muted = forcePeerMicPayload.muted === true
    if (
      typeof targetPeerId === 'string'
      && targetPeerId === selfPeerId.value
      && muted
      && micEnabled.value
    ) {
      void toggleMic()
    }
  }
})

onBeforeUnmount(offGameRoomForceControls)

/**
 * Per-peer effective audio-muted tracking for the host's "mute all" button
 * visual state. Server's `peer-audio-muted` already encodes effective mute
 * (`audioMuted || forcedAudioMuted`); the room-state snapshot at join
 * carries the same data per peer. Both flow into the store's
 * `peerEffectiveMutedByPeerId`, which `GameTemplateHostActionsBar` reduces
 * against `nonHostPeerIds` for the visual.
 *
 * Gated on `isGameRoomRoute` so non-game-room rooms never write to the
 * generic game-room store.
 */
const offGameRoomPeerAudioMuted = subscribeSignalingMessage((data) => {
  if (!isGameRoomRoute.value) {
    return
  }
  if (data == null || typeof data !== 'object') {
    return
  }
  const rec = data as { type?: unknown; payload?: unknown }
  if (rec.type === 'room-state') {
    const peers = (rec.payload as { peers?: unknown } | undefined)?.peers
    if (!Array.isArray(peers)) {
      return
    }
    const snapshot: Record<string, boolean> = {}
    for (const p of peers) {
      if (p == null || typeof p !== 'object') continue
      const pid = (p as { peerId?: unknown }).peerId
      const muted = (p as { audioMuted?: unknown }).audioMuted
      if (typeof pid === 'string' && pid.length > 0 && muted === true) {
        snapshot[pid] = true
      }
    }
    gameStore.replacePeerEffectiveMutedSnapshot(snapshot)
    return
  }
  if (rec.type === 'peer-audio-muted') {
    const p = rec.payload
    if (p == null || typeof p !== 'object') return
    const pid = (p as { peerId?: unknown }).peerId
    const muted = (p as { muted?: unknown }).muted
    if (typeof pid !== 'string' || pid.length === 0) return
    gameStore.setPeerEffectiveMuted(pid, muted === true)
    return
  }
  if (rec.type === 'peer-left') {
    const p = rec.payload
    if (p == null || typeof p !== 'object') return
    const pid = (p as { peerId?: unknown }).peerId
    if (typeof pid !== 'string' || pid.length === 0) return
    gameStore.clearPeerEffectiveMuted(pid)
  }
})

onBeforeUnmount(offGameRoomPeerAudioMuted)

/**
 * Toggling Game Template `?mode=view` (header / router) flips `callEngineRole` only after a new wire; re-join
 * so OBS drops any existing send transport from a prior participant session in the same tab.
 */
watch(
  gameRoomViewUi,
  (v, oldV) => {
    if (!isGameRoomRoute.value) {
      return
    }
    if (v === oldV) {
      return
    }
    if (!session.inCall) {
      return
    }
    if (joining.value) {
      return
    }
    void (async () => {
      await leaveCall()
      await joinCall()
    })()
  },
)

// `nicknameOverrideByPeerId` is page-owned because the Game Template
// `playerNicknameUpdate` WS handler above also writes to it from outside
// the composable. `useCallDisplayNames` consumes it via
// `policy.nicknameOverrides`.
const nicknameOverrideByPeerId = shallowRef<Record<string, string>>({})

// `participantsByPeerId`, `displayNameUiByPeerId`, `localTileDisplayOverrides`,
// `canEditTileDisplayName`, `onCommitLocalTileDisplayName`, `peerDisplayName`,
// and `peerAvatarFallbackName` live in `useCallDisplayNames` (Block 25). The
// composable call itself is below — it depends on `gameStore.isGameRoomHost`,
// so the call is placed after that store is instantiated.

/** Stable handlers so grid re-renders do not allocate new fns per tile per frame. */
const remoteListenVolumeByPeer = new Map<string, (v: number) => void>()
const remoteListenMutedByPeer = new Map<string, (v: boolean) => void>()

/**
 * Deferred slot: assigned by `useGameRoomAudioMixSignaling` further down
 * the setup script (it depends on `gameStore` which is initialized later).
 * Handlers below reference the slot lazily so the host's slider/mute
 * toggle also fans out a `gameroom:audio-mix-update` to the room (OBS
 * view applies it). No-op for non-host or non-game-room routes.
 */
const audioMixBroadcasterSlot: { broadcast: ((delta: { peerId: string; volume: number; muted: boolean }) => void) | null } = {
  broadcast: null,
}

function broadcastGameRoomAudioMixDeltaForTile(peerId: string, volume: number, muted: boolean): void {
  audioMixBroadcasterSlot.broadcast?.({ peerId, volume, muted })
}

function readTileMutedForPeer(peerId: string): boolean {
  const t = tiles.value.find((row) => !row.isLocal && row.peerId === peerId)
  return Boolean(t?.remoteListenMuted)
}

function readTileVolumeForPeer(peerId: string): number {
  const t = tiles.value.find((row) => !row.isLocal && row.peerId === peerId)
  const raw = Number(t?.remoteListenVolume ?? 1)
  return Number.isFinite(raw) ? Math.min(2, Math.max(0, raw)) : 1
}

function remoteListenVolumeHandler(peerId: string) {
  let h = remoteListenVolumeByPeer.get(peerId)
  if (!h) {
    h = (v: number) => {
      setRemoteListenVolume(peerId, v)
      // Read companion (muted) AFTER apply so the broadcast carries the
      // engine-resolved entry — `setRemoteListenVolume` does not change muted.
      broadcastGameRoomAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId))
    }
    remoteListenVolumeByPeer.set(peerId, h)
  }
  return h
}

function remoteListenMutedHandler(peerId: string) {
  let h = remoteListenMutedByPeer.get(peerId)
  if (!h) {
    h = (v: boolean) => {
      setRemoteListenMuted(peerId, v)
      // Engine may bump volume from 0 → nz on unmute; reading after apply
      // mirrors what the host's UI now shows so OBS sees the same state.
      broadcastGameRoomAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId))
    }
    remoteListenMutedByPeer.set(peerId, h)
  }
  return h
}


// Remote-tile playback budget — viewport-visible map, server-side
// `setPeerVisible` debounce, per-peer suppression state, suppression
// watcher, and the page-facing `videoPlaybackSuppressedForPeer` /
// `remoteVideoTargetPlaybackFpsForPeer` / `onCallTileViewportForLayers`
// — live in `useRemoteTileBudget` (Block 24). The tile-set-change
// watcher below still owns the non-budget prunes (display-name overrides,
// listen-volume / listen-muted maps); it delegates its budget prunes to
// the composable's `cleanupForRemovedPeers` helper.
const {
  videoPlaybackSuppressedForPeer,
  remoteVideoTargetPlaybackFpsForPeer,
  onCallTileViewportForLayers,
  cleanupForRemovedPeers: cleanupBudgetForRemovedPeers,
} = useRemoteTileBudget({
  tiles,
  selfPeerId,
  receiveDeviceProfile,
  setPeerVisible,
  activeSpeakerPeerId,
  serverActiveSpeakerPeerId,
  isFullPowerMode,
  isCallAppRoute,
  log: callPageLog,
})

watch(
  () => tiles.value.map((t) => t.peerId).join(),
  () => {
    const ids = new Set(tiles.value.map((t) => t.peerId))
    for (const id of remoteListenVolumeByPeer.keys()) {
      if (!ids.has(id)) remoteListenVolumeByPeer.delete(id)
    }
    for (const id of remoteListenMutedByPeer.keys()) {
      if (!ids.has(id)) remoteListenMutedByPeer.delete(id)
    }
    // Budget prunes (viewport map, suppress-delay timers, peer-visible
    // hide timers + last-sent map) are delegated to `useRemoteTileBudget`.
    cleanupBudgetForRemovedPeers(ids)
    const o = localTileDisplayOverrides.value
    let next: Record<string, string> | null = null
    for (const k of Object.keys(o)) {
      if (!ids.has(k)) {
        if (!next) {
          next = { ...o }
        }
        delete next[k]
      }
    }
    if (next) {
      localTileDisplayOverrides.value = next
      saveCallTileLocalDisplayOverrides(next)
    }
  },
)

const videoQualityChoice = computed({
  get(): VideoQualityUiChoice {
    return session.videoQualityExplicit ? session.videoQualityPreset : 'auto'
  },
  set(v: VideoQualityUiChoice) {
    if (v === 'auto') {
      session.setVideoQualityImplicitDefault()
    } else {
      session.setVideoQualityPreset(v)
    }
  },
})

const callDebugOverlay = computed({
  get: () => session.callDebugOverlay,
  set: (v: boolean) => session.setCallDebugOverlay(v),
})

const qualityPresets = VIDEO_QUALITY_PRESETS

const inboundDebugRows = ref<InboundVideoDebugRow[]>([])
const inboundDebugBusy = ref(false)

// `callToasts` stack + `pushCallToast` + presence-toast watcher are owned
// by `useCallPresenceToasts` (Block 24). The route-specific OBS / Settings
// toast handlers below still push into `callToasts.value` directly because
// their `id` prefix (`gameroom-obs-…`, `gameroom-settings-…`) is the
// existing observable shape.
const { callToasts, pushCallToast } = useCallPresenceToasts({
  callPresenceMessages,
  t,
})

// Route-specific OBS / Settings toast event listeners — Block 27.
// Same composable both pages use; Game Template ships only two
// route-specific descriptors (no EatFirst gate here).
useCallToastEventListeners({
  callToasts,
  events: [
    {
      eventName: GAME_ROOM_OBS_URL_TOAST_EVENT,
      idPrefix: 'gameroom-obs',
      getText: () => t('gameRoom.obsViewUrlCopiedToast'),
    },
    {
      eventName: GAME_ROOM_SETTINGS_TOAST_EVENT,
      idPrefix: 'gameroom-settings',
      kind: 'leave',
      getText: (ev) =>
        ev instanceof CustomEvent && typeof ev.detail?.text === 'string'
          ? ev.detail.text
          : t('gameRoom.backgroundUploadFailed'),
    },
  ],
})

const {
  chatOpen,
  chatPanelClass,
  chatPanelStyle,
  onChatPanelDragPointerDown,
  onChatPanelResizePointerDown,
  stopChatPanelGesture,
  syncChatPanelToViewport,
} = useCallChatPanel({
  inCall: () => session.inCall,
  roomId: () => session.roomId,
})

// Chat inbound toast stack (queue, dismiss / open-chat helpers, inCall
// reset + chatOpen sync + messages watcher) lives in
// `useCallChatInboundToasts` (Block 25). Game Template's `isViewMode`
// is a single `gameRoomViewUi`.
const {
  callChatInboundToasts,
  dismissCallChatInboundToast,
  openChatFromInboundToast,
} = useCallChatInboundToasts({
  isInCall: computed(() => session.inCall),
  joining,
  isViewMode: gameRoomViewUi,
  callChatMessages,
  selfPeerId,
  chatOpen,
})

// Media-device picker open refs, audio-output LS persistence, sink-apply
// watcher, `provide(CALL_AUDIO_OUTPUT_DEVICE_ID_KEY, …)`, and the
// outside-click handler live in `useCallDevicePickers` (Block 24). The
// composable call itself is below — it depends on the `callRoomHeaderJoin`
// store, so the call is placed after that store is instantiated.
type CallControlsDockExpose = { containsDevicePickerTarget(target: Node): boolean }
const callControlsDockRef = ref<CallControlsDockExpose | null>(null)

// `roomJoinDraft`, `roomCopyFlash`, `copyRoomToClipboard`,
// `onGenerateNewRoom`, `submitRoomDraft`, and the popover-open sync
// watcher live in `useCallRoomCodeChip` (Block 25). The composable
// call itself is below — it depends on `displayCallOrGameRoomCode`
// and `switchToRoom`, both of which are page-specific.

const callAuthReady = ref(false)

const callRoomHeaderJoin = useCallRoomHeaderJoinStore()
const { roomPopoverOpen } = storeToRefs(callRoomHeaderJoin)

const {
  micPickerOpen,
  camPickerOpen,
  speakerPickerOpen,
  localAudioOutputDeviceId,
  showMediaDevicePickers,
  closeMediaDevicePickers,
  pickAudioInput,
  pickVideoInput,
  pickAudioOutput,
} = useCallDevicePickers({
  isInCall: computed(() => session.inCall),
  audioInputDevices,
  videoInputDevices,
  audioOutputDevices,
  setCallAudioInputDevice,
  setCallVideoInputDevice,
  callControlsDockRef,
  isRoomPopoverOpen: () => callRoomHeaderJoin.roomPopoverOpen,
  closeRoomPopover: () => callRoomHeaderJoin.closeRoomPopover(),
  log: callPageLog,
})

const playersStore = useGameTemplatePlayersStore()
const gameStore = useGameTemplateGameStore()
watch(
  joinUserId,
  (id) => {
    gameStore.setLocalUserId(id ?? null)
  },
  { immediate: true },
)

const { hostPeerId: hostPeerIdRef, isGameRoomHost: isGameRoomHostRef } = storeToRefs(gameStore)

const {
  localTileDisplayOverrides,
  canEditTileDisplayName,
  onCommitLocalTileDisplayName,
  peerDisplayName,
  peerAvatarFallbackName,
} = useCallDisplayNames({
  tiles,
  remoteDisplayNames,
  selfPeerId,
  selfDisplayName,
  policy: {
    isRouteActive: isGameRoomRoute,
    isHost: isGameRoomHostRef,
    nicknameOverrides: nicknameOverrideByPeerId,
    sendPlayerNameUpdate: (peerId, displayName) => {
      sendSignalingMessage({
        type: GameRoomWs.playerNameUpdate,
        payload: { targetPeerId: peerId, displayName },
      })
    },
  },
})

const { broadcastGameRoomAudioMixDelta } = useGameRoomAudioMixSignaling({
  sendSignalingMessage,
  subscribeSignalingMessage,
  wsStatus,
  isGameRoomRoute,
  isViewMode: gameRoomViewUi,
  isGameRoomHost: isGameRoomHostRef,
  hostPeerId: hostPeerIdRef,
  setRemoteListenVolume,
  setRemoteListenMuted,
})
audioMixBroadcasterSlot.broadcast = broadcastGameRoomAudioMixDelta


function displayCallOrGameRoomCode(): string {
  const raw = normalizeDisplayName(session.roomId) || 'demo'
  if (isGameRoomRoute.value) {
    return gameRoomBaseRoomIdFromSignaling(raw)
  }
  return raw
}

/**
 * Keep `session.roomId` consistent with the route: Game Template → `gameroom:<base>`.
 * If the stored room id carries the prefix on a non-game-room mount (defensive),
 * strip it back to the base form.
 */
function normalizeSessionRoomIdForStreamRoute(): void {
  if (!isCallAppRoute.value) {
    return
  }
  const s = normalizeDisplayName(session.roomId) || 'demo'
  if (isGameRoomRoute.value) {
    const desired = gameRoomSignalingRoomId(gameRoomBaseRoomIdFromSignaling(s))
    if (s !== desired) {
      session.roomId = desired
    }
    return
  }
  if (s.startsWith(GAME_ROOM_SIGNALING_ROOM_PREFIX)) {
    session.roomId = gameRoomBaseRoomIdFromSignaling(s)
  }
}

async function switchToRoom(nextRaw: string, opts?: { fromRoute?: boolean }): Promise<void> {
  const base = normalizeDisplayName(nextRaw) || 'demo'
  const signalingId = gameRoomSignalingRoomId(base)
  if (joining.value) {
    return
  }
  const cur = normalizeDisplayName(session.roomId) || 'demo'
  if (cur === signalingId && session.inCall) {
    callRoomHeaderJoin.closeRoomPopover()
    return
  }
  if (session.inCall) {
    leaveCall()
  }
  session.roomId = signalingId
  if (!opts?.fromRoute && isCallAppRoute.value) {
    try {
      await router.replace({ name: 'game-template', query: { ...route.query, room: base } })
    } catch {
      /* ignore */
    }
  }
  callRoomHeaderJoin.closeRoomPopover()
  await joinCall()
}

watch(
  () =>
    [
      route.name,
      typeof route.query.room === 'string' ? route.query.room : '',
      callAuthReady.value,
    ] as const,
  async () => {
    if (!callAuthReady.value || !isCallAppRoute.value) {
      return
    }
    normalizeSessionRoomIdForStreamRoute()
    const q = typeof route.query.room === 'string' ? normalizeDisplayName(route.query.room) : ''
    if (!q) {
      if (!session.inCall && !joining.value) {
        try {
          const code = generateCallRoomCode()
          await router.replace({
            name: 'game-template',
            query: { ...route.query, room: code },
          })
        } catch {
          /* ignore */
        }
      }
      return
    }
    const currentSignaling = normalizeDisplayName(session.roomId) || 'demo'
    const qSignaling = gameRoomSignalingRoomId(q)
    if (qSignaling !== currentSignaling) {
      await switchToRoom(q, { fromRoute: true })
      return
    }
    if (!session.inCall && !joining.value) {
      void joinCall()
    }
  },
  { immediate: true },
)

const {
  roomJoinDraft,
  roomCopyFlash,
  copyRoomToClipboard,
  onGenerateNewRoom,
  submitRoomDraft,
} = useCallRoomCodeChip({
  roomPopoverOpen,
  displayRoomCode: displayCallOrGameRoomCode,
  switchToRoom,
})

function retryJoinCall(): void {
  void joinCall()
}

async function refreshInboundDebug(): Promise<void> {
  inboundDebugBusy.value = true
  try {
    inboundDebugRows.value = await refreshInboundVideoDebugStats()
  } finally {
    inboundDebugBusy.value = false
  }
}

/** Local display order (peer ids); does not affect signaling / mediasoup. */
const tileOrder = ref<string[]>([])
const dragPeerId = ref<string | null>(null)
const dragOverPeerId = ref<string | null>(null)
const tileDragStartedFromControls = ref(false)
const pinnedPeerId = ref<string | null>(null)
watch(
  tiles,
  (list) => {
    const ids = list.map((t) => t.peerId)
    if (isGameRoomRoute.value) {
      const explicitHostId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : ''
      const prevDisplayOrder = gameStore.getDisplayNumberingOrder(tileOrder.value)
      const hostId = resolveHostPeerIdForGrid(explicitHostId, prevDisplayOrder)
      tileOrder.value = sortPeerIdsHostLast(ids, hostId)
      return
    }
    const prev = tileOrder.value
    const next: string[] = []
    for (const id of prev) {
      if (ids.includes(id)) {
        next.push(id)
      }
    }
    for (const id of ids) {
      if (!next.includes(id)) {
        next.push(id)
      }
    }
    tileOrder.value = next
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => tiles.value.map((t) => t.peerId),
  (ids) => {
    if (pinnedPeerId.value != null && !ids.includes(pinnedPeerId.value)) {
      pinnedPeerId.value = null
    }
  },
  { flush: 'pre' },
)

/**
 * Push the current non-host participant peerIds to the game-room store so
 * it can compute "every non-host effectively muted" for the host UI
 * button. The store filters out the host peerId internally.
 */
watch(
  () => [
    isGameRoomRoute.value,
    gameStore.hostPeerId,
    tiles.value.map((t) => t.peerId).join('|'),
  ],
  () => {
    if (!isGameRoomRoute.value) {
      gameStore.setNonHostPeerIds([])
      return
    }
    // Pass every tile peerId; the store filters the host peer internally.
    // This keeps the membership stable when host changes via transfer.
    gameStore.setNonHostPeerIds(tiles.value.map((t) => t.peerId))
  },
  { immediate: true, flush: 'post' },
)


const seatNumberByPeer = computed(() => {
  if (!isGameRoomRoute.value) {
    return new Map<string, number>()
  }
  const m = new Map<string, number>()
  const order = gameStore.getDisplayNumberingOrder(tileOrder.value)
  const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : ''
  const hostPeerId = resolveHostPeerIdForGrid(explicitHostPeerId, order)
  const numbered = hostPeerId.length > 0 ? order.filter((id) => id !== hostPeerId) : order
  numbered.forEach((id, i) => {
    m.set(id, i + 1)
  })
  return m
})

/**
 * Generic game-room call-host UI behaviour via `useGameRoomCallHostUi`.
 *
 * Owns the host-side handlers and the speaking-mode seat-highlight
 * computed, plus the generic tile-click router (swap + speaking branches
 * only — there is no night-action branch in the generic protocol).
 *
 * The OBS/host-claim flow, audio-mix host broadcast, and inbound
 * `gameroom:*` signaling live in `useGameRoomHostSignaling` and
 * `useGameRoomAudioMixSignaling`; this composable is strictly the
 * CallPage-level host-UI surface.
 */
const {
  isHostSpeakingNominationUiSeat,
  onToggleLifeFromTile,
  onForceCameraOffFromTile,
  onForceMuteAll,
  handleHostTileClick,
} = useGameRoomCallHostUi({
  isGameRoomRoute,
  viewUi: gameRoomViewUi,
  selfPeerId,
  gameStore,
  seatNumberByPeer,
  sendSignalingMessage,
  pushCallToast,
  t,
})

// Local-tile speaking ring source. Moved up so it can be consumed by
// `useCallTileOrdering` below (which owns `isTileRowSpeaking`).
const localTileSpeakingForWrap = useLocalTileSpeakingVisual(
  () => localAudioSourceStream.value,
  () => true,
  () => micEnabled.value,
)

// Tile ordering + row shaping + speaking check — Block 26.
// `orderedTiles` precedence: `hostLastPolicy` (Game Template route, host
// pinned last + extras fold) → fallback (`tileOrder` + spotlight pin).
// `getSpotlightActive` is taken as a thunk so the composable can be
// wired BEFORE `useCallSpotlightLayout` (which consumes `orderedTiles`).
const { orderedTiles, orderedGridRows, isTileRowSpeaking } = useCallTileOrdering({
  tiles,
  tileOrder,
  pinnedPeerId,
  getSpotlightActive: () => spotlightDesktop.value,
  peerDisplayName,
  localTileSpeaking: localTileSpeakingForWrap,
  activeSpeakerPeerId,
  serverActiveSpeakerPeerId,
  hostLastPolicy: {
    isActive: isGameRoomRoute,
    getDisplayNumberingOrder: (o) => gameStore.getDisplayNumberingOrder(o),
    getExplicitHostPeerId: () =>
      typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : '',
  },
})

const {
  spotlightDesktop,
  layoutMode,
  spotlightPeerId,
  spotlightStripPeerIds,
  spotlightOverflowCount,
  spotlightOverflowTileStyle,
  spotlightStripSlotForPeer,
  isSpotlightStripPeerHidden,
  togglePin,
} = useCallSpotlightLayout({ orderedTiles, pinnedPeerId })

const stageRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

const { stageSize, setTileWrapRef, getGrid } = useCallTileLayoutFlip({
  stageRef,
  gridRef,
  orderedTiles,
  layoutMode,
  spotlightPeerId,
  dragPeerId,
})

// Auth-load IIFE + ?callDebug parse + DEV-only __CALL_DEBUG__ global —
// Block 28. Page-owned `callAuthReady` is mutated by the composable.
useCallPageBootstrap({
  session,
  user,
  ensureAuthLoaded,
  stageSize,
  orderedTiles,
  callAuthReady,
})


if (import.meta.env.DEV) {
  watch(
    () => {
      const n = orderedTiles.value.length
      if (!n) {
        return null
      }
      const { cols, rows, tileWidth, tileHeight } = getGrid(n, stageSize.value.width, stageSize.value.height)
      return { n, cols, rows, tileWidth, tileHeight }
    },
    (v) => {
      if (!v) {
        return
      }
      if (v.n > 1 && v.cols === 1) {
        callPageLog.debug('call grid: unexpected single column layout', {
          ...v,
          stageW: stageSize.value.width,
          stageH: stageSize.value.height,
        })
      }
    },
    { flush: 'post' },
  )
}


// `orderedGridRows` + `isTileRowSpeaking` are part of `useCallTileOrdering`
// (Block 26). The single-source-of-truth speaking-ring rule (local tile
// via `useLocalTileSpeakingVisual`, remote tiles via `activeSpeakerPeerId`
// + `serverActiveSpeakerPeerId`) is preserved verbatim inside the composable.

function resumeCallAudioAnalysisFromGesture(): void {
  void getAudioAnalysisAudioContext().resume().catch(() => {})
}

/**
 * Tile-click router for `/app/game-template`. Delegates to
 * `useGameRoomCallHostUi.handleHostTileClick`, which owns the swap +
 * speaking branches. There is no other host-interaction mode on the
 * generic protocol.
 */
function onGameRoomHostTileClick(ev: MouseEvent, row: (typeof orderedGridRows.value)[number]): void {
  handleHostTileClick(ev, row)
}

function refreshGameRoomPlayersState(): void {
  if (!isGameRoomRoute.value) {
    playersStore.clearPlayerRowsForUi()
    // Phase 3C: the original Mafia branch also pruned `playerOverlayStateByPeerId`
    // for Eat First rooms — that bridge belonged to the Mafia store and has
    // no equivalent on the generic `useGameTemplateGameStore`. When the route
    // is not game-template we simply clear our own state.
    gameStore.clearWhenLeavingGameRoomRoute()
    return
  }
  if (gameStore.isApplyingGameRoomReshuffle) {
    const engine = tileOrder.value
    const order = gameStore.getDisplayNumberingOrder(engine)
    const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : ''
    const hostPeerId =
      explicitHostPeerId.length > 0
        ? explicitHostPeerId
        : order.length > 0
          ? order[order.length - 1] ?? ''
          : ''
    const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order
    playersStore.setPlayerRowsDisplay(
      playersOnly.map((peerId, i) => ({
        peerId,
        number: i + 1,
        displayName: peerDisplayName(peerId),
      })),
    )
    return
  }
  playersStore.syncWithPeers(session.roomId, tiles.value.map((t) => t.peerId))
  const engine = tileOrder.value
  gameStore.reconcileNumberingWithEngine(engine)
  gameStore.pruneGameStateToPeers(engine)
  const order = gameStore.getDisplayNumberingOrder(engine)
  const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : ''
  const hostPeerId =
    explicitHostPeerId.length > 0
      ? explicitHostPeerId
      : order.length > 0
        ? order[order.length - 1] ?? ''
        : ''
  const seatCount = hostPeerId.length > 0 && order.includes(hostPeerId) ? order.length - 1 : order.length
  // Phase 3C: `pruneNightActionsToMaxSeat` was Mafia-only (night-action
  // role grid) — dropped because the generic protocol has no roles.
  if (gameStore.isGameRoomHost) {
    gameStore.pruneSpeakingQueueToMaxSeat(seatCount)
  }
  const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order
  playersStore.setPlayerRowsDisplay(
    playersOnly.map((peerId, i) => ({
      peerId,
      number: i + 1,
      displayName: peerDisplayName(peerId),
    })),
  )
}

/**
 * Stable scalar key for `refreshGameRoomPlayersState`. Replaces the previous
 * `deep: true` watcher over `[tiles, orderedGridRows, speakingQueue]` which
 * fired on every audio-level / tile-reorder / speaker-change tick (3-5/s
 * in active discussion at 8-12 cameras) and re-ran the full reconcile pass
 * even when no peer-set / numbering / queue change had actually occurred.
 *
 * `refreshGameRoomPlayersState` only consumes:
 *   - peerIds from `tiles.value` (set membership)
 *   - `gameStore.numberingKey` (engine ordering)
 *   - `gameStore.speakingQueue` (length / contents)
 *   - `isApplyingGameRoomReshuffle` (branch selector)
 *
 * The function itself is idempotent so an extra run on an unrelated state
 * change would only waste CPU, not produce a wrong result.
 */
const playersWatcherKey = computed(() => {
  if (!isGameRoomRoute.value) {
    return `off|${session.roomId}`
  }
  const peerIds: string[] = []
  for (const t of tiles.value) {
    peerIds.push(t.peerId)
  }
  const queue = gameStore.speakingQueue.join(',')
  return [
    'on',
    session.roomId,
    peerIds.join('|'),
    gameStore.numberingKey,
    queue,
    gameStore.isApplyingGameRoomReshuffle ? '1' : '0',
  ].join('::')
})

watch(
  playersWatcherKey,
  () => {
    void refreshGameRoomPlayersState()
  },
  { immediate: true },
)


const gridStyle = computed(() => {
  const n = orderedTiles.value.length
  if (!n) {
    return {}
  }

  if (layoutMode.value === 'spotlight') {
    const hasStrip = spotlightStripPeerIds.value.length > 0
    return {
      display: 'grid',
      gridTemplateColumns: hasStrip ? 'minmax(0, 1fr) clamp(8.5rem, 18vw, 13rem)' : 'minmax(0, 1fr)',
      gridTemplateRows: hasStrip ? `repeat(${SPOTLIGHT_STRIP_VISIBLE_LIMIT}, minmax(0, 1fr))` : 'minmax(0, 1fr)',
      gap: `${GAP}px`,
      justifyContent: 'stretch',
      alignContent: 'stretch',
    }
  }

  const { cols, rows, tileWidth, tileHeight } = getGrid(n, stageSize.value.width, stageSize.value.height)

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)`,
    gridTemplateRows: `repeat(${rows}, ${tileHeight}px)`,
    gap: `${GAP}px`,
    justifyContent: 'center',
    alignContent: 'center',
  }
})

function tileLayoutStyle(row: (typeof orderedGridRows.value)[number]) {
  if (layoutMode.value !== 'spotlight') {
    return {}
  }
  const main = spotlightPeerId.value
  if (main == null || row.tile.peerId === main) {
    return {}
  }
  return {
    '--call-page-spotlight-slot': String(spotlightStripSlotForPeer(row.tile.peerId)),
  }
}


const stageFullBleed = computed(() => session.inCall && tiles.value.some((t) => t.videoEnabled))

function isTileControlDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(
    target.closest(
      'button,input,select,textarea,label,.tile-menu-cluster,.tile-menu-hoverable,.tile-menu__dropdown,.tile-remote-volume,.tile-remote-volume__dropdown',
    ),
  )
}

function onTilePointerDownForDrag(e: PointerEvent): void {
  tileDragStartedFromControls.value = isTileControlDragTarget(e.target)
}

function onTileDragStart(e: DragEvent, peerId: string): void {
  if (tileDragStartedFromControls.value || isTileControlDragTarget(e.target)) {
    e.preventDefault()
    dragPeerId.value = null
    dragOverPeerId.value = null
    return
  }
  dragPeerId.value = peerId
  e.dataTransfer?.setData('text/plain', peerId)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onTileDragOver(e: DragEvent, peerId: string): void {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverPeerId.value = peerId
}

function onTileDragLeave(peerId: string): void {
  if (dragOverPeerId.value === peerId) {
    dragOverPeerId.value = null
  }
}

function onTileDrop(peerId: string): void {
  const from = dragPeerId.value
  dragPeerId.value = null
  dragOverPeerId.value = null
  if (!from || from === peerId) {
    return
  }
  const order = [...tileOrder.value]
  const fi = order.indexOf(from)
  const ti = order.indexOf(peerId)
  if (fi === -1 || ti === -1) {
    return
  }
  order.splice(fi, 1)
  order.splice(ti, 0, from)
  tileOrder.value = order
}

function onTileDragEnd(): void {
  dragPeerId.value = null
  dragOverPeerId.value = null
  tileDragStartedFromControls.value = false
}

onBeforeUnmount(() => {
  // matchMedia teardown + FLIP RAF/timer cleanup are owned by
  // `useCallSpotlightLayout` and `useCallTileLayoutFlip` (Block 23).
  // Full-power timer + flag reset → `useFullPowerMode` (Block 24).
  // Remote-tile suppression-delay timers + suppressed map reset →
  //   `useRemoteTileBudget` onBeforeUnmount (Block 24).
  // Media-debug probe + global detach → `useCallMediaDebugTaps` onUnmounted (Block 24).
  // Room copy-flash timer cleanup → `useCallRoomCodeChip` onBeforeUnmount (Block 25).
  remotePlaybackWaitingPeerIds.value = new Set()
  // The "speaking order" hint timer is owned by `useGameRoomSpeakingHint`
  // (inside `GameTemplateCallAdapter`); the composable's own
  // `onBeforeUnmount` clears it. Do not reach for the timer ref from
  // here — it lives in the adapter, not in this file.
  callRoomHeaderJoin.reset()
  playersStore.reset()
  gameStore.fullReset()
  // Leaving /call must teardown media; otherwise Pinia session stays inCall.
  leaveCall()
})

onMounted(() => {
  // The spotlight matchMedia listener is owned by `useCallSpotlightLayout`
  // (Block 23). The `pointerdown` outside-click closer for media pickers
  // is owned by `useCallDevicePickers` (Block 24).
  // Auth-load IIFE, `?callDebug` URL parse, and DEV-only `__CALL_DEBUG__`
  // global are owned by `useCallPageBootstrap` (Block 28).
  // Timer-drift / rAF probes, `setMediaDebugEnvInfo`, and the optional
  // `installMediaDebugGlobal` install are owned by `useCallMediaDebugTaps`
  // (Block 24); see the composable call earlier in this script.
  // OBS / Settings toast event listeners are owned by
  // `useCallToastEventListeners` (Block 27).
  window.addEventListener('resize', syncChatPanelToViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncChatPanelToViewport)
  stopChatPanelGesture()
  // `pointerdown` listener teardown → `useCallDevicePickers`.
  // `setPeerVisibleHideTimerByPeer` + `lastSentPeerVisibleByPeer` cleanup
  //   → `useRemoteTileBudget` onUnmounted.
  // Media debug probe + global detach → `useCallMediaDebugTaps` onUnmounted.
  // `sa-call-route` <html> class teardown → `useCallRouteHtmlClass` (Block 27).
  // OBS / Settings event listener teardown → `useCallToastEventListeners` (Block 27).
  // DEV-only `__CALL_DEBUG__` teardown → `useCallPageBootstrap` (Block 28).
})

watch(
  () => session.inCall,
  (inCall) => {
    if (inCall) {
      void refreshMediaDevices()
    } else {
      closeMediaDevicePickers()
    }
  },
)

watch(joining, (j) => {
  if (j) {
    callRoomHeaderJoin.closeRoomPopover()
  }
})
</script>

<template>
  <div class="page-route">
    <AppFullPageLoader :visible="joining" :aria-label="t('callPage.joining')" label="" />
    <MediaDiagnosticsPanel v-if="mediaDebugPanelEnabled" />
    <CallRoomPopover
      v-model:display-name="session.selfDisplayName"
      v-model:room-join-draft="roomJoinDraft"
      v-model:video-quality-choice="videoQualityChoice"
      v-model:call-debug-overlay="callDebugOverlay"
      :open="callRoomHeaderJoin.roomPopoverOpen"
      :room-copy-flash="roomCopyFlash"
      :joining="joining"
      :allow-manual-video-quality="allowManualVideoQuality"
      :show-call-debug-controls="showCallDebugControls"
      :is-admin="isAdmin"
      :ws-status="wsStatus"
      :quality-presets="qualityPresets"
      @submit-room="submitRoomDraft"
      @copy-room="copyRoomToClipboard"
      @generate-room="onGenerateNewRoom"
    />
    <AppContainer class="call-page" :class="{ 'call-page--stage-full': stageFullBleed }" :flush="true">
    <div class="call-page__shell">
      <section
        class="call-page__active"
        :class="{
          'call-page__active--with-dock': (session.inCall || joining) && !gameRoomViewUi,
          'call-page__active--with-mafia-bottom': isGameRoomRoute && (session.inCall || joining) && !gameRoomViewUi,
        }"
      >
        <div
          v-if="joinError && !joining"
          class="call-page__join-error"
          role="alert"
        >
          <p class="call-page__join-error-text">{{ joinError }}</p>
          <AppButton variant="primary" @click="retryJoinCall">
            {{ t('callPage.retryJoin') }}
          </AppButton>
        </div>
        <GameRoomCallPresenceToastsPanel :toasts="callToasts" />
        <!--
          The "speaking order" hint toast lives on
          `GameTemplateCallAdapter.vue`, mounted from `GameTemplatePage`
          as a sibling of this component. Its CSS positioning is
          `position: fixed` (top: 4.75rem; right: 1rem; z-index: 110) so
          rendering from a different DOM ancestor does not change visual
          placement.
        -->

        <GameRoomCallChatInboundToastsPanel
          v-if="session.inCall && !gameRoomViewUi && callChatInboundToasts.length > 0"
          :toasts="callChatInboundToasts"
          @open="openChatFromInboundToast"
          @dismiss="dismissCallChatInboundToast"
        />

        <div
          ref="stageRef"
          class="call-page__stage"
          @pointerdown.capture="resumeCallAudioAnalysisFromGesture"
        >
          <div
            ref="gridRef"
            class="call-page__grid"
            :class="{ 'call-page__grid--spotlight': layoutMode === 'spotlight' }"
            :style="gridStyle"
          >
            <div
              v-for="row in orderedGridRows"
              :key="row.tile.peerId"
              :ref="(el) => setTileWrapRef(row.tile.peerId, el)"
              class="call-page__tile-wrap"
              :style="tileLayoutStyle(row)"
              :draggable="canReorderTiles"
              :title="canReorderTiles ? t('callPage.dragReorder') : undefined"
              :aria-label="canReorderTiles ? t('callPage.dragReorder') : undefined"
              :class="{
                'call-page__tile-wrap--spotlight-main':
                  layoutMode === 'spotlight' && row.tile.peerId === spotlightPeerId,
                'call-page__tile-wrap--spotlight-strip':
                  layoutMode === 'spotlight' && row.tile.peerId !== spotlightPeerId,
                'call-page__tile-wrap--spotlight-hidden': isSpotlightStripPeerHidden(row.tile.peerId),
                'call-page__tile-wrap--pinned': pinnedPeerId === row.tile.peerId,
                'call-page__tile-wrap--over': dragOverPeerId === row.tile.peerId,
                'call-page__tile-wrap--dragging': dragPeerId === row.tile.peerId,
                // Phase 3C: Mafia night-action-target highlight removed
                // (no `'night'` interaction mode in the generic protocol).
                'call-page__tile-wrap--mafia-host-speaking-queued':
                  isGameRoomRoute &&
                  isHostSpeakingNominationUiSeat(seatNumberByPeer.get(row.tile.peerId)),
                'call-page__tile-wrap--mafia-host-mode': isGameRoomRoute && !gameRoomViewUi && gameStore.isGameRoomHost,
                'call-page__tile-wrap--mafia-host-mode-speaking':
                  isGameRoomRoute &&
                  !gameRoomViewUi &&
                  gameStore.isGameRoomHost &&
                  gameStore.hostInteractionMode === 'speaking',
                'call-page__tile-wrap--mafia-host-mode-swap':
                  isGameRoomRoute &&
                  !gameRoomViewUi &&
                  gameStore.isGameRoomHost &&
                  gameStore.hostInteractionMode === 'swap',
                'call-page__tile-wrap--mafia-swap-selected':
                  isGameRoomRoute &&
                  !gameRoomViewUi &&
                  gameStore.isGameRoomHost &&
                  gameStore.hostInteractionMode === 'swap' &&
                  gameStore.hostSeatSwapSelectionPeerId === row.tile.peerId,
                'call-page__tile-wrap--mafia-cursor-default':
                  isGameRoomRoute && (gameRoomViewUi || !gameStore.isGameRoomHost),
                'call-page__tile-wrap--speaking': isTileRowSpeaking(row),
              }"
              @pointerdown.capture="onTilePointerDownForDrag"
              @click="onGameRoomHostTileClick($event, row)"
              @dragstart="onTileDragStart($event, row.tile.peerId)"
              @dragover.prevent="onTileDragOver($event, row.tile.peerId)"
              @dragleave="onTileDragLeave(row.tile.peerId)"
              @drop.prevent="onTileDrop(row.tile.peerId)"
              @dragend="onTileDragEnd"
            >
              <!-- Grid uses object-fit: contain (fill-cover false) so wide tiles do not crop webcam/screen. -->
              <ParticipantTile
                class="call-page__tile-inner"
                :peer-id="row.tile.peerId"
                :display-name="row.displayName"
                :avatar-fallback-name="peerAvatarFallbackName(row.tile.peerId)"
                :can-edit-display-name="canEditTileDisplayName(row.tile.peerId)"
                :game-seat-index="isGameRoomRoute ? seatNumberByPeer.get(row.tile.peerId) : undefined"
                :game-visible-role="undefined"
                :stream-view-mode="gameRoomViewUi"
                :stream="row.tile.stream"
                :is-local="row.tile.isLocal"
                :video-enabled="row.tile.videoEnabled"
                :audio-enabled="row.tile.audioEnabled"
                :video-fill-cover="false"
                :play-rev="row.tile.playRev"
                :size-tier="sizeTier"
                :row-speaking="isTileRowSpeaking(row)"
                :remote-listen-volume="row.tile.remoteListenVolume"
                :remote-listen-muted="row.tile.remoteListenMuted"
                :raise-hand="Boolean(row.tile.handRaised)"
                :video-presentation="row.tile.videoPresentation"
                :avatar-url="row.tile.avatarUrl ?? ''"
                :game-life-state="isGameRoomRoute ? gameStore.lifeStateForPeer(row.tile.peerId) : 'alive'"
                :game-elimination-kind="undefined"
                :game-elimination-background="undefined"
                :game-dead-background-url="null"
                :game-host-show-life-toggle="isGameRoomRoute && !gameRoomViewUi && gameStore.isGameRoomHost"
                :game-layer-viewport-observe="isCallAppRoute && !row.tile.isLocal"
                :video-playback-suppressed="
                  !row.tile.isLocal && videoPlaybackSuppressedForPeer(row.tile.peerId)
                "
                :video-target-playback-fps="remoteVideoTargetPlaybackFpsForPeer(row.tile.peerId)"
                @update:listen-volume="(v) => remoteListenVolumeHandler(row.tile.peerId)(v)"
                @update:listen-muted="(v) => remoteListenMutedHandler(row.tile.peerId)(v)"
                @commit-local-display-name="onCommitLocalTileDisplayName"
                @game-toggle-life="onToggleLifeFromTile(row.tile.peerId)"
                @game-force-camera-off="onForceCameraOffFromTile(row.tile.peerId)"
                @game-viewport-layers="(v) => onCallTileViewportForLayers(row.tile.peerId, v)"
                @remote-playback-stall="onRemotePlaybackStall"
                @video-stall="onTileVideoStall"
                @audio-stall="onTileAudioStall"
              />
              <button
                v-if="!gameRoomViewUi"
                type="button"
                class="call-page__pin-btn"
                :class="{ 'call-page__pin-btn--active': pinnedPeerId === row.tile.peerId }"
                :title="pinnedPeerId === row.tile.peerId ? t('callPage.unpinTile') : t('callPage.pinTile')"
                :aria-label="pinnedPeerId === row.tile.peerId ? t('callPage.unpinTile') : t('callPage.pinTile')"
                :aria-pressed="pinnedPeerId === row.tile.peerId"
                @click.stop="togglePin(row.tile.peerId)"
              >
                <img
                  class="call-page__pin-icon"
                  :src="pinnedPeerId === row.tile.peerId ? tilePinActiveIcon : tilePinIcon"
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
            <div
              v-if="layoutMode === 'spotlight' && spotlightOverflowCount > 0"
              class="call-page__tile-wrap call-page__tile-wrap--spotlight-strip call-page__tile-wrap--spotlight-overflow"
              :style="spotlightOverflowTileStyle"
              aria-hidden="true"
            >
              <div class="call-page__spotlight-overflow-tile">
                +{{ spotlightOverflowCount }}
              </div>
            </div>
          </div>
        </div>

        <GameRoomCallBottomCluster
          v-if="(session.inCall || joining) && !gameRoomViewUi"
        >
          <template #host-actions>
            <GameTemplateHostActionsBar
              v-if="isGameRoomRoute && gameStore.isGameRoomHost"
              @force-mute-all="onForceMuteAll"
            />
          </template>
          <template #dock>
            <CallControlsDock
              ref="callControlsDockRef"
              v-model:mic-picker-open="micPickerOpen"
              v-model:cam-picker-open="camPickerOpen"
              v-model:speaker-picker-open="speakerPickerOpen"
              v-model:chat-open="chatOpen"
              :joining="joining"
              :mic-enabled="micEnabled"
              :cam-enabled="camEnabled"
              :call-deafened="callDeafened"
              :hand-raised="handRaised"
              :screen-sharing="screenSharing"
              :show-media-device-pickers="showMediaDevicePickers"
              :audio-input-devices="audioInputDevices"
              :video-input-devices="videoInputDevices"
              :audio-output-devices="audioOutputDevices"
              :local-audio-input-device-id="localAudioInputDeviceId"
              :local-video-input-device-id="localVideoInputDeviceId"
              :local-audio-output-device-id="localAudioOutputDeviceId"
              @toggle-mic="toggleMic"
              @toggle-cam="toggleCam"
              @toggle-deafen="toggleCallDeafen"
              @toggle-raise-hand="toggleRaiseHand"
              @toggle-screen-share="toggleScreenShare"
              @leave="leaveCall"
              @pick-audio-input="pickAudioInput"
              @pick-video-input="pickVideoInput"
              @pick-audio-output="pickAudioOutput"
            />
          </template>
          <template #speaking-queue>
            <GameTemplateSpeakingQueueBar v-if="isGameRoomRoute" :show-tools="gameStore.isGameRoomHost" />
          </template>
        </GameRoomCallBottomCluster>
        <div
          v-if="(session.inCall || joining) && gameRoomViewUi && isGameRoomRoute"
          class="call-page__mafia-view-bottom"
        >
          <GameTemplateSpeakingQueueBar :show-tools="false" />
        </div>

        <CallChatPanel
          v-if="session.inCall && !gameRoomViewUi"
          v-model:open="chatOpen"
          :messages="callChatMessages"
          :self-peer-id="selfPeerId"
          :panel-class="chatPanelClass"
          :panel-style="chatPanelStyle"
          :display-name-for-peer="peerDisplayName"
          @send="sendChatMessage"
          @drag-pointer-down="onChatPanelDragPointerDown"
          @resize-pointer-down="onChatPanelResizePointerDown"
        />

        <GameRoomCallDebugOverlay
          v-if="session.callDebugOverlay && showCallDebugControls && !gameRoomViewUi"
          :snapshot="callDebugSnapshot"
          :inbound-rows="inboundDebugRows"
          :inbound-busy="inboundDebugBusy"
          @refresh="refreshInboundDebug"
        />
      </section>
    </div>
    </AppContainer>
  </div>
</template>

<!--
  Game Template fork reuses the production CallPage stylesheet by `src` so
  visual parity is byte-identical and a future cleanup of the canonical
  CallPage CSS automatically applies here. Class names referenced from
  this template intentionally remain `call-page__*` and `mafia-vote-hud*`
  to match the existing selectors in that file.
-->
<style src="@/components/call/CallPage.css"></style>
