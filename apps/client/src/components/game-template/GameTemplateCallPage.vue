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
  provide,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { CallEngineRole } from 'call-core'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  buildCallParticipantMap,
  buildDisplayNameUiMap,
  getAudioAnalysisAudioContext,
  normalizeDisplayName,
  resolvePeerDisplayNameForUi,
  useCallOrchestrator,
  VIDEO_QUALITY_PRESETS,
  type CallChatLine,
  type InboundVideoDebugRow,
  type VideoQualityPreset,
} from 'call-core'
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual'
import { useAuth } from '@/composables/useAuth'
import { createLogger } from '@/utils/logger'
import {
  loadCallTileLocalDisplayOverrides,
  saveCallTileLocalDisplayOverrides,
} from '@/utils/callTileLocalDisplayNames'
import { pinHostPeerToEndOfOrder } from '@/utils/gameHostOrdering'
import { resolveHostPeerIdForGrid, sortPeerIdsHostLast } from '@/components/call/callTileOrderRules'

const callPageLog = createLogger('call-page')
import ParticipantTile from '@/components/call/ParticipantTile.vue'
import MediaDiagnosticsPanel from '@/components/call/MediaDiagnosticsPanel.vue'
import {
  installMediaDebugGlobal,
  isMediaDebugEnabled,
  recordMediaDebugSignalingIncoming,
  recordMediaDebugWsTransition,
  setMediaDebugEnvInfo,
  startMediaDebugRafProbe,
  startMediaDebugTimerDriftProbe,
} from '@/utils/mediaDebugRuntime'
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
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import tilePinIcon from '@/assets/mafia/ui/tile-pin.svg'
import { generateCallRoomCode } from '@/utils/callRoomUi'
import {
  CALL_ROOM_DROPDOWN_HOST_ID,
  CALL_ROOM_POPOVER_PANEL_ID,
  useCallRoomHeaderJoinStore,
} from '@/stores/callRoomHeaderJoin'
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
import {
  applyCallAudioOutputSinkToStreamAudios,
  CALL_AUDIO_OUTPUT_DEVICE_ID_KEY,
} from '@/audio/callAudioOutputInjection'

type VideoQualityUiChoice = 'auto' | VideoQualityPreset

const CALL_AUDIO_OUTPUT_LS_KEY = 'streamassist_call_audio_out_v1'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, ensureAuthLoaded, isAdmin } = useAuth()

const CALL_ROUTE_HTML_CLASS = 'sa-call-route'

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
 * Game Template `?mode=view`: recv-only in call-core — no camera/mic publish
 * (`wireCallMediaAfterRoomState` skips send transport for `viewer`).
 */
const callEngineRole = computed((): CallEngineRole =>
  gameRoomViewUi.value ? 'viewer' : 'participant',
)

watch(
  () => isCallAppRoute.value,
  (onCallShell) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle(CALL_ROUTE_HTML_CLASS, onCallShell)
  },
  { immediate: true },
)


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





const FULL_POWER_ENTER_AFTER_MS = 4000
const isFullPowerMode = shallowRef(false)
let fullPowerEnterTimer: ReturnType<typeof setTimeout> | null = null

function clearFullPowerEnterTimer(): void {
  if (fullPowerEnterTimer != null) {
    clearTimeout(fullPowerEnterTimer)
    fullPowerEnterTimer = null
  }
}

watch(
  () =>
    [isSystemHealthy.value, receiveDeviceProfile.value.profile === 'strong'] as const,
  ([healthy, strongProfile]) => {
    if (!strongProfile || !healthy) {
      clearFullPowerEnterTimer()
      if (isFullPowerMode.value) {
        isFullPowerMode.value = false
      }
      return
    }
    if (isFullPowerMode.value) {
      return
    }
    if (fullPowerEnterTimer != null) {
      return
    }
    fullPowerEnterTimer = window.setTimeout(() => {
      fullPowerEnterTimer = null
      if (receiveDeviceProfile.value.profile === 'strong' && isSystemHealthy.value) {
        isFullPowerMode.value = true
      }
    }, FULL_POWER_ENTER_AFTER_MS)
  },
  { flush: 'post' },
)

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

// Diagnostics-only WS lifecycle counter. Reads the existing `wsStatus` ref;
// no call-core change required. Records open/close/error counts and
// detects `closed → open` (i.e. WS reconnect) transitions for the
// `?mediaDebug=1` panel + `__MEDIA_DEBUG__.wsStats()` console accessor.
let lastObservedWsStatus: string | null = null
watch(
  () => wsStatus.value,
  (next) => {
    const nextStr = typeof next === 'string' ? next : String(next)
    if (lastObservedWsStatus === nextStr) return
    recordMediaDebugWsTransition(lastObservedWsStatus, nextStr)
    lastObservedWsStatus = nextStr
  },
  { immediate: true },
)

