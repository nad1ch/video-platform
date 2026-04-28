<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
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

const callPageLog = createLogger('call-page')
import ParticipantTile from './ParticipantTile.vue'
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
import {
  mafiaBaseRoomIdFromSignaling,
  mafiaSignalingRoomId,
  MAFIA_SIGNALING_ROOM_PREFIX,
} from '@/composables/useMafiaMediaRoom'
import MafiaSpeakingQueueBar from '@/components/mafia/MafiaSpeakingQueueBar.vue'
import MafiaHostActionsBar from '@/components/mafia/MafiaHostActionsBar.vue'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import { mafiaEliminationAvatarKindForPeerId } from '@/utils/mafiaEliminationAvatarKind'
import { MAFIA_OBS_URL_TOAST_EVENT, MAFIA_SETTINGS_TOAST_EVENT } from '@/composables/mafiaStreamViewRoute'
import mafiaTilePinActiveIcon from '@/assets/mafia/ui/tile-pin-active.svg'
import type { MafiaEliminationBackground } from '@/utils/mafiaGameTypes'

type VideoQualityUiChoice = 'auto' | VideoQualityPreset

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, ensureAuthLoaded, isAdmin } = useAuth()

const CALL_ROUTE_HTML_CLASS = 'sa-call-route'

/**
 * `/app/call` and `/app/mafia` share one `CallPage` (video + orchestrator).
 * Isolation: see `useMafiaMediaRoom.ts` (signaling id) + `refreshMafiaPlayersState` (clears mafia when `route.name !== 'mafia'`).
 */
const isCallAppRoute = computed(() => route.name === 'call' || route.name === 'mafia')
const isMafiaRoute = computed(() => route.name === 'mafia')

const props = withDefaults(
  defineProps<{
    /** Mafia `?mode=view` from parent: minimal UI for stream capture. */
    mafiaStreamView?: boolean
  }>(),
  { mafiaStreamView: false },
)
/** Mafia stream layout: no dock, no host tile actions, no per-tile menus / rename. */
const mafiaViewUi = computed(() => isMafiaRoute.value && props.mafiaStreamView)

/**
 * Mafia `?mode=view` (OBS / Browser Source): recv-only in call-core — no camera/mic publish
 * (`wireCallMediaAfterRoomState` skips send transport for `viewer`). `/app/call` stays `participant`.
 */
const callEngineRole = computed((): CallEngineRole => (mafiaViewUi.value ? 'viewer' : 'participant'))

watch(
  () => isCallAppRoute.value,
  (onCallShell) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle(CALL_ROUTE_HTML_CLASS, onCallShell)
  },
  { immediate: true },
)

/** Manual video quality: backend `role === 'admin'` (see ADMIN_EMAILS / ADMIN_TWITCH_IDS on server). */
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

/** Debug overlay UI: admins always; in dev also local engineers (no secret in URL). */
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
  toggleMic,
  toggleCam,
  audioInputDevices,
  videoInputDevices,
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
} = useCallOrchestrator({ allowManualVideoQuality, joinAvatarUrl, joinUserId, role: callEngineRole })

/** Peers with an active `<video>` `waiting` stall (fast signal — see StreamVideo). */
const remotePlaybackWaitingPeerIds = shallowRef(new Set<string>())

function onRemotePlaybackStall(payload: { peerId: string; stalling: boolean }): void {
  const id = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  if (!id) {
    return
  }
  const next = new Set(remotePlaybackWaitingPeerIds.value)
  if (payload.stalling) {
    next.add(id)
  } else {
    next.delete(id)
  }
  remotePlaybackWaitingPeerIds.value = next
}

watch(
  () => tiles.value.map((t) => `${t.peerId}:${t.isLocal ? 'L' : 'R'}`).join('|'),
  () => {
    const remoteIds = new Set(tiles.value.filter((t) => !t.isLocal).map((t) => t.peerId))
    const stale = [...remotePlaybackWaitingPeerIds.value].some((id) => !remoteIds.has(id))
    if (!stale) {
      return
    }
    remotePlaybackWaitingPeerIds.value = new Set(
      [...remotePlaybackWaitingPeerIds.value].filter((id) => remoteIds.has(id)),
    )
  },
  { flush: 'post' },
)

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

