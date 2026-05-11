<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { ComponentPublicInstance } from 'vue'
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
import { pinHostPeerToEndOfOrder } from '@/utils/mafiaHostOrdering'
import { resolveHostPeerIdForGrid, sortPeerIdsHostLast } from './callTileOrderRules'

const callPageLog = createLogger('call-page')
import ParticipantTile from './ParticipantTile.vue'
import MediaDiagnosticsPanel from './MediaDiagnosticsPanel.vue'
import {
  installMediaDebugGlobal,
  isMediaDebugEnabled,
  recordMediaDebugSignalingIncoming,
  recordMediaDebugWsTransition,
  setMediaDebugEnvInfo,
  startMediaDebugRafProbe,
  startMediaDebugTimerDriftProbe,
} from '@/utils/mediaDebugRuntime'
import { useMediaStallRecovery } from './useMediaStallRecovery'
import CallRoomPopover from './CallRoomPopover.vue'
import CallControlsDock from './CallControlsDock.vue'
import CallChatPanel from './CallChatPanel.vue'
import { useCallChatPanel } from './useCallChatPanel'
import { computeCallVideoGridLayout } from './callVideoGridLayout'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import mafiaTilePinIcon from '@/assets/mafia/ui/tile-pin.svg'
import { generateCallRoomCode } from '@/utils/callRoomUi'
import {
  CALL_ROOM_DROPDOWN_HOST_ID,
  CALL_ROOM_POPOVER_PANEL_ID,
  useCallRoomHeaderJoinStore,
} from '@/stores/callRoomHeaderJoin'
import { useMafiaHostSignaling } from '@/composables/useMafiaHostSignaling'
import { useMafiaCallHostUi } from '@/composables/useMafiaCallHostUi'
import { useEatFirstCallSignaling } from '@/composables/useEatFirstCallSignaling'
import {
  mafiaBaseRoomIdFromSignaling,
  mafiaSignalingRoomId,
  MAFIA_SIGNALING_ROOM_PREFIX,
} from '@/composables/useMafiaMediaRoom'
import {
  eatFirstBaseRoomIdFromSignaling,
  eatFirstSignalingRoomId,
  EAT_FIRST_SIGNALING_ROOM_PREFIX,
} from '@/eat-first/utils/eatFirstCallRoomId'
import MafiaSpeakingQueueBar from '@/components/mafia/MafiaSpeakingQueueBar.vue'
import MafiaHostActionsBar from '@/components/mafia/MafiaHostActionsBar.vue'
import EatFirstHostActionsBar from '@/eat-first/components/EatFirstHostActionsBar.vue'
import EatFirstSpeakingQueueBar from '@/eat-first/components/EatFirstSpeakingQueueBar.vue'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import { EatFirstWs } from '@/eat-first/eatFirstWsProtocol'
import {
  getActiveEatFirstSlotForSession,
  pickPrimaryEatFirstJoinTokenForGame,
} from '@/eat-first/utils/joinTokenStore.js'
import { getOrCreateDeviceId } from '@/eat-first/utils/deviceId.js'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import { mafiaEliminationAvatarKindForPeerId } from '@/utils/mafiaEliminationAvatarKind'
import { EAT_FIRST_OBS_URL_TOAST_EVENT } from '@/composables/eatFirstCallStreamView'
import { MAFIA_OBS_URL_TOAST_EVENT, MAFIA_SETTINGS_TOAST_EVENT } from '@/composables/mafiaStreamViewRoute'
import { MafiaWs } from '@/composables/mafiaWsProtocol'
import { useMafiaAudioMixSignaling } from '@/composables/useMafiaAudioMixSignaling'
import mafiaTilePinActiveIcon from '@/assets/mafia/ui/tile-pin-active.svg'
import { nominationTargetSeatsFromSpeakingFlat } from '@/utils/speakingNominationQueue'
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
 * `/app/call`, `/app/mafia`, and `/app/eat` share one `CallPage` (video + orchestrator).
 * Isolation: Mafia uses `mafia:` signaling prefix; Eat First uses `eat:` (see `eatFirstCallRoomId.ts`).
 */
const isCallAppRoute = computed(() => route.name === 'call' || route.name === 'mafia' || route.name === 'eat')
const isMafiaRoute = computed(() => route.name === 'mafia')
const isEatFirstRoute = computed(() => route.name === 'eat')

const props = withDefaults(
  defineProps<{
    mafiaStreamView?: boolean
    eatFirstStreamView?: boolean
  }>(),
  { mafiaStreamView: false, eatFirstStreamView: false },
)

const mafiaViewUi = computed(() => isMafiaRoute.value && props.mafiaStreamView)
const eatFirstViewUi = computed(() => isEatFirstRoute.value && props.eatFirstStreamView)

/**
 * Mafia `?mode=view` and Eat First `?mode=view`: recv-only in call-core — no camera/mic publish
 * (`wireCallMediaAfterRoomState` skips send transport for `viewer`). `/app/call` stays `participant`.
 */
const callEngineRole = computed((): CallEngineRole =>
  mafiaViewUi.value || eatFirstViewUi.value ? 'viewer' : 'participant',
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
  dominantSpeakerPeerId,
  audioLevelsByPeerId,
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
  return mafiaViewUi.value || eatFirstViewUi.value
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
        mafiaViewUi: mafiaViewUi.value,
        eatFirstViewUi: eatFirstViewUi.value,
        routeName: route.name,
        isMafiaRoute: isMafiaRoute.value,
        isEatFirstRoute: isEatFirstRoute.value,
      })
    },
    { immediate: true },
  )
}

useMafiaHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus)

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
// Mafia snapshot replies). Cost: one switch + counter per inbound message.
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

const MAFIA_FORCE_CAMERA_OFF_SIGNAL = MafiaWs.forceCameraOff
const MAFIA_FORCE_MUTE_ALL_SIGNAL = MafiaWs.forceMuteAll
const EAT_FIRST_FORCE_MUTE_ALL_SIGNAL = EatFirstWs.forceMuteAll
const EAT_FIRST_TRAIT_REVEAL_REQUEST_SIGNAL = EatFirstWs.traitRevealRequest
const EAT_FIRST_TRAIT_REGENERATE_REQUEST_SIGNAL = EatFirstWs.traitRegenerateRequest
const EAT_FIRST_TRAIT_TYPE_REROLL_REQUEST_SIGNAL = EatFirstWs.traitTypeRerollRequest
const EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL = EatFirstWs.actionCardRerollRequest
const EAT_FIRST_ACTION_CARD_USE_SIGNAL = EatFirstWs.actionCardUse
const EAT_FIRST_TABLE_ROUND_DEAL_SIGNAL = EatFirstWs.tableRoundDeal
const EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL = EatFirstWs.speakingQueueUpdate
const EAT_FIRST_SLOT_CLAIM_SIGNAL = EatFirstWs.slotClaim
// Inbound `eat:*` response signals are handled by `useEatFirstCallSignaling`.

type EatFirstTraitKey =
  | 'gender'
  | 'age'
  | 'profession'
  | 'health'
  | 'hobby'
  | 'phobia'
  | 'fact'
  | 'baggage'

function mafiaSignalPayload(data: unknown, type: string): Record<string, unknown> | null {
  if (data == null || typeof data !== 'object') {
    return null
  }
  const rec = data as { type?: unknown; payload?: unknown }
  if (rec.type !== type || rec.payload == null || typeof rec.payload !== 'object') {
    return null
  }
  return rec.payload as Record<string, unknown>
}