// Diagnostics-only counting subscriber. Does NOT apply state — every other
// `subscribeSignalingMessage` registration handles real apply paths. This
// one increments per-type counters so post-incident analysis can correlate
// flicker / blackout reports with WS message bursts (`producer-sync`,
// `producer-closed`, `new-producer`, `room-state`, `peer-joined/left`,
// `gameroom:*` snapshot replies). Cost: one switch + counter per inbound message.
const offMediaDebugSignalingCounter = subscribeSignalingMessage((data) => {
  if (!data || typeof data !== 'object') return
  const type = (data as { type?: unknown }).type
  if (typeof type !== 'string') return
  if (type === 'producer-sync') {
    const payload = (data as { payload?: { syncReason?: unknown } }).payload
    const syncReason =
      payload && typeof payload.syncReason === 'string' ? payload.syncReason : undefined
    recordMediaDebugSignalingIncoming(type, { syncReason })
    return
  }
  recordMediaDebugSignalingIncoming(type)
})
onBeforeUnmount(offMediaDebugSignalingCounter)

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

const participantsByPeerId = computed(() =>
  buildCallParticipantMap(tiles.value, { ...remoteDisplayNames.value }, selfPeerId.value),
)


const displayNameUiByPeerId = computed(() =>
  buildDisplayNameUiMap(participantsByPeerId.value, {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }),
)

const nicknameOverrideByPeerId = shallowRef<Record<string, string>>({})


const localTileDisplayOverrides = shallowRef<Record<string, string>>(loadCallTileLocalDisplayOverrides())

function canEditTileDisplayName(peerId: string): boolean {
  const id = typeof peerId === 'string' ? peerId.trim() : ''
  if (!id) {
    return false
  }
  const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
  const isLocalTile = tiles.value.some((x) => x.peerId === id && x.isLocal)
  if (isGameRoomRoute.value) {
    return gameStore.isGameRoomHost || (selfId.length > 0 && id === selfId) || isLocalTile
  }
  return (selfId.length > 0 && id === selfId) || isLocalTile
}

function onCommitLocalTileDisplayName(payload: { peerId: string; name: string | null }): void {
  const id = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  if (!id) {
    return
  }
  if (!canEditTileDisplayName(id)) {
    return
  }
  const t = payload.name != null ? normalizeDisplayName(payload.name).slice(0, 64) : ''
  if (isGameRoomRoute.value) {
    sendSignalingMessage({ type: GameRoomWs.playerNameUpdate, payload: { targetPeerId: id, displayName: t } })
    // Optimistic UI update: server will broadcast the same value (or clear) back.
    // Without this, the label snaps back to the old value until the WS roundtrip completes.
    const next = { ...nicknameOverrideByPeerId.value }
    if (!t) {
      delete next[id]
    } else {
      next[id] = t
    }
    nicknameOverrideByPeerId.value = next
    // Game-room nickname overrides are server-authoritative; avoid a stale local override
    // shadowing the optimistic / server nickname.
    if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, id)) {
      const cleaned = { ...localTileDisplayOverrides.value }
      delete cleaned[id]
      localTileDisplayOverrides.value = cleaned
      saveCallTileLocalDisplayOverrides(cleaned)
    }
    return
  }
  const next = { ...localTileDisplayOverrides.value }
  if (!t) {
    delete next[id]
  } else {
    next[id] = t
  }
  localTileDisplayOverrides.value = next
  saveCallTileLocalDisplayOverrides(next)
}


function peerDisplayName(peerId: string): string {
  const o = localTileDisplayOverrides.value[peerId]
  if (typeof o === 'string' && normalizeDisplayName(o)) {
    return normalizeDisplayName(o).slice(0, 64)
  }
  if (isGameRoomRoute.value) {
    const n = nicknameOverrideByPeerId.value[peerId]
    if (typeof n === 'string' && normalizeDisplayName(n)) {
      return normalizeDisplayName(n).slice(0, 64)
    }
  }
  const participants = participantsByPeerId.value
  const opts = {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }
  const hit = displayNameUiByPeerId.value.get(peerId)
  if (hit !== undefined) {
    return hit
  }
  return resolvePeerDisplayNameForUi(peerId, participants, opts)
}

function peerAvatarFallbackName(peerId: string): string {
  const participants = participantsByPeerId.value
  const opts = {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }
  const hit = displayNameUiByPeerId.value.get(peerId)
  if (hit !== undefined) {
    return hit
  }
  return resolvePeerDisplayNameForUi(peerId, participants, opts)
}

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


const callTileViewportVisibleByPeer = shallowRef(new Map<string, boolean>())

/**
 * Per-tile server-side video pause hysteresis.
 * Resume on visible is immediate; pause on hidden waits a short window so
 * a quick scroll-by does not flap `setPeerVisible` (which sends WS messages
 * and triggers keyframe requests on resume).
 */
const SET_PEER_VISIBLE_HIDE_DEBOUNCE_MS = 500
const setPeerVisibleHideTimerByPeer = new Map<string, ReturnType<typeof setTimeout>>()
const lastSentPeerVisibleByPeer = new Map<string, boolean>()

function cancelSetPeerVisibleHideTimer(peerId: string): void {
  const t = setPeerVisibleHideTimerByPeer.get(peerId)
  if (t != null) {
    clearTimeout(t)
    setPeerVisibleHideTimerByPeer.delete(peerId)
  }
}

function applyPeerVisible(peerId: string, visible: boolean): void {
  if (lastSentPeerVisibleByPeer.get(peerId) === visible) {
    return
  }
  lastSentPeerVisibleByPeer.set(peerId, visible)
  setPeerVisible(peerId, visible)
}