/**
 * Full-power unlock applies only on `strong` receive profile (Step 2).
 * Enter after sustained health; exit immediately on any non-`good` pressure (Step 6).
 */
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
        routeName: route.name,
        isMafiaRoute: isMafiaRoute.value,
      })
    },
    { immediate: true },
  )
}

useMafiaHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus)

const { selfPeerId, selfDisplayName, remoteDisplayNames } = storeToRefs(session)

const MAFIA_FORCE_CAMERA_OFF_SIGNAL = 'mafia:force-camera-off'
const MAFIA_FORCE_MUTE_ALL_SIGNAL = 'mafia:force-mute-all'

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
})

onBeforeUnmount(offMafiaForceControls)

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

/** SSOT for call UI names: tiles + remote-only peers (see `buildCallParticipantMap`). */
const participantsByPeerId = computed(() =>
  buildCallParticipantMap(tiles.value, { ...remoteDisplayNames.value }, selfPeerId.value),
)

/** Precomputed labels per known peer — avoids N× `resolvePeerDisplayNameForUi` on unrelated re-renders (large grids). */
const displayNameUiByPeerId = computed(() =>
  buildDisplayNameUiMap(participantsByPeerId.value, {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }),
)

/** Local-only tile labels (persists in localStorage). */
const localTileDisplayOverrides = shallowRef<Record<string, string>>(loadCallTileLocalDisplayOverrides())

function onCommitLocalTileDisplayName(payload: { peerId: string; name: string | null }): void {
  const id = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
  if (!id) {
    return
  }
  const next = { ...localTileDisplayOverrides.value }
  const t = payload.name != null ? normalizeDisplayName(payload.name).slice(0, 64) : ''
  if (!t) {
    delete next[id]
  } else {
    next[id] = t
  }
  localTileDisplayOverrides.value = next
  saveCallTileLocalDisplayOverrides(next)
}