const offMafiaForceControls = subscribeSignalingMessage((data) => {
  if (!isMafiaRoute.value) {
    return
  }
  const nickPayload = mafiaSignalPayload(data, MafiaWs.playerNicknameUpdate)
  if (nickPayload != null) {
    const peerId = typeof nickPayload.peerId === 'string' ? nickPayload.peerId.trim() : ''
    if (!peerId) {
      return
    }
    const displayName = typeof nickPayload.displayName === 'string' ? nickPayload.displayName.trim().slice(0, 64) : ''
    const next = { ...mafiaNicknameOverrideByPeerId.value }
    if (!displayName) {
      delete next[peerId]
    } else {
      next[peerId] = displayName
    }
    mafiaNicknameOverrideByPeerId.value = next
    // Ensure an older local-only rename doesn't shadow the Mafia-synced nickname.
    if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, peerId)) {
      const cleaned = { ...localTileDisplayOverrides.value }
      delete cleaned[peerId]
      localTileDisplayOverrides.value = cleaned
      saveCallTileLocalDisplayOverrides(cleaned)
    }
    return
  }
  const mutePayload = mafiaSignalPayload(data, MAFIA_FORCE_MUTE_ALL_SIGNAL)
  if (mutePayload != null) {
    if (mafiaGameStore.isMafiaHost) {
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
  const cameraPayload = mafiaSignalPayload(data, MAFIA_FORCE_CAMERA_OFF_SIGNAL)
  const peerId = cameraPayload?.peerId
  if (typeof peerId === 'string' && peerId === selfPeerId.value && camEnabled.value) {
    void toggleCam()
  }
  // Per-peer Mafia mic-force (server-emitted side effect of kick/revive).
  // `muted: true` flips the local mic UI off via the existing call-core
  // `toggleMic` action so the killed peer stops trying to talk into a
  // server-paused producer. `muted: false` is a UI hint clear only — we
  // do NOT auto-unmute the user; they unmute manually after revive.
  const forcePeerMicPayload = mafiaSignalPayload(data, MafiaWs.forcePeerMic)
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

onBeforeUnmount(offMafiaForceControls)

/**
 * Mafia P1 Bug 1+2: per-peer effective audio-muted tracking for the host's
 * "mute all" button visual state. Server's `peer-audio-muted` already
 * encodes effective mute (`audioMuted || forcedAudioMuted`); the room-state
 * snapshot at join carries the same data per peer. Both flow into the
 * store's `peerEffectiveMutedByPeerId`, which `MafiaHostActionsBar`
 * reduces against `nonHostPeerIds` for the visual.
 *
 * Gated on `isMafiaRoute` so non-Mafia rooms never write to the Mafia store.
 */
const offMafiaPeerAudioMuted = subscribeSignalingMessage((data) => {
  if (!isMafiaRoute.value) {
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
    mafiaGameStore.replacePeerEffectiveMutedSnapshot(snapshot)
    return
  }
  if (rec.type === 'peer-audio-muted') {
    const p = rec.payload
    if (p == null || typeof p !== 'object') return
    const pid = (p as { peerId?: unknown }).peerId
    const muted = (p as { muted?: unknown }).muted
    if (typeof pid !== 'string' || pid.length === 0) return
    mafiaGameStore.setPeerEffectiveMuted(pid, muted === true)
    return
  }
  if (rec.type === 'peer-left') {
    const p = rec.payload
    if (p == null || typeof p !== 'object') return
    const pid = (p as { peerId?: unknown }).peerId
    if (typeof pid !== 'string' || pid.length === 0) return
    mafiaGameStore.clearPeerEffectiveMuted(pid)
  }
})

onBeforeUnmount(offMafiaPeerAudioMuted)

/**
 * Toggling Mafia `?mode=view` (header / router) flips `callEngineRole` only after a new wire; re-join
 * so OBS drops any existing send transport from a prior participant session in the same tab.
 */
watch(
  mafiaViewUi,
  (v, oldV) => {
    if (!isMafiaRoute.value) {
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

watch(
  eatFirstViewUi,
  (v, oldV) => {
    if (!isEatFirstRoute.value) {
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

const mafiaNicknameOverrideByPeerId = shallowRef<Record<string, string>>({})


const localTileDisplayOverrides = shallowRef<Record<string, string>>(loadCallTileLocalDisplayOverrides())

function canEditTileDisplayName(peerId: string): boolean {
  const id = typeof peerId === 'string' ? peerId.trim() : ''
  if (!id) {
    return false
  }
  const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
  const isLocalTile = tiles.value.some((x) => x.peerId === id && x.isLocal)
  if (isMafiaRoute.value) {
    return mafiaGameStore.isMafiaHost || (selfId.length > 0 && id === selfId) || isLocalTile
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
  if (isMafiaRoute.value) {
    sendSignalingMessage({ type: MafiaWs.playerNameUpdate, payload: { targetPeerId: id, displayName: t } })
    // Optimistic UI update: server will broadcast the same value (or clear) back.
    // Without this, the label snaps back to the old value until the WS roundtrip completes.
    const next = { ...mafiaNicknameOverrideByPeerId.value }
    if (!t) {
      delete next[id]
    } else {
      next[id] = t
    }
    mafiaNicknameOverrideByPeerId.value = next
    // Mafia nickname overrides are server-authoritative; avoid a stale local override
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
  if (isMafiaRoute.value) {
    const n = mafiaNicknameOverrideByPeerId.value[peerId]
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
 * Deferred slot: assigned by `useMafiaAudioMixSignaling` further down the
 * setup script (it depends on `mafiaGameStore` which is initialized later).
 * Handlers below reference the slot lazily so the host's slider/mute toggle
 * also fans out a `mafia:audio-mix-update` to the room (OBS view applies it).
 * No-op for non-host or non-Mafia routes.
 */
const mafiaAudioMixBroadcasterSlot: { broadcast: ((delta: { peerId: string; volume: number; muted: boolean }) => void) | null } = {
  broadcast: null,
}

function broadcastMafiaAudioMixDeltaForTile(peerId: string, volume: number, muted: boolean): void {
  mafiaAudioMixBroadcasterSlot.broadcast?.({ peerId, volume, muted })
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
      broadcastMafiaAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId))
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
      broadcastMafiaAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId))
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
const eatFirstShell = useEatFirstCallShellStore()
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
    if (isEatFirstRoute.value) {
      const hostPeerId = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId : null
      const connectedPlayers = hostPeerId != null && ids.has(hostPeerId) ? Math.max(0, ids.size - 1) : ids.size
      eatFirstShell.setConnectedPlayerCount(connectedPlayers)
    }
  },
)

watch(
  () => [isEatFirstRoute.value, eatFirstShell.hostPeerId, tiles.value.map((t) => t.peerId).join('|')] as const,
  ([isEatRoute, hostPeerId]) => {
    if (!isEatRoute) {
      return
    }
    const ids = new Set(tiles.value.map((t) => t.peerId))
    const hostId = typeof hostPeerId === 'string' ? hostPeerId : null
    const connectedPlayers = hostId != null && ids.has(hostId) ? Math.max(0, ids.size - 1) : ids.size
    eatFirstShell.setConnectedPlayerCount(connectedPlayers)
  },
  { immediate: true },
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

function onEatFirstForceMuteAll(muted: boolean): void {
  if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost) {
    return
  }
  sendSignalingMessage({ type: EAT_FIRST_FORCE_MUTE_ALL_SIGNAL, payload: { muted } })
}

function onEatFirstReshuffle(): void {
  if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost) {
    return
  }
  if (import.meta.env.DEV) {
    callPageLog.info('[eat-first:ws:send]', { type: EAT_FIRST_TABLE_ROUND_DEAL_SIGNAL, payload: {} })
  }
  sendSignalingMessage({
    type: EAT_FIRST_TABLE_ROUND_DEAL_SIGNAL,
    payload: {},
  })
}

function attemptEatFirstSlotClaim(): void {
  if (!isEatFirstRoute.value) return
  const gid = (() => {
    const q = route.query?.game
    return typeof q === 'string' ? q.trim() : ''
  })()
  if (!gid) return

  const sessionTok = getActiveEatFirstSlotForSession(gid)
  const picked = pickPrimaryEatFirstJoinTokenForGame(gid)

  let slotId = ''
  let joinToken = ''
  let deviceId = ''

  if (sessionTok && sessionTok.joinToken.length > 0) {
    slotId = sessionTok.slotId.trim()
    joinToken = sessionTok.joinToken.trim()
    deviceId = typeof sessionTok.deviceId === 'string' ? sessionTok.deviceId.trim() : ''
  } else if (picked && picked.token.trim().length > 0) {
    slotId = typeof picked.slotId === 'string' ? picked.slotId.trim() : ''
    joinToken = picked.token.trim()
    deviceId = ''
  } else {
    return
  }

  if (!slotId) return

  const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''

  if (joinToken.length > 0) {
    const fallbackDeviceId = deviceId.length >= 8 ? deviceId : getOrCreateDeviceId()
    if (fallbackDeviceId.length < 8) return
    if (import.meta.env.DEV) {
      callPageLog.info('[eat-first:slot-claim:send]', {
        gameId: gid,
        slotId,
        peerId: selfId || null,
        mode: 'token',
      })
    }
    sendSignalingMessage({
      type: EAT_FIRST_SLOT_CLAIM_SIGNAL,
      payload: { slotId, joinToken, deviceId: fallbackDeviceId },
    })
  }
}

function patchEatFirstTraitForSlot(slotId: string, traitKey: EatFirstTraitKey, value: string): void {
  const sid = slotId.trim()
  const nextValue = value.trim()
  if (!sid || !nextValue) return
  const prev = eatFirstShell.traitsBySlot[sid]
  if (!prev || typeof prev !== 'object') return
  eatFirstShell.setTraitsBySlot({
    ...eatFirstShell.traitsBySlot,
    [sid]: { ...prev, [traitKey]: nextValue },
  })
}

/**
 * Eat First inbound signaling — extracted into `useEatFirstCallSignaling`.
 *
 * The composable owns the four `slot/revealed/overrides/opened-bySlot`
 * shallowRefs (returned here so the rest of CallPage's computeds can read
 * them with the original variable names) plus the `applyingSpeakingQueueFromSignaling`
 * flag the host-side rebroadcast watcher uses to suppress its own echo.
 *
 * Cross-cutting effects that need other CallPage-scope deps stay here as
 * callbacks: slot-claim (route + per-game token store), trait patcher
 * (writes through `eatFirstShell.traitsBySlot`), and the action-card-used
 * toast (i18n + display name + `callToasts`).
 */
// `overridesBySlot` and `openedBySlot` are internal to the composable today
// (the dispatcher writes them; no CallPage computed reads them). Kept on the
// composable's return shape for future EatFirst adapters; not destructured
// here to avoid lint warnings.
const {
  applyingSpeakingQueueFromSignaling: applyingEatFirstSpeakingQueueFromSignaling,
  slotByPeer: eatFirstSlotByPeer,
  revealedBySlot: eatFirstRevealedBySlot,
} = useEatFirstCallSignaling({
  subscribeSignalingMessage,
  selfPeerId,
  roomId: computed(() => session.roomId),
  isEatFirstRoute,
  eatFirstShell,
  micEnabled,
  toggleMic,
  attemptSlotClaim: attemptEatFirstSlotClaim,
  patchTraitForSlot: patchEatFirstTraitForSlot,
  onPlayerUsedActionCard: ({ peerId, title }) => {
    const name = peerDisplayName(peerId)
    const id = `eat-ac-${Date.now()}-${peerId}`
    const text = t('eatFirstCall.playerUsedActionCardToast', { name, card: title })
    callToasts.value = [...callToasts.value, { id, text, kind: 'join' }]
    window.setTimeout(() => {
      callToasts.value = callToasts.value.filter((x) => x.id !== id)
    }, 5200)
  },
  log: callPageLog,
})

/**
 * Host-panel <-> CallPage bridge. The panel is rendered as a sibling of
 * `<CallPage />` (Teleport-d to body from `EatFirstCallPage`), so it cannot
 * call signaling methods directly. Instead the panel dispatches a typed
 * `CustomEvent` on `window` and CallPage forwards it through the live socket.
 * Listener is removed on unmount; only acts when on the Eat First route AND
 * the local user is the room host (server still re-validates).
 */
function onEatFirstHostActionEvent(ev: Event): void {
  if (!isEatFirstRoute.value) return
  if (!eatFirstShell.isEatFirstRoomHost) return
  const detail = (ev as CustomEvent).detail
  if (!detail || typeof detail !== 'object') return
  if (import.meta.env.DEV) {
    callPageLog.info('[eat-first:host-action:received]', detail)
  }
  const action = (detail as { action?: unknown }).action
  if (action === 'trait-type-reroll-all') {
    const traitKey = (detail as { traitKey?: unknown }).traitKey
    if (typeof traitKey !== 'string') return
    if (import.meta.env.DEV) {
      callPageLog.info('[eat-first:ws:send]', {
        type: EAT_FIRST_TRAIT_TYPE_REROLL_REQUEST_SIGNAL,
        payload: { traitKey },
      })
    }
    sendSignalingMessage({
      type: EAT_FIRST_TRAIT_TYPE_REROLL_REQUEST_SIGNAL,
      payload: { traitKey },
    })
    return
  }
  if (action === 'action-card-reroll') {
    const slotId = (detail as { slotId?: unknown }).slotId
    if (typeof slotId !== 'string' || slotId.length < 1) return
    if (import.meta.env.DEV) {
      callPageLog.info('[eat-first:ws:send]', {
        type: EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL,
        payload: { slotId },
      })
    }
    sendSignalingMessage({
      type: EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL,
      payload: { slotId },
    })
    return
  }
}

const EAT_FIRST_HOST_ACTION_EVENT = 'streamassist:eat-first:host-action'

function onEatFirstTimerActionEvent(ev: Event): void {
  if (!isEatFirstRoute.value) return
  if (!eatFirstShell.isEatFirstRoomHost) return
  const detail = (ev as CustomEvent).detail
  if (!detail || typeof detail !== 'object') return
  const action = (detail as { action?: unknown }).action
  if (action === 'timer-start') {
    const raw = (detail as { durationSec?: unknown }).durationSec
    const durationSec =
      typeof raw === 'number' && Number.isFinite(raw) ? Math.max(5, Math.floor(raw)) : 30
    const durationMs = durationSec * 1000
    sendSignalingMessage({
      type: EatFirstWs.timerStart,
      payload: { startedAt: Date.now(), duration: durationMs },
    })
    return
  }
  if (action === 'timer-stop') {
    sendSignalingMessage({ type: EatFirstWs.timerStop, payload: {} })
  }
}

const EAT_FIRST_TIMER_ACTION_EVENT = 'streamassist:eat-first:timer-action'

if (typeof window !== 'undefined') {
  window.addEventListener(EAT_FIRST_HOST_ACTION_EVENT, onEatFirstHostActionEvent)
  window.addEventListener(EAT_FIRST_TIMER_ACTION_EVENT, onEatFirstTimerActionEvent)
  onBeforeUnmount(() => {
    window.removeEventListener(EAT_FIRST_HOST_ACTION_EVENT, onEatFirstHostActionEvent)
    window.removeEventListener(EAT_FIRST_TIMER_ACTION_EVENT, onEatFirstTimerActionEvent)
  })
}

function onMafiaObsUrlCopiedToast(): void {
  const id = `mafia-obs-${Date.now()}`
  callToasts.value = [
    ...callToasts.value,
    { id, text: t('mafiaPage.obsViewUrlCopiedToast'), kind: 'join' },
  ]
  window.setTimeout(() => {
    callToasts.value = callToasts.value.filter((x) => x.id !== id)
  }, 4200)
}

function onEatFirstObsUrlCopiedToast(): void {
  if (!isEatFirstRoute.value) {
    return
  }
  const id = `eat-first-obs-${Date.now()}`
  callToasts.value = [
    ...callToasts.value,
    { id, text: t('eatFirstCall.obsCopied'), kind: 'join' },
  ]
  window.setTimeout(() => {
    callToasts.value = callToasts.value.filter((x) => x.id !== id)
  }, 4200)
}

function onMafiaSettingsToast(ev: Event): void {
  const text = ev instanceof CustomEvent && typeof ev.detail?.text === 'string'
    ? ev.detail.text
    : t('mafiaPage.backgroundUploadFailed')
  const id = `mafia-settings-${Date.now()}`
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
    if (
      !session.inCall ||
      joining.value ||
      mafiaViewUi.value ||
      eatFirstViewUi.value ||
      msgs.length === 0
    ) {
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
const mafiaPlayersStore = useMafiaPlayersStore()
const mafiaGameStore = useMafiaGameStore()
watch(
  joinUserId,
  (id) => {
    mafiaGameStore.setLocalMafiaUserId(id ?? null)
  },
  { immediate: true },
)

const { mafiaHostPeerId: mafiaHostPeerIdRef, isMafiaHost: isMafiaHostRef } = storeToRefs(mafiaGameStore)
const { broadcastMafiaAudioMixDelta } = useMafiaAudioMixSignaling({
  sendSignalingMessage,
  subscribeSignalingMessage,
  wsStatus,
  isMafiaRoute,
  isViewMode: mafiaViewUi,
  isMafiaHost: isMafiaHostRef,
  hostPeerId: mafiaHostPeerIdRef,
  setRemoteListenVolume,
  setRemoteListenMuted,
})
mafiaAudioMixBroadcasterSlot.broadcast = broadcastMafiaAudioMixDelta


function displayCallOrMafiaRoomCode(): string {
  const raw = normalizeDisplayName(session.roomId) || 'demo'
  if (isMafiaRoute.value) {
    return mafiaBaseRoomIdFromSignaling(raw)
  }
  if (isEatFirstRoute.value) {
    return eatFirstBaseRoomIdFromSignaling(raw)
  }
  return raw
}

/**
 * Keep `session.roomId` consistent with the route: Mafia → `mafia:<base>`, Eat First → `eat:<base>`,
 * Call → neither prefix.
 */
function normalizeSessionRoomIdForStreamRoute(): void {
  if (!isCallAppRoute.value) {
    return
  }
  const s = normalizeDisplayName(session.roomId) || 'demo'
  if (isEatFirstRoute.value) {
    const desired = eatFirstSignalingRoomId(eatFirstBaseRoomIdFromSignaling(s))
    if (s !== desired) {
      session.roomId = desired
    }
    return
  }
  if (isMafiaRoute.value) {
    const desired = mafiaSignalingRoomId(mafiaBaseRoomIdFromSignaling(s))
    if (s !== desired) {
      session.roomId = desired
    }
    return
  }
  if (s.startsWith(MAFIA_SIGNALING_ROOM_PREFIX)) {
    session.roomId = mafiaBaseRoomIdFromSignaling(s)
  }
  if (s.startsWith(EAT_FIRST_SIGNALING_ROOM_PREFIX)) {
    session.roomId = eatFirstBaseRoomIdFromSignaling(s)
  }
}

async function switchToRoom(nextRaw: string, opts?: { fromRoute?: boolean }): Promise<void> {
  const base = normalizeDisplayName(nextRaw) || 'demo'
  const signalingId = isMafiaRoute.value
    ? mafiaSignalingRoomId(base)
    : isEatFirstRoute.value
      ? eatFirstSignalingRoomId(base)
      : base
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
      const name = route.name === 'mafia' ? 'mafia' : route.name === 'eat' ? 'eat' : 'call'
      const query =
        name === 'eat' ? { ...route.query, game: base } : { ...route.query, room: base }
      await router.replace({ name, query })
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
      typeof route.query.game === 'string' ? route.query.game : '',
      callAuthReady.value,
    ] as const,
  async () => {
    if (!callAuthReady.value || !isCallAppRoute.value) {
      return
    }
    normalizeSessionRoomIdForStreamRoute()
    const q =
      route.name === 'eat'
        ? typeof route.query.game === 'string'
          ? normalizeDisplayName(route.query.game)
          : ''
        : typeof route.query.room === 'string'
          ? normalizeDisplayName(route.query.room)
          : ''
    if (!q) {
      if (!session.inCall && !joining.value) {
        try {
          const code = generateCallRoomCode()
          if (route.name === 'eat') {
            await router.replace({
              name: 'eat',
              query: { ...route.query, game: code },
            })
          } else {
            await router.replace({
              name: route.name as 'call' | 'mafia',
              query: { ...route.query, room: code },
            })
          }
        } catch {
          /* ignore */
        }
      }
      return
    }
    const currentSignaling = normalizeDisplayName(session.roomId) || 'demo'
    const qSignaling =
      route.name === 'mafia'
        ? mafiaSignalingRoomId(q)
        : route.name === 'eat'
          ? eatFirstSignalingRoomId(q)
          : q
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
    roomJoinDraft.value = displayCallOrMafiaRoomCode()
  }
})

async function copyRoomToClipboard(): Promise<void> {
  const text = normalizeDisplayName(roomJoinDraft.value) || displayCallOrMafiaRoomCode()
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
const SPOTLIGHT_DESKTOP_MEDIA = '(min-width: 1024px)'
const spotlightDesktop = ref(
  typeof window !== 'undefined' ? window.matchMedia(SPOTLIGHT_DESKTOP_MEDIA).matches : true,
)
let spotlightDesktopMediaQuery: MediaQueryList | null = null

function syncSpotlightDesktop(ev?: MediaQueryListEvent): void {
  spotlightDesktop.value = ev?.matches ?? spotlightDesktopMediaQuery?.matches ?? true
}

watch(
  tiles,
  (list) => {
    let ids = list.map((t) => t.peerId)
    if (isEatFirstRoute.value) {
      const hostId = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId : ''
      ids = sortPeerIdsHostLast(ids, hostId)
    }
    if (isMafiaRoute.value) {
      const explicitHostId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : ''
      const prevDisplayOrder = mafiaGameStore.getDisplayNumberingOrder(tileOrder.value)
      const hostId = resolveHostPeerIdForGrid(explicitHostId, prevDisplayOrder)
      ids = sortPeerIdsHostLast(ids, hostId)
      tileOrder.value = ids
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
 * Push the current non-host participant peerIds to the Mafia store so it
 * can compute "every non-host effectively muted" for the host UI button
 * (P1 Bug 1+2). The store filters out the host peerId internally.
 */
watch(
  () => [
    isMafiaRoute.value,
    mafiaGameStore.mafiaHostPeerId,
    tiles.value.map((t) => t.peerId).join('|'),
  ],
  () => {
    if (!isMafiaRoute.value) {
      mafiaGameStore.setNonHostPeerIds([])
      return
    }
    // Pass every tile peerId; the store filters the host peer internally.
    // This keeps the membership stable when host changes via transfer.
    mafiaGameStore.setNonHostPeerIds(tiles.value.map((t) => t.peerId))
  },
  { immediate: true, flush: 'post' },
)


const mafiaNumberByPeer = computed(() => {
  if (!isMafiaRoute.value) {
    return new Map<string, number>()
  }
  const m = new Map<string, number>()
  const order = mafiaGameStore.getDisplayNumberingOrder(tileOrder.value)
  const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : ''
  const hostPeerId = resolveHostPeerIdForGrid(explicitHostPeerId, order)
  const numbered = hostPeerId.length > 0 ? order.filter((id) => id !== hostPeerId) : order
  numbered.forEach((id, i) => {
    m.set(id, i + 1)
  })
  return m
})

/**
 * Mafia call-host UI behaviour — extracted into `useMafiaCallHostUi` (Phase 2).
 *
 * Owns the host-side handlers, the night-action/speaking seat-highlight
 * computeds, the speak-hint visibility ref + lifecycle, and the Mafia branch
 * of the tile-click router. CallPage's template binds the destructured names
 * unchanged, so no template edits are required.
 *
 * The Mafia OBS/host-claim flow, audio-mix host broadcast, and inbound
 * Mafia signaling continue to live in `useMafiaHostSignaling` and
 * `useMafiaAudioMixSignaling`; this composable is strictly the CallPage-level
 * host-UI surface.
 */
const {
  isMafiaHostNightActionSeat,
  isMafiaHostSpeakingNominationUiSeat,
  onMafiaToggleLifeFromTile,
  onMafiaForceCameraOffFromTile,
  onMafiaForceMuteAll,
  onMafiaSetEliminationBackground,
  handleMafiaHostTileClick,
} = useMafiaCallHostUi({
  isMafiaRoute,
  mafiaViewUi,
  selfPeerId,
  mafiaGameStore,
  mafiaNumberByPeer,
  sendSignalingMessage,
  pushCallToast,
  t,
})

const eatFirstSeatByPeer = computed(() => {
  if (!isEatFirstRoute.value) {
    return new Map<string, number>()
  }
  const m = new Map<string, number>()
  for (const [peerId, slotId] of Object.entries(eatFirstSlotByPeer.value)) {
    if (typeof slotId !== 'string') continue
    const hit = /^p([1-9]|1[01])$/i.exec(slotId.trim())
    if (!hit) continue
    const seat = Number(hit[1])
    if (Number.isInteger(seat) && seat >= 1) {
      m.set(peerId, seat)
    }
  }
  return m
})

/** 1-based position in `playerOrder` for the tile badge (speaking / table order). */
const eatFirstDisplayOrderByPeer = computed(() => {
  const m = new Map<string, number>()
  if (!isEatFirstRoute.value) return m
  const slotByPeer = eatFirstSlotByPeer.value
  const peerBySlot = new Map<string, string>()
  for (const [peerId, slotId] of Object.entries(slotByPeer)) {
    const sid = typeof slotId === 'string' ? slotId.trim() : ''
    if (!/^p([1-9]|1[01])$/i.test(sid)) continue
    peerBySlot.set(sid, peerId)
  }
  eatFirstShell.playerOrder.forEach((slotId, idx) => {
    const peerId = peerBySlot.get(slotId)
    if (peerId && !m.has(peerId)) {
      m.set(peerId, idx + 1)
    }
  })
  return m
})

/** Same 1-based index as the Eat First tile badge; host nomination queue must match that label, not `pN` slot digits. */
function eatFirstNominationNumberForPeer(peerId: string): number | undefined {
  if (!isEatFirstRoute.value) return undefined
  const disp = eatFirstDisplayOrderByPeer.value.get(peerId)
  if (typeof disp === 'number' && Number.isInteger(disp) && disp >= 1) return disp
  const slotNum = eatFirstSeatByPeer.value.get(peerId)
  if (typeof slotNum === 'number' && Number.isInteger(slotNum) && slotNum >= 1) return slotNum
  return undefined
}

watch(
  () => eatFirstShell.speakingQueue,
  (q) => {
    if (applyingEatFirstSpeakingQueueFromSignaling.value) {
      return
    }
    if (!isEatFirstRoute.value) {
      return
    }
    if (!session.inCall) {
      return
    }
    if (wsStatus.value !== 'open') {
      return
    }
    if (!eatFirstShell.isEatFirstRoomHost) {
      return
    }
    sendSignalingMessage({
      type: EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL,
      payload: { speakingQueue: [...q] },
    })
  },
  { deep: true },
)

const eatFirstActiveTabSlotId = computed(() => {
  if (!isEatFirstRoute.value) return ''
  const gid = typeof route.query?.game === 'string' ? route.query.game.trim() : ''
  if (!gid) return ''
  const active = getActiveEatFirstSlotForSession(gid)
  return active?.slotId ?? ''
})

function eatFirstTraitsForPeer(peerId: string): Record<EatFirstTraitKey, string> | null {
  if (!isEatFirstRoute.value) return null
  const hostPid = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId.trim() : ''
  if (hostPid.length > 0 && peerId === hostPid) return null
  const slot = eatFirstSlotByPeer.value[peerId]
  if (typeof slot === 'string' && slot.length > 0) {
    const bySlot = eatFirstShell.traitsBySlot[slot]
    if (bySlot && typeof bySlot === 'object') return bySlot
  }
  return null
}

function eatFirstTraitHostView(): boolean {
  return isEatFirstRoute.value && eatFirstShell.isEatFirstRoomHost
}

function eatFirstTraitOwnerView(peerId: string): boolean {
  if (!isEatFirstRoute.value) return false
  const peerSlot = eatFirstSlotForPeer(peerId)
  if (!peerSlot) return false
  const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
  if (selfId.length > 0 && peerId === selfId) return true
  const tabSlot = eatFirstActiveTabSlotId.value
  if (tabSlot.length > 0 && peerSlot === tabSlot) return true
  return false
}

function eatFirstSlotForPeer(peerId: string): string {
  if (!isEatFirstRoute.value) return ''
  const slot = eatFirstSlotByPeer.value[peerId]
  return typeof slot === 'string' ? slot : ''
}

function eatFirstRevealedTraitsForPeer(peerId: string): string[] {
  if (!isEatFirstRoute.value) return []
  const slot = eatFirstSlotForPeer(peerId)
  if (!slot) return []
  const bySlot = eatFirstRevealedBySlot.value[slot]
  if (!bySlot || typeof bySlot !== 'object') return []
  const out: string[] = []
  for (const [k, open] of Object.entries(bySlot)) {
    if (open === true) out.push(k)
  }
  return out
}

function eatFirstActionCardForPeer(peerId: string): {
  title: string
  description: string
  templateId: string
  used: boolean
} | null {
  if (!isEatFirstRoute.value) return null
  const hostPid = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId.trim() : ''
  if (hostPid.length > 0 && peerId === hostPid) return null
  const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
  const isHost = eatFirstShell.isEatFirstRoomHost === true
  if (!isHost) {
    if (!selfId || peerId !== selfId) return null
  }
  const slot = eatFirstSlotForPeer(peerId)
  if (!slot) return null
  const card = eatFirstShell.actionCardBySlot[slot]
  if (!card) return null
  const title = typeof card.title === 'string' ? card.title : ''
  if (title.length < 1) return null
  return {
    title,
    description: typeof card.description === 'string' ? card.description : '',
    templateId: typeof card.templateId === 'string' ? card.templateId : '',
    used: card.used === true,
  }
}

function onEatFirstRevealTrait(payload: {
  peerId: string
  traitKey: EatFirstTraitKey
  closed?: boolean
}): void {
  if (!isEatFirstRoute.value) return
  const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  const slotId = eatFirstSlotForPeer(peerId)
  if (!slotId) return
  const close = payload.closed === true
  sendSignalingMessage({
    type: EAT_FIRST_TRAIT_REVEAL_REQUEST_SIGNAL,
    payload: close
      ? { slotId, traitKey: payload.traitKey, closed: true }
      : { slotId, traitKey: payload.traitKey },
  })
}

function onEatFirstGenerateTrait(payload: { peerId: string; traitKey: EatFirstTraitKey }): void {
  if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost) return
  const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  const slotId = eatFirstSlotForPeer(peerId)
  if (!slotId) return
  sendSignalingMessage({
    type: EAT_FIRST_TRAIT_REGENERATE_REQUEST_SIGNAL,
    payload: { slotId, traitKey: payload.traitKey },
  })
}

function onEatFirstRerollActionCard(payload: { peerId: string }): void {
  if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost) return
  const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  const slotId = eatFirstSlotForPeer(peerId)
  if (!slotId) return
  sendSignalingMessage({
    type: EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL,
    payload: { slotId },
  })
}

function onEatFirstPlayerUseActionCard(payload: { peerId: string }): void {
  if (!isEatFirstRoute.value) return
  const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
  if (!peerId || peerId !== selfId) return
  const slotId = eatFirstSlotForPeer(peerId)
  if (!slotId) return
  sendSignalingMessage({
    type: EAT_FIRST_ACTION_CARD_USE_SIGNAL,
    payload: { slotId },
  })
}

const orderedTiles = computed(() => {
  const list = tiles.value.slice()
  if (isMafiaRoute.value && list.length > 0) {
    const base = mafiaGameStore.getDisplayNumberingOrder(tileOrder.value)
    const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : ''
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

  if (isEatFirstRoute.value && list.length > 0) {
    const orderIndex = new Map<string, number>()
    const slotByPeer = eatFirstSlotByPeer.value
    const peerBySlot = new Map<string, string>()
    for (const [peerId, slotId] of Object.entries(slotByPeer)) {
      if (typeof slotId === 'string' && /^p([1-9]|1[01])$/i.test(slotId.trim())) {
        peerBySlot.set(slotId.trim(), peerId)
      }
    }
    let cursor = 0
    for (const slotId of eatFirstShell.playerOrder) {
      const peerId = peerBySlot.get(slotId)
      if (!peerId) continue
      if (orderIndex.has(peerId)) continue
      orderIndex.set(peerId, cursor)
      cursor += 1
    }
    const hostPidRaw = eatFirstShell.hostPeerId
    const hostPidForGrid = typeof hostPidRaw === 'string' ? hostPidRaw.trim() : ''
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
      if (ai !== bi) {
        return ai - bi
      }
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

const layoutMode = computed<'grid' | 'spotlight'>(() =>
  spotlightDesktop.value && (pinnedPeerId.value != null || orderedTiles.value.length === 1) ? 'spotlight' : 'grid',
)

const SPOTLIGHT_STRIP_VISIBLE_LIMIT = 6

const spotlightPeerId = computed(() => {
  if (pinnedPeerId.value != null) {
    return pinnedPeerId.value
  }
  return orderedTiles.value.length === 1 ? orderedTiles.value[0]?.peerId ?? null : null
})

const spotlightStripPeerIds = computed(() => {
  const main = spotlightPeerId.value
  return main == null ? [] : orderedTiles.value.filter((tile) => tile.peerId !== main).map((tile) => tile.peerId)
})

const spotlightVisibleStripPeerIds = computed(() => {
  const ids = spotlightStripPeerIds.value
  if (ids.length > SPOTLIGHT_STRIP_VISIBLE_LIMIT) {
    return ids.slice(0, SPOTLIGHT_STRIP_VISIBLE_LIMIT - 1)
  }
  return ids.slice(0, SPOTLIGHT_STRIP_VISIBLE_LIMIT)
})

const spotlightVisibleStripPeerIdSet = computed(() => new Set(spotlightVisibleStripPeerIds.value))

const spotlightOverflowCount = computed(() =>
  Math.max(0, spotlightStripPeerIds.value.length - spotlightVisibleStripPeerIds.value.length),
)

const spotlightOverflowTileStyle = computed(() => ({
  '--call-page-spotlight-slot': String(SPOTLIGHT_STRIP_VISIBLE_LIMIT),
}))

function spotlightStripSlotForPeer(peerId: string): number {
  const index = spotlightVisibleStripPeerIds.value.indexOf(peerId)
  return index >= 0 ? index + 1 : 1
}

function isSpotlightStripPeerHidden(peerId: string): boolean {
  return layoutMode.value === 'spotlight' && peerId !== spotlightPeerId.value && !spotlightVisibleStripPeerIdSet.value.has(peerId)
}

function togglePin(peerId: string): void {
  if (!orderedTiles.value.some((tile) => tile.peerId === peerId)) {
    return
  }
  pinnedPeerId.value = pinnedPeerId.value === peerId ? null : peerId
}


const GAP = 12
const MIN_TILE_WIDTH = 180





const GRID_CONTENT_INSET_PX = 12

function getGrid(n: number, width: number, height: number) {
  const g = computeCallVideoGridLayout(n, width, height, {
    gapPx: GAP,
    minTileWidthPx: MIN_TILE_WIDTH,
    contentInsetPx: GRID_CONTENT_INSET_PX,
  })
  if (import.meta.env.DEV && n > 0) {
    callPageLog.debug('grid layout', {
      n,
      cols: g.cols,
      rows: g.rows,
      tileWidth: g.tileWidth,
      tileHeight: g.tileHeight,
    })
  }
  return g
}


type TileRectMap = Map<string, DOMRectReadOnly>

const TILE_LAYOUT_FLIP_MS = 220
const TILE_LAYOUT_FLIP_EPSILON_PX = 0.5
const stageRef = ref<HTMLElement | null>(null)
const stageSize = shallowRef({ width: 0, height: 0 })
const gridRef = ref<HTMLElement | null>(null)
const tileWrapEls = new Map<string, HTMLElement>()
let tileLayoutFlipTimer: ReturnType<typeof window.setTimeout> | null = null
let tileLayoutFlipRaf = 0

function setTileWrapRef(peerId: string, el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLElement) {
    tileWrapEls.set(peerId, el)
    return
  }
  tileWrapEls.delete(peerId)
}

watch(
  stageRef,
  (el, _prev, onCleanup) => {
    if (!el) {
      return
    }
    const update = (): void => {
      const rect = el.getBoundingClientRect()
      if (typeof getComputedStyle === 'undefined') {
        stageSize.value = { width: rect.width, height: rect.height }
        return
      }
      const cs = getComputedStyle(el)
      const pl = parseFloat(cs.paddingLeft) || 0
      const pr = parseFloat(cs.paddingRight) || 0
      const pt = parseFloat(cs.paddingTop) || 0
      const pb = parseFloat(cs.paddingBottom) || 0
      stageSize.value = {
        width: Math.max(0, rect.width - pl - pr),
        height: Math.max(0, rect.height - pt - pb),
      }
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    onCleanup(() => {
      ro.disconnect()
    })
  },
  { immediate: true, flush: 'post' },
)

const tileLayoutAnimationKey = computed(() =>
  [
    layoutMode.value,
    spotlightPeerId.value ?? '',
    orderedTiles.value.map((tile) => tile.peerId).join(','),
    Math.round(stageSize.value.width),
    Math.round(stageSize.value.height),
  ].join('|'),
)

function readTileRects(): TileRectMap {
  const rects: TileRectMap = new Map()
  for (const [peerId, el] of tileWrapEls) {
    rects.set(peerId, el.getBoundingClientRect())
  }
  return rects
}

function clearTileFlip(el: HTMLElement): void {
  el.classList.remove('call-page__tile-wrap--flip-prepare', 'call-page__tile-wrap--flipping')
  el.style.removeProperty('--tile-flip-x')
  el.style.removeProperty('--tile-flip-y')
  el.style.removeProperty('--tile-flip-scale-x')
  el.style.removeProperty('--tile-flip-scale-y')
}

function clearAllTileFlips(): void {
  if (typeof window !== 'undefined') {
    window.cancelAnimationFrame(tileLayoutFlipRaf)
    if (tileLayoutFlipTimer != null) {
      window.clearTimeout(tileLayoutFlipTimer)
      tileLayoutFlipTimer = null
    }
  }
  for (const el of tileWrapEls.values()) {
    clearTileFlip(el)
  }
}

function playTileLayoutFlip(firstRects: TileRectMap): void {
  if (typeof window === 'undefined') {
    return
  }
  window.cancelAnimationFrame(tileLayoutFlipRaf)
  if (tileLayoutFlipTimer != null) {
    window.clearTimeout(tileLayoutFlipTimer)
    tileLayoutFlipTimer = null
  }

  void nextTick(() => {
    const animated: HTMLElement[] = []
    for (const [peerId, lastEl] of tileWrapEls) {
      const first = firstRects.get(peerId)
      if (!first) {
        continue
      }
      const last = lastEl.getBoundingClientRect()
      if (first.width <= 0 || first.height <= 0 || last.width <= 0 || last.height <= 0) {
        continue
      }

      const dx = first.left - last.left
      const dy = first.top - last.top
      const sx = first.width / last.width
      const sy = first.height / last.height
      const moved = Math.abs(dx) > TILE_LAYOUT_FLIP_EPSILON_PX || Math.abs(dy) > TILE_LAYOUT_FLIP_EPSILON_PX
      const resized = Math.abs(1 - sx) > 0.01 || Math.abs(1 - sy) > 0.01
      if (!moved && !resized) {
        continue
      }

      lastEl.classList.add('call-page__tile-wrap--flip-prepare')
      lastEl.style.setProperty('--tile-flip-x', `${dx}px`)
      lastEl.style.setProperty('--tile-flip-y', `${dy}px`)
      lastEl.style.setProperty('--tile-flip-scale-x', String(sx))
      lastEl.style.setProperty('--tile-flip-scale-y', String(sy))
      animated.push(lastEl)
    }

    if (animated.length === 0) {
      return
    }

    void gridRef.value?.offsetWidth

    tileLayoutFlipRaf = window.requestAnimationFrame(() => {
      for (const el of animated) {
        el.classList.remove('call-page__tile-wrap--flip-prepare')
        el.classList.add('call-page__tile-wrap--flipping')
        el.style.setProperty('--tile-flip-x', '0px')
        el.style.setProperty('--tile-flip-y', '0px')
        el.style.setProperty('--tile-flip-scale-x', '1')
        el.style.setProperty('--tile-flip-scale-y', '1')
      }

      tileLayoutFlipTimer = window.setTimeout(() => {
        for (const el of animated) {
          clearTileFlip(el)
        }
        tileLayoutFlipTimer = null
      }, TILE_LAYOUT_FLIP_MS + 60)
    })
  })
}

watch(
  tileLayoutAnimationKey,
  () => {
    if (dragPeerId.value != null) {
      return
    }
    const firstRects = readTileRects()
    if (firstRects.size > 0) {
      playTileLayoutFlip(firstRects)
    }
  },
  { flush: 'pre' },
)

watch(
  () => orderedTiles.value.map((tile) => tile.peerId).join('|'),
  () => {
    clearAllTileFlips()
  },
  { flush: 'pre' },
)

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
  const mafiaNicknames = mafiaNicknameOverrideByPeerId.value
  return orderedTiles.value.map((tile) => {
    const ov = overrides[tile.peerId]
    if (typeof ov === 'string' && normalizeDisplayName(ov)) {
      return { tile, displayName: normalizeDisplayName(ov).slice(0, 64) }
    }
    if (isMafiaRoute.value) {
      const n = mafiaNicknames[tile.peerId]
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

function remoteAudioLevelForPeer(peerId: string): number {
  return audioLevelsByPeerId.value[peerId] ?? 0
}

function isRemoteVoiceDucked(peerId: string): boolean {
  const dominant = dominantSpeakerPeerId.value
  return dominant !== null && dominant !== peerId
}


function resumeCallAudioAnalysisFromGesture(): void {
  void getAudioAnalysisAudioContext().resume().catch(() => {})
}


function isEatFirstHostSpeakingNominationSeat(seat: number | undefined): boolean {
  if (seat == null) {
    return false
  }
  return nominationTargetSeatsFromSpeakingFlat(eatFirstShell.speakingQueue).has(seat)
}

/**
 * Tile-click router across all three call routes.
 *
 * The EatFirst speaking-mode branch (host-only nomination toggle) remains
 * inline here because it reads `eatFirstShell` state owned by the EatFirst
 * domain in CallPage's setup. The Mafia branch (swap / speaking / night
 * action) is delegated to `useMafiaCallHostUi.handleMafiaHostTileClick`.
 *
 * Behaviour preserved 1:1: same guards, same `ev.stopPropagation()`
 * semantics, same toast keys, same store dispatch order.
 */
function onMafiaHostTileClick(ev: MouseEvent, row: (typeof orderedGridRows.value)[number]): void {
  if (isEatFirstRoute.value && !eatFirstViewUi.value && eatFirstShell.isEatFirstRoomHost) {
    if (!eatFirstShell.speakingMode) {
      return
    }
    const clickTarget = ev.target
    if (clickTarget instanceof Element) {
      if (clickTarget.closest('button, input, textarea, a, [data-no-mafia-tile-host]')) {
        return
      }
      if (clickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
        return
      }
    }
    const seat = eatFirstNominationNumberForPeer(row.tile.peerId)
    if (seat == null) {
      return
    }
    const draft = eatFirstShell.speakingNominationDraftBySeat
    if (draft == null) {
      eatFirstShell.setSpeakingNominationDraftBySeat(seat)
    } else if (draft === seat) {
      eatFirstShell.setSpeakingNominationDraftBySeat(null)
    } else {
      eatFirstShell.appendSpeakingNominationPair(draft, seat)
    }
    ev.stopPropagation()
    return
  }
  handleMafiaHostTileClick(ev, row)
}

function refreshMafiaPlayersState(): void {
  if (!isMafiaRoute.value) {
    mafiaPlayersStore.clearPlayerRowsForUi()
    if (isEatFirstRoute.value) {
      mafiaGameStore.prunePlayerOverlayStateToPeerIds(tiles.value.map((t) => t.peerId))
    } else {
      mafiaGameStore.clearWhenLeavingMafiaRoute()
    }
    return
  }
  if (mafiaGameStore.isApplyingMafiaReshuffle) {
    const engine = tileOrder.value
    const order = mafiaGameStore.getDisplayNumberingOrder(engine)
    const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : ''
    const hostPeerId =
      explicitHostPeerId.length > 0
        ? explicitHostPeerId
        : order.length > 0
          ? order[order.length - 1] ?? ''
          : ''
    const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order
    mafiaPlayersStore.setPlayerRowsDisplay(
      playersOnly.map((peerId, i) => ({
        peerId,
        number: i + 1,
        displayName: peerDisplayName(peerId),
      })),
    )
    return
  }
  mafiaPlayersStore.syncWithPeers(session.roomId, tiles.value.map((t) => t.peerId))
  const engine = tileOrder.value
  mafiaGameStore.reconcileNumberingWithEngine(engine)
  mafiaGameStore.pruneGameStateToPeers(engine)
  const order = mafiaGameStore.getDisplayNumberingOrder(engine)
  const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : ''
  const hostPeerId =
    explicitHostPeerId.length > 0
      ? explicitHostPeerId
      : order.length > 0
        ? order[order.length - 1] ?? ''
        : ''
  const seatCount = hostPeerId.length > 0 && order.includes(hostPeerId) ? order.length - 1 : order.length
  mafiaGameStore.pruneNightActionsToMaxSeat(seatCount)
  if (mafiaGameStore.isMafiaHost) {
    mafiaGameStore.pruneSpeakingQueueToMaxSeat(seatCount)
  }
  const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order
  mafiaPlayersStore.setPlayerRowsDisplay(
    playersOnly.map((peerId, i) => ({
      peerId,
      number: i + 1,
      displayName: peerDisplayName(peerId),
    })),
  )
}

/**
 * Stable scalar key for `refreshMafiaPlayersState`. Replaces the previous
 * `deep: true` watcher over `[tiles, orderedGridRows, nightActions, speakingQueue]`
 * which fired on every audio-level / tile-reorder / speaker-change tick (3-5/s
 * in active mafia discussion at 8-12 cameras) and re-ran the full reconcile
 * pass even when no peer-set / numbering / queue change had actually occurred.
 *
 * `refreshMafiaPlayersState` only consumes:
 *   - peerIds from `tiles.value` (set membership)
 *   - `mafiaGameStore.numberingKey` (engine ordering)
 *   - `mafiaGameStore.speakingQueue` (length / contents)
 *   - `isApplyingMafiaReshuffle` (branch selector)
 * It does NOT read `orderedGridRows.value` or `mafiaGameStore.nightActions`
 * content; nightActions are pruned by max-seat which is derived from peer count.
 *
 * The function itself is idempotent so an extra run on an unrelated mafia state
 * change would only waste CPU, not produce a wrong result.
 */
const mafiaPlayersWatcherKey = computed(() => {
  if (!isMafiaRoute.value) {
    return `off|${session.roomId}`
  }
  const peerIds: string[] = []
  for (const t of tiles.value) {
    peerIds.push(t.peerId)
  }
  const queue = mafiaGameStore.speakingQueue.join(',')
  return [
    'on',
    session.roomId,
    peerIds.join('|'),
    mafiaGameStore.numberingKey,
    queue,
    mafiaGameStore.isApplyingMafiaReshuffle ? '1' : '0',
  ].join('::')
})

watch(
  mafiaPlayersWatcherKey,
  () => {
    void refreshMafiaPlayersState()
  },
  { immediate: true },
)

watch(
  () =>
    [
      isEatFirstRoute.value,
      eatFirstShell.isEatFirstRoomHost,
      eatFirstViewUi.value,
    ] as const,
  ([eat, host, view]) => {
    mafiaGameStore.setEatFirstCallEliminationHost(eat && host && !view)
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
  if (spotlightDesktopMediaQuery) {
    spotlightDesktopMediaQuery.removeEventListener('change', syncSpotlightDesktop)
    spotlightDesktopMediaQuery = null
  }
  if (typeof window !== 'undefined') {
    window.cancelAnimationFrame(tileLayoutFlipRaf)
    if (tileLayoutFlipTimer != null) {
      window.clearTimeout(tileLayoutFlipTimer)
      tileLayoutFlipTimer = null
    }
  }
  clearFullPowerEnterTimer()
  isFullPowerMode.value = false
  remotePlaybackWaitingPeerIds.value = new Set()
  if (roomCopyFlashTimer !== null) {
    clearTimeout(roomCopyFlashTimer)
    roomCopyFlashTimer = null
  }
  // The Mafia speaking-hint timer is owned by `useMafiaSpeakingHint`
  // (inside `MafiaCallAdapter`); the composable's own `onBeforeUnmount`
  // clears it. A leftover reference here from before the Phase 2A
  // extraction was throwing a `ReferenceError` at unmount and aborting
  // the rest of this hook — including `leaveCall()` below.
  for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
    clearRemoteVideoSuppressTimer(pid)
  }
  remoteVideoPlaybackSuppressed.value = new Map()
  callRoomHeaderJoin.reset()
  mafiaPlayersStore.reset()
  mafiaGameStore.fullReset()
  // Leaving /call must teardown media; otherwise Pinia session stays inCall.
  leaveCall()
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    spotlightDesktopMediaQuery = window.matchMedia(SPOTLIGHT_DESKTOP_MEDIA)
    syncSpotlightDesktop()
    spotlightDesktopMediaQuery.addEventListener('change', syncSpotlightDesktop)
  }
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
  window.addEventListener(MAFIA_OBS_URL_TOAST_EVENT, onMafiaObsUrlCopiedToast)
  window.addEventListener(EAT_FIRST_OBS_URL_TOAST_EVENT, onEatFirstObsUrlCopiedToast)
  window.addEventListener(MAFIA_SETTINGS_TOAST_EVENT, onMafiaSettingsToast)
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
  setMediaDebugEnvInfo({
    isMafiaView: mafiaViewUi.value,
    isEatFirstView: eatFirstViewUi.value,
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
  window.removeEventListener(MAFIA_OBS_URL_TOAST_EVENT, onMafiaObsUrlCopiedToast)
  window.removeEventListener(EAT_FIRST_OBS_URL_TOAST_EVENT, onEatFirstObsUrlCopiedToast)
  window.removeEventListener(MAFIA_SETTINGS_TOAST_EVENT, onMafiaSettingsToast)
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
          'call-page__active--with-dock': (session.inCall || joining) && !mafiaViewUi && !eatFirstViewUi,
          'call-page__active--with-mafia-bottom': isMafiaRoute && (session.inCall || joining) && !mafiaViewUi,
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
          The Mafia "speaking order" hint toast lives on
          `MafiaCallAdapter.vue`, mounted from `MafiaPage` as a sibling of
          `<CallPage>`. Its CSS positioning is `position: fixed` (top: 4.75rem;
          right: 1rem; z-index: 110) so rendering from a different DOM
          ancestor does not change visual placement.
        -->

        <div
          v-if="session.inCall && !mafiaViewUi && !eatFirstViewUi && callChatInboundToasts.length > 0"
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
              :draggable="!mafiaViewUi && !isMafiaRoute && !isEatFirstRoute"
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
                'call-page__tile-wrap--mafia-host-target':
                  isMafiaRoute &&
                  !mafiaViewUi &&
                  mafiaGameStore.isMafiaHost &&
                  mafiaGameStore.hostInteractionMode === 'night' &&
                  isMafiaHostNightActionSeat(mafiaNumberByPeer.get(row.tile.peerId)),
                'call-page__tile-wrap--mafia-host-speaking-queued':
                  isMafiaRoute &&
                  isMafiaHostSpeakingNominationUiSeat(mafiaNumberByPeer.get(row.tile.peerId)),
                'call-page__tile-wrap--eat-first-host-speaking-seat':
                  isEatFirstRoute &&
                  !eatFirstViewUi &&
                  isEatFirstHostSpeakingNominationSeat(eatFirstNominationNumberForPeer(row.tile.peerId)),
                'call-page__tile-wrap--mafia-host-mode': isMafiaRoute && !mafiaViewUi && mafiaGameStore.isMafiaHost,
                'call-page__tile-wrap--mafia-host-mode-speaking':
                  isMafiaRoute &&
                  !mafiaViewUi &&
                  mafiaGameStore.isMafiaHost &&
                  mafiaGameStore.hostInteractionMode === 'speaking',
                'call-page__tile-wrap--mafia-host-mode-swap':
                  isMafiaRoute &&
                  !mafiaViewUi &&
                  mafiaGameStore.isMafiaHost &&
                  mafiaGameStore.hostInteractionMode === 'swap',
                'call-page__tile-wrap--mafia-swap-selected':
                  isMafiaRoute &&
                  !mafiaViewUi &&
                  mafiaGameStore.isMafiaHost &&
                  mafiaGameStore.hostInteractionMode === 'swap' &&
                  mafiaGameStore.hostSeatSwapSelectionPeerId === row.tile.peerId,
                'call-page__tile-wrap--mafia-cursor-default':
                  isMafiaRoute && (mafiaViewUi || !mafiaGameStore.isMafiaHost),
                'call-page__tile-wrap--speaking': isTileRowSpeaking(row),
              }"
              @pointerdown.capture="onTilePointerDownForDrag"
              @click="onMafiaHostTileClick($event, row)"
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
                :mafia-seat-index="
                  isMafiaRoute
                    ? mafiaNumberByPeer.get(row.tile.peerId)
                    : isEatFirstRoute
                      ? eatFirstDisplayOrderByPeer.get(row.tile.peerId)
                      : undefined
                "
                :mafia-visible-role="
                  isMafiaRoute && !mafiaViewUi ? mafiaGameStore.getMafiaRoleVisibleForTile(row.tile.peerId) : undefined
                "
                :stream-view-mode="mafiaViewUi || eatFirstViewUi"
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
                :remote-audio-level="remoteAudioLevelForPeer(row.tile.peerId)"
                :remote-voice-ducked="isRemoteVoiceDucked(row.tile.peerId)"
                :raise-hand="Boolean(row.tile.handRaised)"
                :video-presentation="row.tile.videoPresentation"
                :avatar-url="row.tile.avatarUrl ?? ''"
                :mafia-life-state="
                  isMafiaRoute || isEatFirstRoute ? mafiaGameStore.lifeStateForPeer(row.tile.peerId) : 'alive'
                "
                :eat-first-traits="isEatFirstRoute ? eatFirstTraitsForPeer(row.tile.peerId) : undefined"
                :eat-first-trait-host-view="isEatFirstRoute ? eatFirstTraitHostView() : false"
                :eat-first-trait-owner-view="isEatFirstRoute ? eatFirstTraitOwnerView(row.tile.peerId) : false"
                :eat-first-revealed-trait-keys="isEatFirstRoute ? eatFirstRevealedTraitsForPeer(row.tile.peerId) : []"
                :eat-first-action-card="isEatFirstRoute ? eatFirstActionCardForPeer(row.tile.peerId) : null"
                :mafia-elimination-kind="mafiaEliminationAvatarKindForPeerId(row.tile.peerId)"
                :mafia-elimination-background="mafiaGameStore.eliminationBackgroundForPeer(row.tile.peerId)"
                :mafia-dead-background-url="
                  isMafiaRoute || isEatFirstRoute ? mafiaGameStore.activeDeadBackgroundUrl() : null
                "
                :mafia-host-show-life-toggle="
                  (isMafiaRoute && !mafiaViewUi && mafiaGameStore.isMafiaHost) ||
                  (isEatFirstRoute && !eatFirstViewUi && eatFirstShell.isEatFirstRoomHost)
                "
                :mafia-layer-viewport-observe="isCallAppRoute && !row.tile.isLocal"
                :video-playback-suppressed="
                  !row.tile.isLocal && videoPlaybackSuppressedForPeer(row.tile.peerId)
                "
                :video-target-playback-fps="remoteVideoTargetPlaybackFpsForPeer(row.tile.peerId)"
                @update:listen-volume="(v) => remoteListenVolumeHandler(row.tile.peerId)(v)"
                @update:listen-muted="(v) => remoteListenMutedHandler(row.tile.peerId)(v)"
                @commit-local-display-name="onCommitLocalTileDisplayName"
                @mafia-toggle-life="onMafiaToggleLifeFromTile(row.tile.peerId)"
                @mafia-force-camera-off="onMafiaForceCameraOffFromTile(row.tile.peerId)"
                @mafia-set-elimination-background="onMafiaSetEliminationBackground"
                @mafia-viewport-layers="(v) => onCallTileViewportForLayers(row.tile.peerId, v)"
                @remote-playback-stall="onRemotePlaybackStall"
                @video-stall="onTileVideoStall"
                @audio-stall="onTileAudioStall"
                @eat-first-reveal-trait="onEatFirstRevealTrait"
                @eat-first-generate-trait="onEatFirstGenerateTrait"
                @eat-first-reroll-action-card="onEatFirstRerollActionCard"
                @eat-first-use-action-card="onEatFirstPlayerUseActionCard"
              />
              <button
                v-if="!mafiaViewUi && !eatFirstViewUi"
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
                  :src="pinnedPeerId === row.tile.peerId ? mafiaTilePinActiveIcon : mafiaTilePinIcon"
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
          v-if="(session.inCall || joining) && !mafiaViewUi && !eatFirstViewUi"
          class="call-page__bottom-cluster"
        >
          <div
            class="call-page__bottom-cluster__left call-page__bottom-cluster__left--empty"
            aria-hidden="true"
          />
          <div
            class="call-page__bottom-cluster__center call-page__bottom-cluster__center--speak-dock"
          >
            <MafiaHostActionsBar
              v-if="isMafiaRoute && mafiaGameStore.isMafiaHost"
              @force-mute-all="onMafiaForceMuteAll"
            />
            <EatFirstHostActionsBar
              v-if="isEatFirstRoute && eatFirstShell.isEatFirstRoomHost"
              @force-mute-all="onEatFirstForceMuteAll"
              @reshuffle="onEatFirstReshuffle"
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
            <MafiaSpeakingQueueBar v-if="isMafiaRoute" :show-tools="mafiaGameStore.isMafiaHost" />
            <EatFirstSpeakingQueueBar v-if="isEatFirstRoute" :show-tools="eatFirstShell.isEatFirstRoomHost" />
          </div>
        </div>
        <div
          v-if="(session.inCall || joining) && mafiaViewUi && isMafiaRoute"
          class="call-page__mafia-view-bottom"
        >
          <MafiaSpeakingQueueBar :show-tools="false" />
        </div>

        <CallChatPanel
          v-if="session.inCall && !mafiaViewUi && !eatFirstViewUi"
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
          v-if="session.callDebugOverlay && showCallDebugControls && !mafiaViewUi && !eatFirstViewUi"
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

<style src="./CallPage.css"></style>