function scheduleSetPeerVisible(peerId: string, visible: boolean): void {
  if (visible) {
    cancelSetPeerVisibleHideTimer(peerId)
    applyPeerVisible(peerId, true)
    return
  }
  if (setPeerVisibleHideTimerByPeer.has(peerId)) {
    return
  }
  const t = setTimeout(() => {
    setPeerVisibleHideTimerByPeer.delete(peerId)
    applyPeerVisible(peerId, false)
  }, SET_PEER_VISIBLE_HIDE_DEBOUNCE_MS)
  setPeerVisibleHideTimerByPeer.set(peerId, t)
}

const remoteVideoSuppressDelayTimerByPeer = new Map<string, ReturnType<typeof setTimeout>>()

const remoteVideoSuppressPendingKind = new Map<string, 'offscreen' | 'outside-budget'>()
const remoteVideoPlaybackSuppressed = shallowRef(new Map<string, boolean>())
function bumpRemotePlaybackSuppressed(peerId: string, suppressed: boolean, reason: string): void {
  const prev = remoteVideoPlaybackSuppressed.value.get(peerId) === true
  if (prev === suppressed) {
    return
  }
  const next = new Map(remoteVideoPlaybackSuppressed.value)
  if (suppressed) {
    next.set(peerId, true)
  } else {
    next.delete(peerId)
  }
  remoteVideoPlaybackSuppressed.value = next
  if (import.meta.env.DEV) {
    const prof = receiveDeviceProfile.value
    callPageLog.debug('[call-qa:playback-suppress]', {
      peerId,
      suppressed,
      reason,
      profile: prof.profile,
      maxActiveRemoteVideos: prof.maxActiveRemoteVideos,
      allowRenderSuppression: prof.allowRenderSuppression,
    })
  }
}

function clearRemoteVideoSuppressTimer(peerId: string): void {
  const t = remoteVideoSuppressDelayTimerByPeer.get(peerId)
  if (t != null) {
    clearTimeout(t)
    remoteVideoSuppressDelayTimerByPeer.delete(peerId)
  }
  remoteVideoSuppressPendingKind.delete(peerId)
}

function reconcileRemoteVideoPlaybackSuppression(): void {
  for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
    clearRemoteVideoSuppressTimer(pid)
  }
  for (const pid of [...remoteVideoPlaybackSuppressed.value.keys()]) {
    bumpRemotePlaybackSuppressed(pid, false, 'fixed-quality')
  }
}

/**
 * Stable scalar key for the suppression-reconcile watcher. Returning a
 * primitive string lets Vue compare with `Object.is` and skip the callback
 * when nothing visible-to-this-watcher actually changed; the previous object
 * source returned a fresh object on every reactivity flush which forced the
 * callback to fire even when the underlying values were equal.
 *
 * `viewport` is a `Map<string, boolean>`; we encode only the visible tile
 * ids into the key so that toggling an unrelated peer's `false` to `false`
 * does not refire the watcher.
 */
const suppressionWatcherKey = computed(() => {
  const visiblePeers: string[] = []
  for (const [pid, vis] of callTileViewportVisibleByPeer.value) {
    if (vis) {
      visiblePeers.push(pid)
    }
  }
  visiblePeers.sort()
  const tilesKey = tiles.value.map((t) => `${t.peerId}:${t.isLocal ? 'L' : 'R'}`).join('|')
  return [
    receiveDeviceProfile.value.allowRenderSuppression ? '1' : '0',
    isFullPowerMode.value ? '1' : '0',
    tilesKey,
    visiblePeers.join(','),
    activeSpeakerPeerId.value ?? '',
    serverActiveSpeakerPeerId.value ?? '',
  ].join('::')
})

watch(
  suppressionWatcherKey,
  () => {
    reconcileRemoteVideoPlaybackSuppression()
  },
  { flush: 'post' },
)

function videoPlaybackSuppressedForPeer(peerId: string): boolean {
  return remoteVideoPlaybackSuppressed.value.get(peerId) === true
}

/**
 * Phase 3.5: presentation FPS cap is a last resort.
 * Simulcast slots handle normal load; RVFC/pulse throttling only kicks in for bad, non-priority tiles.
 */
function remoteVideoTargetPlaybackFpsForPeer(peerId: string): number | undefined {
  void peerId
  return undefined
}