/** Single resolver: cache hit for peers in map; fallback for chat lines whose peer left the map. */
function peerDisplayName(peerId: string): string {
  const o = localTileDisplayOverrides.value[peerId]
  if (typeof o === 'string' && normalizeDisplayName(o)) {
    return normalizeDisplayName(o).slice(0, 64)
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

/** Stable handlers so grid re-renders do not allocate new fns per tile per frame. */
const remoteListenVolumeByPeer = new Map<string, (v: number) => void>()
const remoteListenMutedByPeer = new Map<string, (v: boolean) => void>()

function remoteListenVolumeHandler(peerId: string) {
  let h = remoteListenVolumeByPeer.get(peerId)
  if (!h) {
    h = (v: number) => {
      setRemoteListenVolume(peerId, v)
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
    }
    remoteListenMutedByPeer.set(peerId, h)
  }
  return h
}

/** Deduplicated tile IntersectionObserver; fixed-quality calls keep all remote videos active. */
const callTileViewportVisibleByPeer = shallowRef(new Map<string, boolean>())

const remoteVideoSuppressDelayTimerByPeer = new Map<string, ReturnType<typeof setTimeout>>()
/** Why a pending suppress timer was scheduled — reschedule if offscreen vs budget flips. */
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

watch(
  () => ({
    allow: receiveDeviceProfile.value.allowRenderSuppression,
    fullPower: isFullPowerMode.value,
    tilesKey: tiles.value.map((t) => `${t.peerId}:${t.isLocal ? 'L' : 'R'}`).join('|'),
    viewport: callTileViewportVisibleByPeer.value,
    uiSpeaker: activeSpeakerPeerId.value,
    srvSpeaker: serverActiveSpeakerPeerId.value,
  }),
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

/** Only the last presence event drives toasts; avoid deep watch on the whole array. */
watch(
  () => callPresenceMessages.value[callPresenceMessages.value.length - 1]?.id,
  () => {
    const msgs = callPresenceMessages.value
    const last = msgs[msgs.length - 1]
    if (!last || last.id === lastPresenceToastSourceId) {
      return
    }
    lastPresenceToastSourceId = last.id
    /** Snapshot from engine at event time (stable for leave toasts if map updates before toast). */
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

function onMafiaToggleLifeFromTile(peerId: string): void {
  if (typeof peerId !== 'string' || peerId.length < 1) {
    return
  }
  mafiaGameStore.hostToggleMafiaPlayerLife(peerId)
}

function onMafiaForceCameraOffFromTile(peerId: string): void {
  if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
    return
  }
  if (typeof peerId !== 'string' || peerId.length < 1 || peerId === selfPeerId.value) {
    return
  }
  sendSignalingMessage({ type: MAFIA_FORCE_CAMERA_OFF_SIGNAL, payload: { peerId } })
}

function onMafiaForceMuteAll(muted: boolean): void {
  if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
    return
  }
  sendSignalingMessage({ type: MAFIA_FORCE_MUTE_ALL_SIGNAL, payload: { muted } })
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

const micPickerOpen = ref(false)
const camPickerOpen = ref(false)
type CallControlsDockExpose = { containsDevicePickerTarget(target: Node): boolean }
const callControlsDockRef = ref<CallControlsDockExpose | null>(null)
const roomJoinDraft = ref('')
const roomCopyFlash = ref(false)
let roomCopyFlashTimer: ReturnType<typeof setTimeout> | null = null
/** Join only after auth is ready (same ordering as the old pre-join form). */
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

/** Shown in UI, copied, and in `?room=` — without `mafia:` (Mafia still joins `mafia:` + this in the session). */
function displayCallOrMafiaRoomCode(): string {
  const raw = normalizeDisplayName(session.roomId) || 'demo'
  if (isMafiaRoute.value) {
    return mafiaBaseRoomIdFromSignaling(raw)
  }
  return raw
}

/**
 * Keep `session.roomId` consistent with the route: Mafia → `mafia:<base>`, Call → never `mafia:`.
 * Switching between `/app/call` and `/app/mafia` then uses separate mediasoup rooms for the same base code.
 */
function normalizeSessionRoomIdForStreamRoute(): void {
  if (!isCallAppRoute.value) {
    return
  }
  const s = normalizeDisplayName(session.roomId) || 'demo'
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
}

async function switchToRoom(nextRaw: string, opts?: { fromRoute?: boolean }): Promise<void> {
  const base = normalizeDisplayName(nextRaw) || 'demo'
  const signalingId = isMafiaRoute.value ? mafiaSignalingRoomId(base) : base
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
      const name = route.name === 'mafia' ? 'mafia' : 'call'
      await router.replace({ name, query: { ...route.query, room: base } })
    } catch {
      /* ignore */
    }
  }
  callRoomHeaderJoin.closeRoomPopover()
  await joinCall()
}

watch(
  () => [route.name, route.query.room, callAuthReady.value] as const,
  async () => {
    if (!callAuthReady.value || !isCallAppRoute.value) {
      return
    }
    normalizeSessionRoomIdForStreamRoute()
    const q = typeof route.query.room === 'string' ? normalizeDisplayName(route.query.room) : ''
    if (!q) {
      if (!session.inCall && !joining.value) {
        try {
          await router.replace({
            name: route.name as 'call' | 'mafia',
            query: { ...route.query, room: generateCallRoomCode() },
          })
        } catch {
          /* ignore */
        }
      }
      return
    }
    const currentSignaling = normalizeDisplayName(session.roomId) || 'demo'
    const qSignaling = isMafiaRoute.value ? mafiaSignalingRoomId(q) : q
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
  () => session.inCall && (audioInputDevices.value.length > 0 || videoInputDevices.value.length > 0),
)

function closeMediaDevicePickers(): void {
  micPickerOpen.value = false
  camPickerOpen.value = false
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
  if (!micPickerOpen.value && !camPickerOpen.value) {
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
    const ids = list.map((t) => t.peerId)
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

/** 1-based seat for each `peerId` (numbering from game store, or join order before reshuffle). */
const mafiaNumberByPeer = computed(() => {
  if (!isMafiaRoute.value) {
    return new Map<string, number>()
  }
  const m = new Map<string, number>()
  const order = mafiaGameStore.getDisplayNumberingOrder(mafiaPlayersStore.joinOrder)
  order.forEach((id, i) => {
    m.set(id, i + 1)
  })
  return m
})

const orderedTiles = computed(() => {
  const list = tiles.value.slice()
  if (isMafiaRoute.value && list.length > 0) {
    const seats = mafiaNumberByPeer.value
    return [...list].sort((a, b) => {
      const sa = seats.get(a.peerId)
      const sb = seats.get(b.peerId)
      if (sa != null && sb != null && sa !== sb) {
        return sa - sb
      }
      if (sa != null && sb == null) {
        return -1
      }
      if (sa == null && sb != null) {
        return 1
      }
      return 0
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

/** Pixels; must match `gap` in `gridStyle`. */
const GAP = 12
const MIN_TILE_WIDTH = 180

/**
 * Matches `.call-page__grid { padding: 6px }` — total inset per axis (left+right / top+bottom)
 * so tile layout matches the content box inside padded grid (room for drag/hover ring).
 */
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

/** Call stage (not the inner grid) — ResizeObserver + content-box size matches real tile area. */
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

/** One name-resolution pass per grid row when order/tiles/participants change (large grids). */
const orderedGridRows = computed(() => {
  const participants = participantsByPeerId.value
  const opts = {
    selfPeerId: selfPeerId.value,
    selfDisplayName: selfDisplayName.value,
  }
  const names = displayNameUiByPeerId.value
  const overrides = localTileDisplayOverrides.value
  return orderedTiles.value.map((tile) => {
    const ov = overrides[tile.peerId]
    if (typeof ov === 'string' && normalizeDisplayName(ov)) {
      return { tile, displayName: normalizeDisplayName(ov).slice(0, 64) }
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

/** User gesture: keep shared analysis AudioContext un-suspended so VAD + local RMS work after join. */
function resumeCallAudioAnalysisFromGesture(): void {
  void getAudioAnalysisAudioContext().resume().catch(() => {})
}

/** Explicit deps so host tile highlight updates immediately when `nightActions` / queue refs change. */
const mafiaHostNightActionSeatSet = computed(() => {
  const a = mafiaGameStore.nightActions
  const s = new Set<number>()
  for (const x of [a.mafia, a.doctor, a.sheriff, a.don] as const) {
    if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
      s.add(x)
    }
  }
  return s
})

const mafiaHostSpeakingQueueSeatSet = computed(
  () => new Set(mafiaGameStore.speakingQueue),
)

function isMafiaHostNightActionSeat(seat: number | undefined): boolean {
  if (seat == null) {
    return false
  }
  return mafiaHostNightActionSeatSet.value.has(seat)
}

function isMafiaHostSpeakingQueuedSeat(seat: number | undefined): boolean {
  if (seat == null) {
    return false
  }
  return mafiaHostSpeakingQueueSeatSet.value.has(seat)
}

function onMafiaHostTileClick(ev: MouseEvent, row: (typeof orderedGridRows.value)[number]): void {
  if (mafiaViewUi.value) {
    return
  }
  if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
    return
  }
  const t = ev.target
  if (t instanceof Element) {
    if (t.closest('button, input, textarea, a, [data-no-mafia-tile-host]')) {
      return
    }
    if (t.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
      return
    }
  }
  if (mafiaGameStore.hostInteractionMode === 'swap') {
    const pid = row.tile.peerId
    const sel = mafiaGameStore.hostSeatSwapSelectionPeerId
    if (sel == null) {
      mafiaGameStore.setSeatSwapSelectionPeerId(pid)
    } else if (sel === pid) {
      mafiaGameStore.setSeatSwapSelectionPeerId(null)
    } else {
      mafiaGameStore.swapSeatsByPeerId(sel, pid)
    }
    ev.stopPropagation()
    return
  }
  const seat = mafiaNumberByPeer.value.get(row.tile.peerId)
  if (seat == null) {
    return
  }
  if (mafiaGameStore.hostInteractionMode === 'speaking') {
    if (mafiaHostSpeakingQueueSeatSet.value.has(seat)) {
      mafiaGameStore.removeSpeakingSeat(seat)
    } else {
      mafiaGameStore.addSpeakingSeatIfNew(seat)
    }
  } else {
    mafiaGameStore.assignOrClearNightActionForActiveRole(seat)
  }
  ev.stopPropagation()
}

function onMafiaSetEliminationBackground(payload: { peerId: string; background: MafiaEliminationBackground }): void {
  mafiaGameStore.setPeerEliminationBackground(payload.peerId, payload.background)
}

const mafiaSpeakingOrderHintVisible = ref(false)
let mafiaSpeakingOrderHintTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => mafiaGameStore.hostInteractionMode,
  (mode, prev) => {
    if (!isMafiaRoute.value || mafiaViewUi.value || !mafiaGameStore.isMafiaHost) {
      return
    }
    if (mode !== 'speaking' || prev == null || prev === 'speaking') {
      return
    }
    mafiaSpeakingOrderHintVisible.value = true
    if (mafiaSpeakingOrderHintTimer != null) {
      clearTimeout(mafiaSpeakingOrderHintTimer)
    }
    mafiaSpeakingOrderHintTimer = setTimeout(() => {
      mafiaSpeakingOrderHintVisible.value = false
      mafiaSpeakingOrderHintTimer = undefined
    }, 4500)
  },
)

function refreshMafiaPlayersState(): void {
  if (!isMafiaRoute.value) {
    mafiaPlayersStore.clearPlayerRowsForUi()
    mafiaGameStore.clearWhenLeavingMafiaRoute()
    return
  }
  if (mafiaGameStore.isApplyingMafiaReshuffle) {
    const engine = mafiaPlayersStore.joinOrder
    const order = mafiaGameStore.getDisplayNumberingOrder(engine)
    mafiaPlayersStore.setPlayerRowsDisplay(
      order.map((peerId, i) => ({
        peerId,
        number: i + 1,
        displayName: peerDisplayName(peerId),
      })),
    )
    return
  }
  mafiaPlayersStore.syncWithPeers(session.roomId, tiles.value.map((t) => t.peerId))
  const engine = mafiaPlayersStore.joinOrder
  mafiaGameStore.reconcileNumberingWithEngine(engine)
  mafiaGameStore.pruneGameStateToPeers(engine)
  const order = mafiaGameStore.getDisplayNumberingOrder(engine)
  mafiaGameStore.pruneNightActionsToMaxSeat(order.length)
  if (mafiaGameStore.isMafiaHost) {
    mafiaGameStore.pruneSpeakingQueueToMaxSeat(order.length)
  }
  mafiaPlayersStore.setPlayerRowsDisplay(
    order.map((peerId, i) => ({
      peerId,
      number: i + 1,
      displayName: peerDisplayName(peerId),
    })),
  )
}

watch(
  () =>
    [
      isMafiaRoute.value,
      session.roomId,
      tiles.value,
      orderedGridRows.value,
      mafiaGameStore.numberingKey,
      mafiaGameStore.nightActions,
      mafiaGameStore.speakingQueue,
    ] as const,
  () => {
    void refreshMafiaPlayersState()
  },
  { deep: true, immediate: true },
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

/** Повна ширина вьюпорта для сітки тільки коли хоча б один учасник з увімкненим відео. */
const stageFullBleed = computed(() => session.inCall && tiles.value.some((t) => t.videoEnabled))

function isTileControlDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(
    target.closest(
      'button,input,select,textarea,label,.tile-menu-cluster,.tile-menu-hoverable,.tile-menu__dropdown',
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
  if (mafiaSpeakingOrderHintTimer != null) {
    clearTimeout(mafiaSpeakingOrderHintTimer)
    mafiaSpeakingOrderHintTimer = undefined
  }
  for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
    clearRemoteVideoSuppressTimer(pid)
  }
  remoteVideoPlaybackSuppressed.value = new Map()
  callRoomHeaderJoin.reset()
  mafiaPlayersStore.reset()
  mafiaGameStore.fullReset()
  /* Вихід з маршруту /call (навігація по сайту) має закривати кімнату й зупиняти медіа, інакше Pinia-сесія лишається inCall. */
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
  window.addEventListener(MAFIA_SETTINGS_TOAST_EVENT, onMafiaSettingsToast)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
  window.removeEventListener('resize', syncChatPanelToViewport)
  stopChatPanelGesture()
  window.removeEventListener(MAFIA_OBS_URL_TOAST_EVENT, onMafiaObsUrlCopiedToast)
  window.removeEventListener(MAFIA_SETTINGS_TOAST_EVENT, onMafiaSettingsToast)
  document.documentElement.classList.remove(CALL_ROUTE_HTML_CLASS)
  if (import.meta.env.DEV) {
    delete (globalThis as unknown as { __CALL_DEBUG__?: unknown }).__CALL_DEBUG__
  }
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
          'call-page__active--with-dock': (session.inCall || joining) && !mafiaViewUi,
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
        <Transition name="call-toast" appear>
          <div
            v-if="mafiaSpeakingOrderHintVisible"
            class="call-page__toast call-page__toast--join call-page__mafia-speak-hint"
            role="status"
          >
            {{ t('mafiaPage.speakingOrderFloatHint') }}
          </div>
        </Transition>

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
              :draggable="!mafiaViewUi && !isMafiaRoute"
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
                  !mafiaViewUi &&
                  isMafiaHostSpeakingQueuedSeat(mafiaNumberByPeer.get(row.tile.peerId)),
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
                :mafia-seat-index="isMafiaRoute ? mafiaNumberByPeer.get(row.tile.peerId) : undefined"
                :mafia-visible-role="
                  isMafiaRoute && !mafiaViewUi ? mafiaGameStore.getMafiaRoleVisibleForTile(row.tile.peerId) : undefined
                "
                :stream-view-mode="mafiaViewUi"
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
                :mafia-life-state="isMafiaRoute ? mafiaGameStore.lifeStateForPeer(row.tile.peerId) : 'alive'"
                :mafia-elimination-kind="mafiaEliminationAvatarKindForPeerId(row.tile.peerId)"
                :mafia-elimination-background="mafiaGameStore.eliminationBackgroundForPeer(row.tile.peerId)"
                :mafia-dead-background-url="isMafiaRoute ? mafiaGameStore.activeDeadBackgroundUrl() : null"
                :mafia-host-show-life-toggle="
                  isMafiaRoute &&
                  !mafiaViewUi &&
                  mafiaGameStore.isMafiaHost
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
              />
              <button
                v-if="!mafiaViewUi"
                type="button"
                class="call-page__pin-btn"
                :class="{ 'call-page__pin-btn--active': pinnedPeerId === row.tile.peerId }"
                :title="pinnedPeerId === row.tile.peerId ? t('callPage.unpinTile') : t('callPage.pinTile')"
                :aria-label="pinnedPeerId === row.tile.peerId ? t('callPage.unpinTile') : t('callPage.pinTile')"
                :aria-pressed="pinnedPeerId === row.tile.peerId"
                @click.stop="togglePin(row.tile.peerId)"
              >
                <img
                  v-if="isMafiaRoute"
                  class="call-page__pin-icon"
                  :src="pinnedPeerId === row.tile.peerId ? mafiaTilePinActiveIcon : mafiaTilePinIcon"
                  alt=""
                  aria-hidden="true"
                />
                <template v-else>
                  {{ pinnedPeerId === row.tile.peerId ? t('callPage.unpinTileShort') : t('callPage.pinTileShort') }}
                </template>
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
          v-if="(session.inCall || joining) && !mafiaViewUi"
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
            <CallControlsDock
              ref="callControlsDockRef"
              v-model:mic-picker-open="micPickerOpen"
              v-model:cam-picker-open="camPickerOpen"
              v-model:chat-open="chatOpen"
              :joining="joining"
              :mic-enabled="micEnabled"
              :cam-enabled="camEnabled"
              :hand-raised="handRaised"
              :screen-sharing="screenSharing"
              :show-media-device-pickers="showMediaDevicePickers"
              :audio-input-devices="audioInputDevices"
              :video-input-devices="videoInputDevices"
              :local-audio-input-device-id="localAudioInputDeviceId"
              :local-video-input-device-id="localVideoInputDeviceId"
              @toggle-mic="toggleMic"
              @toggle-cam="toggleCam"
              @toggle-raise-hand="toggleRaiseHand"
              @toggle-screen-share="toggleScreenShare"
              @leave="leaveCall"
              @pick-audio-input="pickAudioInput"
              @pick-video-input="pickVideoInput"
            />
            <MafiaSpeakingQueueBar v-if="isMafiaRoute" :show-tools="mafiaGameStore.isMafiaHost" />
          </div>
        </div>

        <CallChatPanel
          v-if="session.inCall && !mafiaViewUi"
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
          v-if="session.callDebugOverlay && showCallDebugControls && !mafiaViewUi"
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