function onCallTileViewportForLayers(peerId: string, visible: boolean): void {
  if (!isCallAppRoute.value) {
    return
  }
  const id = typeof peerId === 'string' ? peerId.trim() : ''
  if (!id) {
    return
  }
  const prev = callTileViewportVisibleByPeer.value.get(id)
  if (prev === visible) {
    return
  }
  const nextMap = new Map(callTileViewportVisibleByPeer.value)
  nextMap.set(id, visible)
  callTileViewportVisibleByPeer.value = nextMap
  // Server-side video consumer pause for tiles that scroll out / are hidden.
  // Audio consumers are never paused (call-core invariant); only the video
  // consumer for this peer is affected. Hysteresis lives in scheduler.
  if (id !== selfPeerId.value) {
    scheduleSetPeerVisible(id, visible)
  }
  if (import.meta.env.DEV) {
    callPageLog.info('[call-qa:viewport] remote tile IO', {
      peerId: id,
      visible,
      isLocalSelf: id === selfPeerId.value,
    })
  }
}

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
    const vm = new Map(callTileViewportVisibleByPeer.value)
    let vmChanged = false
    for (const id of vm.keys()) {
      if (!ids.has(id)) {
        vm.delete(id)
        vmChanged = true
      }
    }
    if (vmChanged) {
      callTileViewportVisibleByPeer.value = vm
    }
    // `remoteVideoSuppressDelayTimerByPeer` had no per-peer-set prune; only
    // the unmount path cleared it. Across long sessions with player reloads,
    // it accumulated dead-peerId timer entries (each holding a setTimeout
    // handle + a tag in `remoteVideoSuppressPendingKind`). Mirror the
    // existing `setPeerVisibleHideTimerByPeer` prune here so dead peerIds
    // are dropped within one tile-set tick.
    for (const id of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
      if (!ids.has(id)) {
        clearRemoteVideoSuppressTimer(id)
      }
    }
    for (const id of [...setPeerVisibleHideTimerByPeer.keys()]) {
      if (!ids.has(id)) {
        cancelSetPeerVisibleHideTimer(id)
        lastSentPeerVisibleByPeer.delete(id)
      }
    }
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

type CallToast = { id: string; text: string; kind: 'join' | 'leave' }

const callToasts = ref<CallToast[]>([])
let lastPresenceToastSourceId = ''

function pushCallToast(text: string, kind: 'join' | 'leave' = 'join', ttlMs = 4200): void {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  callToasts.value = [...callToasts.value, { id, text, kind }]
  window.setTimeout(() => {
    callToasts.value = callToasts.value.filter((x) => x.id !== id)
  }, ttlMs)
}


watch(
  () => callPresenceMessages.value[callPresenceMessages.value.length - 1]?.id,
  () => {
    const msgs = callPresenceMessages.value
    const last = msgs[msgs.length - 1]
    if (!last || last.id === lastPresenceToastSourceId) {
      return
    }
    lastPresenceToastSourceId = last.id
    
    const name = last.displayName
    const text =
      last.kind === 'join'
        ? t('callPage.presenceJoined', { name })
        : t('callPage.presenceLeft', { name })
    const id = `toast-${last.id}`
    callToasts.value = [...callToasts.value, { id, text, kind: last.kind }]
    window.setTimeout(() => {
      callToasts.value = callToasts.value.filter((x) => x.id !== id)
    }, 4200)
  },
)

function onGameRoomObsUrlCopiedToast(): void {
  const id = `gameroom-obs-${Date.now()}`
  callToasts.value = [
    ...callToasts.value,
    { id, text: t('gameRoom.obsViewUrlCopiedToast'), kind: 'join' },
  ]
  window.setTimeout(() => {
    callToasts.value = callToasts.value.filter((x) => x.id !== id)
  }, 4200)
}

function onGameRoomSettingsToast(ev: Event): void {
  const text = ev instanceof CustomEvent && typeof ev.detail?.text === 'string'
    ? ev.detail.text
    : t('gameRoom.backgroundUploadFailed')
  const id = `gameroom-settings-${Date.now()}`
  callToasts.value = [
    ...callToasts.value,
    { id, text, kind: 'leave' },
  ]
  window.setTimeout(() => {
    callToasts.value = callToasts.value.filter((x) => x.id !== id)
  }, 4200)
}

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

type CallChatInboundToast = { toastId: string; lineId: string; title: string; preview: string }

const callChatInboundToasts = ref<CallChatInboundToast[]>([])
let lastSeenCallChatLineId = ''
const CHAT_INBOUND_TOAST_TTL_MS = 3800
const MAX_CHAT_INBOUND_TOASTS = 4

function dismissCallChatInboundToast(toastId: string): void {
  callChatInboundToasts.value = callChatInboundToasts.value.filter((x) => x.toastId !== toastId)
}

function pushCallChatInboundToast(line: CallChatLine): void {
  const previewRaw = line.text.trim()
  const preview = previewRaw.length > 96 ? `${previewRaw.slice(0, 96)}…` : previewRaw
  const title = normalizeDisplayName(line.displayName).trim() || '—'
  const toastId = `chat-toast-${line.id}`
  callChatInboundToasts.value = [
    ...callChatInboundToasts.value.filter((x) => x.lineId !== line.id),
    { toastId, lineId: line.id, title, preview },
  ].slice(-MAX_CHAT_INBOUND_TOASTS)
  window.setTimeout(() => dismissCallChatInboundToast(toastId), CHAT_INBOUND_TOAST_TTL_MS)
}

function openChatFromInboundToast(toastId: string): void {
  dismissCallChatInboundToast(toastId)
  chatOpen.value = true
}

watch(
  () => session.inCall,
  (inCall) => {
    if (!inCall) {
      lastSeenCallChatLineId = ''
      callChatInboundToasts.value = []
    }
  },
)

watch(chatOpen, (open) => {
  const msgs = callChatMessages.value
  if (open && msgs.length > 0) {
    lastSeenCallChatLineId = msgs[msgs.length - 1].id
  }
})

watch(
  callChatMessages,
  (msgs) => {
    if (!session.inCall || joining.value || gameRoomViewUi.value || msgs.length === 0) {
      return
    }
    const last = msgs[msgs.length - 1]
    if (chatOpen.value) {
      lastSeenCallChatLineId = last.id
      return
    }
    if (last.id === lastSeenCallChatLineId) {
      return
    }
    lastSeenCallChatLineId = last.id
    const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
    if (selfId.length > 0 && last.peerId === selfId) {
      return
    }
    pushCallChatInboundToast(last)
  },
  { deep: true },
)

const micPickerOpen = ref(false)
const camPickerOpen = ref(false)
const speakerPickerOpen = ref(false)
const lastPickedAudioOutputId = ref('')
const callAudioOutputDeviceId = ref('')

provide(CALL_AUDIO_OUTPUT_DEVICE_ID_KEY, callAudioOutputDeviceId)

function readCallAudioOutputFromStorage(): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    const raw = localStorage.getItem(CALL_AUDIO_OUTPUT_LS_KEY)
    if (typeof raw === 'string' && raw.trim().length > 0) {
      callAudioOutputDeviceId.value = raw.trim()
    }
  } catch {
    /* ignore */
  }
}
readCallAudioOutputFromStorage()

const localAudioOutputDeviceId = computed((): string | null => {
  const picked = lastPickedAudioOutputId.value.trim()
  if (picked && audioOutputDevices.value.some((d) => d.deviceId === picked)) {
    return picked
  }
  const cur = callAudioOutputDeviceId.value.trim()
  if (cur && audioOutputDevices.value.some((d) => d.deviceId === cur)) {
    return cur
  }
  return null
})

watch(
  callAudioOutputDeviceId,
  async (id) => {
    const t = typeof id === 'string' ? id.trim() : ''
    try {
      if (typeof localStorage !== 'undefined') {
        if (t.length > 0) {
          localStorage.setItem(CALL_AUDIO_OUTPUT_LS_KEY, t)
        } else {
          localStorage.removeItem(CALL_AUDIO_OUTPUT_LS_KEY)
        }
      }
    } catch {
      /* ignore */
    }
    if (t.length > 0) {
      await applyCallAudioOutputSinkToStreamAudios(t)
    }
  },
  { flush: 'post', immediate: true },
)
type CallControlsDockExpose = { containsDevicePickerTarget(target: Node): boolean }
const callControlsDockRef = ref<CallControlsDockExpose | null>(null)
const roomJoinDraft = ref('')
const roomCopyFlash = ref(false)
let roomCopyFlashTimer: ReturnType<typeof setTimeout> | null = null

const callAuthReady = ref(false)

const callRoomHeaderJoin = useCallRoomHeaderJoinStore()
const { roomPopoverOpen } = storeToRefs(callRoomHeaderJoin)
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

watch(roomPopoverOpen, (open) => {
  if (open) {
    roomJoinDraft.value = displayCallOrGameRoomCode()
  }
})

async function copyRoomToClipboard(): Promise<void> {
  const text = normalizeDisplayName(roomJoinDraft.value) || displayCallOrGameRoomCode()
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      return
    }
  }
  if (roomCopyFlashTimer !== null) {
    clearTimeout(roomCopyFlashTimer)
  }
  roomCopyFlash.value = true
  roomCopyFlashTimer = setTimeout(() => {
    roomCopyFlashTimer = null
    roomCopyFlash.value = false
  }, 1600)
}

async function onGenerateNewRoom(): Promise<void> {
  const nextRoom = generateCallRoomCode()
  roomJoinDraft.value = nextRoom
  await switchToRoom(nextRoom)
}

function submitRoomDraft(): void {
  const id = normalizeDisplayName(roomJoinDraft.value)
  if (!id) {
    return
  }
  void switchToRoom(id)
}

function retryJoinCall(): void {
  void joinCall()
}

const showMediaDevicePickers = computed(
  () =>
    session.inCall &&
    (audioInputDevices.value.length > 0 ||
      videoInputDevices.value.length > 0 ||
      audioOutputDevices.value.length > 0),
)

function closeMediaDevicePickers(): void {
  micPickerOpen.value = false
  camPickerOpen.value = false
  speakerPickerOpen.value = false
}

function onDocumentPointerForDevicePickers(ev: PointerEvent): void {
  const t = ev.target
  if (!(t instanceof Node)) {
    return
  }
  const roomHost = typeof document !== 'undefined' ? document.getElementById(CALL_ROOM_DROPDOWN_HOST_ID) : null
  const roomPanel = typeof document !== 'undefined' ? document.getElementById(CALL_ROOM_POPOVER_PANEL_ID) : null
  if (roomHost?.contains(t) || roomPanel?.contains(t)) {
    return
  }
  if (callRoomHeaderJoin.roomPopoverOpen) {
    callRoomHeaderJoin.closeRoomPopover()
  }
  if (!micPickerOpen.value && !camPickerOpen.value && !speakerPickerOpen.value) {
    return
  }
  if (callControlsDockRef.value?.containsDevicePickerTarget(t)) {
    return
  }
  closeMediaDevicePickers()
}

async function pickAudioInput(deviceId: string): Promise<void> {
  closeMediaDevicePickers()
  try {
    await setCallAudioInputDevice(deviceId)
  } catch (err) {
    callPageLog.warn('audio input', err)
  }
}

async function pickVideoInput(deviceId: string): Promise<void> {
  closeMediaDevicePickers()
  try {
    await setCallVideoInputDevice(deviceId)
  } catch (err) {
    callPageLog.warn('video input', err)
  }
}

async function pickAudioOutput(deviceId: string): Promise<void> {
  closeMediaDevicePickers()
  const id = deviceId.trim()
  if (id.length < 1) {
    return
  }
  lastPickedAudioOutputId.value = id
  callAudioOutputDeviceId.value = id
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

const orderedTiles = computed(() => {
  const list = tiles.value.slice()
  if (isGameRoomRoute.value && list.length > 0) {
    const base = gameStore.getDisplayNumberingOrder(tileOrder.value)
    const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : ''
    const hostPidForGrid = resolveHostPeerIdForGrid(explicitHostPeerId, base)
    const order = hostPidForGrid.length > 0 ? pinHostPeerToEndOfOrder(base, hostPidForGrid) : base.slice()

    const orderIndex = new Map<string, number>()
    let cursor = 0
    for (const peerId of order) {
      if (typeof peerId !== 'string' || peerId.length < 1) continue
      if (orderIndex.has(peerId)) continue
      orderIndex.set(peerId, cursor)
      cursor += 1
    }
    const extras = list.filter((t) => !orderIndex.has(t.peerId))
    const extrasOrdered =
      hostPidForGrid.length > 0
        ? [...extras.filter((t) => t.peerId !== hostPidForGrid), ...extras.filter((t) => t.peerId === hostPidForGrid)]
        : extras.slice()
    for (const tile of extrasOrdered) {
      orderIndex.set(tile.peerId, cursor)
      cursor += 1
    }
    return [...list].sort((a, b) => {
      const ai = orderIndex.get(a.peerId) ?? Number.MAX_SAFE_INTEGER
      const bi = orderIndex.get(b.peerId) ?? Number.MAX_SAFE_INTEGER
      if (ai !== bi) return ai - bi
      return a.peerId.localeCompare(b.peerId)
    })
  }

  const orderIndex = new Map(tileOrder.value.map((peerId, index) => [peerId, index]))
  return list.sort((a, b) => {
    if (spotlightDesktop.value && pinnedPeerId.value != null) {
      if (a.peerId === pinnedPeerId.value) {
        return -1
      }
      if (b.peerId === pinnedPeerId.value) {
        return 1
      }
    }

    const ai = orderIndex.get(a.peerId)
    const bi = orderIndex.get(b.peerId)
    if (ai != null && bi != null && ai !== bi) {
      return ai - bi
    }
    if (ai != null && bi == null) {
      return -1
    }
    if (ai == null && bi != null) {
      return 1
    }
    return a.peerId.localeCompare(b.peerId)
  })
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


const orderedGridRows = computed(() => {
  const participants = participantsByPeerId.value
  const opts = {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }
  const names = displayNameUiByPeerId.value
  const overrides = localTileDisplayOverrides.value
  const nicknameOverrides = nicknameOverrideByPeerId.value
  return orderedTiles.value.map((tile) => {
    const ov = overrides[tile.peerId]
    if (typeof ov === 'string' && normalizeDisplayName(ov)) {
      return { tile, displayName: normalizeDisplayName(ov).slice(0, 64) }
    }
    if (isGameRoomRoute.value) {
      const n = nicknameOverrides[tile.peerId]
      if (typeof n === 'string' && normalizeDisplayName(n)) {
        return { tile, displayName: normalizeDisplayName(n).slice(0, 64) }
      }
    }
    return {
      tile,
      displayName:
        names.get(tile.peerId) ??
        resolvePeerDisplayNameForUi(tile.peerId, participants, opts),
    }
  })
})

/**
 * Speaking highlight — single source of truth (no child emit, no per-peer reactive map; those caused update churn).
 * - Remote tiles: `activeSpeakerPeerId` from call-core VAD.
 * - Local tile: `useLocalTileSpeakingVisual` fed from `localAudioSourceStream` (raw getUserMedia),
 *   not `tile.stream` (which is a video-preview stream that goes `null` when camera is off,
 *   which previously hid the local glow whenever the cam was off even with mic on).
 */
const localTileSpeakingForWrap = useLocalTileSpeakingVisual(
  () => localAudioSourceStream.value,
  () => true,
  () => micEnabled.value,
)

function isTileRowSpeaking(row: (typeof orderedGridRows.value)[number]): boolean {
  if (row.tile.isLocal) {
    return localTileSpeakingForWrap.value
  }
  const pid = row.tile.peerId
  return pid === activeSpeakerPeerId.value || pid === serverActiveSpeakerPeerId.value
}

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
  clearFullPowerEnterTimer()
  isFullPowerMode.value = false
  remotePlaybackWaitingPeerIds.value = new Set()
  if (roomCopyFlashTimer !== null) {
    clearTimeout(roomCopyFlashTimer)
    roomCopyFlashTimer = null
  }
  // The "speaking order" hint timer is owned by `useGameRoomSpeakingHint`
  // (inside `GameTemplateCallAdapter`); the composable's own
  // `onBeforeUnmount` clears it. Do not reach for the timer ref from
  // here — it lives in the adapter, not in this file.
  for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
    clearRemoteVideoSuppressTimer(pid)
  }
  remoteVideoPlaybackSuppressed.value = new Map()
  callRoomHeaderJoin.reset()
  playersStore.reset()
  gameStore.fullReset()
  // Leaving /call must teardown media; otherwise Pinia session stays inCall.
  leaveCall()
})

onMounted(() => {
  // The spotlight matchMedia listener is owned by `useCallSpotlightLayout`
  // (Block 23).
  document.addEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
  window.addEventListener('resize', syncChatPanelToViewport)
  void (async () => {
    await ensureAuthLoaded()
    const authName = normalizeDisplayName(user.value?.displayName)
    const cur = normalizeDisplayName(session.selfDisplayName)
    if (authName && (!cur || cur === 'You')) {
      session.selfDisplayName = authName
    }
    callAuthReady.value = true
  })()
  try {
    const q = new URLSearchParams(window.location.search).get('callDebug')
    if (q === '1' || q === 'true') {
      session.setCallDebugOverlay(true)
    }
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    ;(globalThis as unknown as { __CALL_DEBUG__: { stageSize: typeof stageSize; orderedTiles: typeof orderedTiles } }).__CALL_DEBUG__ = {
      stageSize,
      orderedTiles,
    }
  }
  window.addEventListener(GAME_ROOM_OBS_URL_TOAST_EVENT, onGameRoomObsUrlCopiedToast)
  window.addEventListener(GAME_ROOM_SETTINGS_TOAST_EVENT, onGameRoomSettingsToast)
  // Always-on timer-drift probe — diagnostic only, no media side effects.
  // Surfaces OBS browser-source / hidden-tab throttling that would otherwise
  // silently break the StreamVideo currentTime stall watchdog and the
  // StreamAudio AudioContext heartbeat. Cost is one setInterval at 2 s per
  // call route; result accessible via `__MEDIA_DEBUG__.timerDrift()` and
  // surfaced in the `?mediaDebug=1` panel.
  detachMediaDebugTimerDriftProbe = startMediaDebugTimerDriftProbe()
  // Companion rAF probe. setInterval and rAF are throttled differently in
  // some Chromium versions; the rAF probe surfaces render-loop pressure
  // (long frames, low FPS) that the timer-drift probe cannot. Pure counter
  // updates per frame; no DOM access in the callback.
  detachMediaDebugRafProbe = startMediaDebugRafProbe()
  // Stamp env info ONCE at mount. Read live `documentVisibilityState`
  // is included by the reader, so no need to track it reactively.
  // Game Template writes the neutral `isGameRoomView` key; production
  // Mafia continues to write `isMafiaView` from its own CallPage. The
  // shared util ORs both into `isViewMode` and `MediaDiagnosticsPanel`
  // labels them distinctly.
  setMediaDebugEnvInfo({
    isGameRoomView: gameRoomViewUi.value,
  })
  if (isMediaDebugEnabled()) {
    detachMediaDebugGlobal = installMediaDebugGlobal({
      forceSoftResync: () => {
        try {
          requestForcedProducerResync()
        } catch (err) {
          console.warn('[mediaDebug] forceSoftResync failed', err)
        }
      },
    })
  }
})

let detachMediaDebugGlobal: (() => void) | null = null
let detachMediaDebugTimerDriftProbe: (() => void) | null = null
let detachMediaDebugRafProbe: (() => void) | null = null

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
  window.removeEventListener('resize', syncChatPanelToViewport)
  stopChatPanelGesture()
  window.removeEventListener(GAME_ROOM_OBS_URL_TOAST_EVENT, onGameRoomObsUrlCopiedToast)
  window.removeEventListener(GAME_ROOM_SETTINGS_TOAST_EVENT, onGameRoomSettingsToast)
  document.documentElement.classList.remove(CALL_ROUTE_HTML_CLASS)
  for (const id of [...setPeerVisibleHideTimerByPeer.keys()]) {
    cancelSetPeerVisibleHideTimer(id)
  }
  lastSentPeerVisibleByPeer.clear()
  detachMediaDebugTimerDriftProbe?.()
  detachMediaDebugTimerDriftProbe = null
  detachMediaDebugRafProbe?.()
  detachMediaDebugRafProbe = null
  if (import.meta.env.DEV) {
    delete (globalThis as unknown as { __CALL_DEBUG__?: unknown }).__CALL_DEBUG__
  }
  detachMediaDebugGlobal?.()
  detachMediaDebugGlobal = null
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
        <div class="call-page__toasts" role="region" :aria-label="t('callPage.toastStackAria')">
          <TransitionGroup name="call-toast" tag="div" class="call-page__toast-stack">
            <div
              v-for="x in callToasts"
              :key="x.id"
              class="call-page__toast"
              :class="x.kind === 'leave' ? 'call-page__toast--leave' : 'call-page__toast--join'"
            >
              {{ x.text }}
            </div>
          </TransitionGroup>
        </div>
        <!--
          The "speaking order" hint toast lives on
          `GameTemplateCallAdapter.vue`, mounted from `GameTemplatePage`
          as a sibling of this component. Its CSS positioning is
          `position: fixed` (top: 4.75rem; right: 1rem; z-index: 110) so
          rendering from a different DOM ancestor does not change visual
          placement.
        -->

        <div
          v-if="session.inCall && !gameRoomViewUi && callChatInboundToasts.length > 0"
          class="call-page__chat-toasts"
          role="region"
          :aria-label="t('callPage.chatInboundToastAria')"
        >
          <TransitionGroup
            name="call-chat-toast"
            tag="div"
            class="call-page__chat-toasts-stack"
            aria-live="polite"
          >
            <div
              v-for="row in callChatInboundToasts"
              :key="row.toastId"
              class="call-page__chat-toast"
              role="article"
            >
              <button
                type="button"
                class="call-page__chat-toast-main"
                :aria-label="t('callPage.chatInboundToastOpenChat')"
                @click="openChatFromInboundToast(row.toastId)"
              >
                <span class="call-page__chat-toast-title">{{ row.title }}</span>
                <span class="call-page__chat-toast-preview">{{ row.preview }}</span>
              </button>
              <button
                type="button"
                class="call-page__chat-toast-dismiss"
                :aria-label="t('callPage.chatInboundToastDismiss')"
                @click.stop="dismissCallChatInboundToast(row.toastId)"
              >
                ×
              </button>
            </div>
          </TransitionGroup>
        </div>

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
              :draggable="!gameRoomViewUi && !isGameRoomRoute"
              :title="t('callPage.dragReorder')"
              :aria-label="t('callPage.dragReorder')"
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

        <div
          v-if="(session.inCall || joining) && !gameRoomViewUi"
          class="call-page__bottom-cluster"
        >
          <div
            class="call-page__bottom-cluster__left call-page__bottom-cluster__left--empty"
            aria-hidden="true"
          />
          <div
            class="call-page__bottom-cluster__center call-page__bottom-cluster__center--speak-dock"
          >
            <GameTemplateHostActionsBar
              v-if="isGameRoomRoute && gameStore.isGameRoomHost"
              @force-mute-all="onForceMuteAll"
            />
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
            <GameTemplateSpeakingQueueBar v-if="isGameRoomRoute" :show-tools="gameStore.isGameRoomHost" />
          </div>
        </div>
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

        <aside
          v-if="session.callDebugOverlay && showCallDebugControls && !gameRoomViewUi"
          class="call-page__debug"
          :aria-label="t('callPage.debugAria')"
        >
          <div class="call-page__debug-head">
            <span class="call-page__debug-title">{{ t('callPage.debugTitle') }}</span>
            <AppButton variant="secondary" :disabled="inboundDebugBusy" @click="refreshInboundDebug">
              {{ inboundDebugBusy ? t('callPage.debugRefreshing') : t('callPage.debugRefresh') }}
            </AppButton>
          </div>
          <dl class="call-page__debug-dl">
            <dt>{{ t('callPage.debugPreset') }}</dt>
            <dd>{{ callDebugSnapshot.videoQualityPreset }}</dd>
            <dt>{{ t('callPage.debugExplicit') }}</dt>
            <dd>{{ callDebugSnapshot.videoQualityExplicit }}</dd>
            <dt>{{ t('callPage.debugPublishTier') }}</dt>
            <dd>{{ callDebugSnapshot.videoPublishTier }}</dd>
            <dt>{{ t('callPage.debugActiveCamerasWire') }}</dt>
            <dd>{{ callDebugSnapshot.activeCameraPublishersAtWire }}</dd>
            <dt>{{ t('callPage.debugPeersWire') }}</dt>
            <dd>{{ callDebugSnapshot.peerCountAtWire }}</dd>
            <dt>{{ t('callPage.debugPublishSimulcast') }}</dt>
            <dd>{{ callDebugSnapshot.publishSimulcast }}</dd>
            <dt>{{ t('callPage.debugActiveSpeaker') }}</dt>
            <dd>{{ callDebugSnapshot.effectiveActiveSpeakerPeerId ?? '—' }}</dd>
            <dt>{{ t('callPage.debugServerSpeaker') }}</dt>
            <dd>{{ callDebugSnapshot.serverActiveSpeakerPeerId ?? '—' }}</dd>
          </dl>
          <ul v-if="inboundDebugRows.length" class="call-page__debug-list">
            <li v-for="row in inboundDebugRows" :key="row.producerId" class="call-page__debug-li">
              <span class="call-page__debug-peer">{{ row.peerId.slice(0, 8) }}…</span>
              {{ row.frameWidth ?? '?' }}×{{ row.frameHeight ?? '?' }}
              <span v-if="row.framesPerSecond != null" class="call-page__debug-fps"> ~{{ row.framesPerSecond.toFixed(1) }} fps</span>
              <span class="call-page__debug-loss"> loss {{ row.packetsLost ?? '—' }}</span>
            </li>
          </ul>
        </aside>
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
