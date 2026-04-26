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
import type { CallChatLine, CallEngineRole } from 'call-core'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  applyFpsRenderPressure,
  buildCallParticipantMap,
  buildDisplayNameUiMap,
  getAudioAnalysisAudioContext,
  normalizeDisplayName,
  resolvePeerDisplayNameForUi,
  useCallOrchestrator,
  VIDEO_QUALITY_PRESETS,
  type FpsRenderPressure,
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
import { computeAllowedRemotePlaybackPeerIds } from './videoPlaybackBudgetPolicy'
import { computeCallVideoGridLayout } from './callVideoGridLayout'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
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
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import { mafiaEliminationAvatarKindForPeerId } from '@/utils/mafiaEliminationAvatarKind'
import { MAFIA_OBS_URL_TOAST_EVENT } from '@/composables/mafiaStreamViewRoute'

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
  setPeerVisible,
  receiveDeviceProfile,
  serverActiveSpeakerPeerId,
  playbackRenderFpsPressureByPeerId,
} = useCallOrchestrator({ allowManualVideoQuality, joinAvatarUrl, role: callEngineRole })

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

/** Deduplicated tile IntersectionObserver → `setPeerVisible` (viewport ordering for simulcast slots; consumers stay open). */
const callTileViewportVisibleByPeer = shallowRef(new Map<string, boolean>())

/** Delay before pausing off-screen remote `<video>` (ms); within 800–1500 band to limit flapping. */
const REMOTE_VIDEO_SUPPRESS_DELAY_MS = 1200
/** Phase 3: visible but outside soft playback budget — longer delay to avoid flapping (1500–2500 band). */
const REMOTE_VIDEO_BUDGET_SUPPRESS_DELAY_MS = 1500

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
  const prof = receiveDeviceProfile.value
  const allow = prof.allowRenderSuppression
  const uiSpeaker = activeSpeakerPeerId.value
  const srvSpeaker = serverActiveSpeakerPeerId.value
  const viewport = callTileViewportVisibleByPeer.value

  if (!allow) {
    for (const pid of [...remoteVideoSuppressDelayTimerByPeer.keys()]) {
      clearRemoteVideoSuppressTimer(pid)
    }
    for (const pid of [...remoteVideoPlaybackSuppressed.value.keys()]) {
      bumpRemotePlaybackSuppressed(pid, false, 'profile-off')
    }
    return
  }

  const remoteWithVideo = tiles.value
    .filter((t) => !t.isLocal && t.videoEnabled)
    .map((t) => t.peerId)
  const remoteIds = new Set(remoteWithVideo)

  const allowed = computeAllowedRemotePlaybackPeerIds({
    remotePeerIdsWithVideo: remoteWithVideo,
    maxActiveRemoteVideos: prof.maxActiveRemoteVideos,
    enableVisiblePlaybackBudget: allow,
    fullPowerUnlock: isFullPowerMode.value,
    serverActiveSpeakerPeerId: srvSpeaker,
    uiActiveSpeakerPeerId: uiSpeaker,
    viewportVisibleByPeerId: viewport,
  })

  for (const peerId of remoteIds) {
    const isSpeaker = peerId === uiSpeaker || peerId === srvSpeaker
    if (isSpeaker) {
      clearRemoteVideoSuppressTimer(peerId)
      bumpRemotePlaybackSuppressed(peerId, false, 'active-speaker')
      continue
    }

    const off = viewport.get(peerId) === false
    const outsideBudget = !allowed.has(peerId)
    const shouldSuppress = off || outsideBudget

    if (!shouldSuppress) {
      clearRemoteVideoSuppressTimer(peerId)
      bumpRemotePlaybackSuppressed(peerId, false, 'budget-allowed')
      continue
    }

    if (remoteVideoPlaybackSuppressed.value.get(peerId) === true) {
      continue
    }

    const kind: 'offscreen' | 'outside-budget' = off ? 'offscreen' : 'outside-budget'
    const delay = kind === 'offscreen' ? REMOTE_VIDEO_SUPPRESS_DELAY_MS : REMOTE_VIDEO_BUDGET_SUPPRESS_DELAY_MS
    const existingKind = remoteVideoSuppressPendingKind.get(peerId)
    if (remoteVideoSuppressDelayTimerByPeer.has(peerId) && existingKind !== kind) {
      clearRemoteVideoSuppressTimer(peerId)
    }
    if (remoteVideoSuppressDelayTimerByPeer.has(peerId) && remoteVideoSuppressPendingKind.get(peerId) === kind) {
      continue
    }

    remoteVideoSuppressPendingKind.set(peerId, kind)
    const timer = window.setTimeout(() => {
      remoteVideoSuppressDelayTimerByPeer.delete(peerId)
      remoteVideoSuppressPendingKind.delete(peerId)
      const stillRemote = tiles.value.some((x) => x.peerId === peerId && !x.isLocal && x.videoEnabled)
      const stillAllow = receiveDeviceProfile.value.allowRenderSuppression
      const stillSpeaker =
        peerId === activeSpeakerPeerId.value || peerId === serverActiveSpeakerPeerId.value
      if (!stillAllow || !stillRemote || stillSpeaker) {
        return
      }
      const vp = callTileViewportVisibleByPeer.value
      const stillOff = vp.get(peerId) === false
      const p = receiveDeviceProfile.value
      const rw = tiles.value.filter((t) => !t.isLocal && t.videoEnabled).map((t) => t.peerId)
      const stillAllowed = computeAllowedRemotePlaybackPeerIds({
        remotePeerIdsWithVideo: rw,
        maxActiveRemoteVideos: p.maxActiveRemoteVideos,
        enableVisiblePlaybackBudget: p.allowRenderSuppression,
        fullPowerUnlock: isFullPowerMode.value,
        serverActiveSpeakerPeerId: serverActiveSpeakerPeerId.value,
        uiActiveSpeakerPeerId: activeSpeakerPeerId.value,
        viewportVisibleByPeerId: vp,
      })
      if (stillOff) {
        bumpRemotePlaybackSuppressed(peerId, true, 'offscreen-after-delay')
      } else if (p.allowRenderSuppression && !stillAllowed.has(peerId)) {
        bumpRemotePlaybackSuppressed(peerId, true, 'outside-budget-after-delay')
      }
    }, delay)
    remoteVideoSuppressDelayTimerByPeer.set(peerId, timer)
  }

  for (const pid of [...remoteVideoPlaybackSuppressed.value.keys()]) {
    if (!remoteIds.has(pid)) {
      clearRemoteVideoSuppressTimer(pid)
      bumpRemotePlaybackSuppressed(pid, false, 'peer-left')
    }
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
  if (!receiveDeviceProfile.value.allowRenderSuppression) {
    return undefined
  }
  /** Mid / weak-desktop: keep simulcast + budget; drop presentation FPS cap (often over-triggers). */
  if (receiveDeviceProfile.value.profile === 'constrained') {
    return undefined
  }
  if (videoPlaybackSuppressedForPeer(peerId)) {
    return undefined
  }

  const pressure: FpsRenderPressure =
    playbackRenderFpsPressureByPeerId.value.get(peerId) ?? 'good'

  if (pressure !== 'bad') {
    return undefined
  }

  const isSpeaker =
    peerId === activeSpeakerPeerId.value || peerId === serverActiveSpeakerPeerId.value
  if (isSpeaker) {
    return undefined
  }

  const prof = receiveDeviceProfile.value
  const remoteWithVideo = tiles.value
    .filter((t) => !t.isLocal && t.videoEnabled)
    .map((t) => t.peerId)
  const allowed = computeAllowedRemotePlaybackPeerIds({
    remotePeerIdsWithVideo: remoteWithVideo,
    maxActiveRemoteVideos: prof.maxActiveRemoteVideos,
    enableVisiblePlaybackBudget: prof.allowRenderSuppression,
    fullPowerUnlock: isFullPowerMode.value,
    serverActiveSpeakerPeerId: serverActiveSpeakerPeerId.value,
    uiActiveSpeakerPeerId: activeSpeakerPeerId.value,
    viewportVisibleByPeerId: callTileViewportVisibleByPeer.value,
  })
  if (allowed.has(peerId)) {
    return undefined
  }
  return applyFpsRenderPressure(8, pressure)
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
    callPageLog.info('[call-qa:viewport-layers] setPeerVisible (remote tile IO)', {
      peerId: id,
      visible,
      isLocalSelf: id === selfPeerId.value,
    })
  }
  setPeerVisible(id, visible)
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

const chatOpen = ref(false)
const chatDraft = ref('')
const chatScrollRef = ref<HTMLElement | null>(null)

const micPickerOpen = ref(false)
const camPickerOpen = ref(false)
const micSplitRef = ref<HTMLElement | null>(null)
const camSplitRef = ref<HTMLElement | null>(null)
const roomJoinDraft = ref('')
const roomCopyFlash = ref(false)
let roomCopyFlashTimer: ReturnType<typeof setTimeout> | null = null
/** Join only after auth is ready (same ordering as the old pre-join form). */
const callAuthReady = ref(false)

const callRoomHeaderJoin = useCallRoomHeaderJoinStore()
const { roomPopoverOpen } = storeToRefs(callRoomHeaderJoin)
const mafiaPlayersStore = useMafiaPlayersStore()
const mafiaGameStore = useMafiaGameStore()

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
  const text = displayCallOrMafiaRoomCode()
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
  await switchToRoom(generateCallRoomCode())
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
  if (roomHost?.contains(t)) {
    return
  }
  if (callRoomHeaderJoin.roomPopoverOpen) {
    callRoomHeaderJoin.closeRoomPopover()
  }
  if (!micPickerOpen.value && !camPickerOpen.value) {
    return
  }
  if (micSplitRef.value?.contains(t) || camSplitRef.value?.contains(t)) {
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

function chatOpenPrefKey(): string {
  const r = typeof session.roomId === 'string' ? session.roomId.trim() : String(session.roomId ?? '')
  return `streamassist_call_chat_open:${r || 'demo'}`
}

watch(chatOpen, (open) => {
  if (!session.inCall) {
    return
  }
  try {
    sessionStorage.setItem(chatOpenPrefKey(), open ? '1' : '0')
  } catch {
    /* private mode */
  }
})

watch(
  () => [session.inCall, session.roomId] as const,
  ([inCall]) => {
    if (!inCall) {
      chatOpen.value = false
      return
    }
    queueMicrotask(() => {
      try {
        if (sessionStorage.getItem(chatOpenPrefKey()) === '1') {
          chatOpen.value = true
        }
      } catch {
        /* ignore */
      }
    })
  },
)

watch(
  () => callChatMessages.value.length,
  async () => {
    await nextTick()
    const el = chatScrollRef.value
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
    }
  },
)

function sendChatFromForm(): void {
  const raw = chatDraft.value.trim()
  if (!raw) {
    return
  }
  sendChatMessage(raw)
  chatDraft.value = ''
}

function formatChatTime(at: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
  } catch {
    return ''
  }
}

function isSelfChatLine(line: CallChatLine): boolean {
  return line.peerId === selfPeerId.value
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
  const map = new Map(tiles.value.map((t) => [t.peerId, t]))
  const list = tiles.value
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
  const order = tileOrder.value.filter((id) => map.has(id))
  for (const t of tiles.value) {
    if (!order.includes(t.peerId)) {
      order.push(t.peerId)
    }
  }
  return order.map((id) => map.get(id)!).filter(Boolean)
})

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
const stageRef = ref<HTMLElement | null>(null)
const stageSize = shallowRef({ width: 0, height: 0 })

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
  document.addEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
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
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerForDevicePickers, true)
  window.removeEventListener(MAFIA_OBS_URL_TOAST_EVENT, onMafiaObsUrlCopiedToast)
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
    <Teleport v-if="callRoomHeaderJoin.roomPopoverOpen" :to="`#${CALL_ROOM_DROPDOWN_HOST_ID}`">
      <div
        :id="CALL_ROOM_POPOVER_PANEL_ID"
        class="call-page__room-pop sa-scrollbar"
        role="dialog"
        :aria-label="t('callPage.roomPopoverAria')"
      >
        <label class="call-page__room-pop-field call-page__room-pop-field--top">
          <span>{{ t('callPage.fieldName') }}</span>
          <input
            v-model="session.selfDisplayName"
            type="text"
            name="call-display-name"
            autocomplete="name"
            :placeholder="t('callPage.placeholderName')"
          />
        </label>
        <div class="call-page__room-pop-code">
          <span class="call-page__room-pop-label">{{ t('callPage.roomCodeLabel') }}</span>
          <div class="call-page__room-pop-code-row">
            <code class="call-page__room-pop-value call-page__room-pop-value--row">{{ displayCallOrMafiaRoomCode() }}</code>
            <div class="call-page__room-pop-code-tools">
              <div class="call-page__room-pop-copy-wrap">
                <button
                  type="button"
                  class="call-page__room-pop-ico-btn"
                  :disabled="joining"
                  :title="roomCopyFlash ? t('callPage.roomCodeCopied') : t('callPage.roomCopy')"
                  :aria-label="roomCopyFlash ? t('callPage.roomCodeCopied') : t('callPage.roomCopy')"
                  @click="copyRoomToClipboard"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
                <span
                  v-show="roomCopyFlash"
                  role="status"
                  aria-live="polite"
                  class="call-page__room-pop-copy-tooltip"
                >
                  {{ t('callPage.roomCodeCopied') }}
                </span>
              </div>
              <button
                type="button"
                class="call-page__room-pop-ico-btn"
                :disabled="joining"
                :title="t('callPage.roomGenerateNew')"
                :aria-label="t('callPage.roomRegenerateAria')"
                @click="onGenerateNewRoom"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect width="16" height="16" x="4" y="4" rx="2.5" ry="2.5" />
                  <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="call-page__room-pop-join">
          <label class="call-page__room-pop-field">
            <span>{{ t('callPage.roomJoinFieldLabel') }}</span>
            <input
              v-model="roomJoinDraft"
              type="text"
              name="call-room-code"
              autocomplete="off"
              :placeholder="t('callPage.roomJoinPlaceholder')"
              @keydown.enter.prevent="submitRoomDraft"
            />
          </label>
          <AppButton variant="primary" :disabled="joining" @click="submitRoomDraft">
            {{ t('callPage.roomSwitch') }}
          </AppButton>
        </div>
        <fieldset v-if="allowManualVideoQuality" class="call-page__fieldset call-page__fieldset--in-pop">
          <legend class="call-page__legend">{{ t('callPage.qualityPreset') }}</legend>
          <p class="call-page__hint--small">{{ t('callPage.qualityAdminHint') }}</p>
          <div class="call-page__preset-row">
            <label class="call-page__preset">
              <input v-model="videoQualityChoice" type="radio" name="video-quality-pop" value="auto" />
              <span>{{ t('callPage.quality.auto') }}</span>
            </label>
            <label v-for="p in qualityPresets" :key="p" class="call-page__preset">
              <input v-model="videoQualityChoice" type="radio" name="video-quality-pop" :value="p" />
              <span>{{ t(`callPage.quality.${p}`) }}</span>
            </label>
          </div>
        </fieldset>
        <label v-if="showCallDebugControls" class="call-page__check call-page__check--in-pop">
          <input v-model="callDebugOverlay" type="checkbox" />
          <span>{{ t('callPage.debugOverlay') }}</span>
        </label>
        <p v-if="isAdmin" class="call-page__meta call-page__meta--in-pop">
          {{ t('callPage.wsStatus', { status: wsStatus }) }}
        </p>
      </div>
    </Teleport>
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
          <div class="call-page__grid" :style="gridStyle">
            <div
              v-for="row in orderedGridRows"
              :key="row.tile.peerId"
              class="call-page__tile-wrap"
              :draggable="!mafiaViewUi && !isMafiaRoute"
              :title="t('callPage.dragReorder')"
              :aria-label="t('callPage.dragReorder')"
              :class="{
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
                :mafia-eliminated="isMafiaRoute && mafiaGameStore.isMafiaPeerEliminated(row.tile.peerId)"
                :mafia-elimination-kind="mafiaEliminationAvatarKindForPeerId(row.tile.peerId)"
                :mafia-host-show-life-toggle="
                  isMafiaRoute &&
                  !mafiaViewUi &&
                  mafiaGameStore.isMafiaHost &&
                  mafiaGameStore.phase != null
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
                @mafia-viewport-layers="(v) => onCallTileViewportForLayers(row.tile.peerId, v)"
                @remote-playback-stall="onRemotePlaybackStall"
              />
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
            <div
              class="call-page__dock"
              :class="{ 'call-page__dock--pending': joining }"
              role="toolbar"
              :aria-label="t('callPage.callControls')"
            >
            <div
            ref="micSplitRef"
            class="call-page__dock-split"
            :class="{
              'call-page__dock-split--open': micPickerOpen,
              'call-page__dock-split--solo': !showMediaDevicePickers,
            }"
          >
            <button
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-main"
              :class="{ 'call-page__dock-btn--danger': !micEnabled }"
              :title="micEnabled ? t('callPage.muteMic') : t('callPage.unmute')"
              :aria-pressed="!micEnabled"
              @click="toggleMic"
            >
              <span class="call-page__dock-ico" aria-hidden="true">
                <svg
                  v-if="micEnabled"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <path d="M12 19v3" />
                  <path d="M3 3l18 18" />
                </svg>
              </span>
            </button>
            <button
              v-if="showMediaDevicePickers"
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-chev"
              :title="t('callPage.micInputMenu')"
              :aria-expanded="micPickerOpen"
              aria-haspopup="menu"
              @click.stop="micPickerOpen = !micPickerOpen; camPickerOpen = false"
            >
              <span class="call-page__dock-chev" aria-hidden="true" />
            </button>
            <div
              v-if="micPickerOpen && showMediaDevicePickers"
              class="call-page__device-pop sa-scrollbar"
              role="menu"
              :aria-label="t('callPage.micInputMenu')"
            >
              <p class="call-page__device-pop__title">{{ t('callPage.chooseMic') }}</p>
              <button
                v-for="d in audioInputDevices"
                :key="d.deviceId"
                type="button"
                role="menuitemradio"
                class="call-page__device-pop__opt"
                :aria-checked="d.deviceId === localAudioInputDeviceId"
                :class="{ 'call-page__device-pop__opt--active': d.deviceId === localAudioInputDeviceId }"
                @click="pickAudioInput(d.deviceId)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
          <div
            ref="camSplitRef"
            class="call-page__dock-split"
            :class="{
              'call-page__dock-split--open': camPickerOpen,
              'call-page__dock-split--solo': !showMediaDevicePickers,
            }"
          >
            <button
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-main"
              :class="{ 'call-page__dock-btn--danger': !camEnabled }"
              :title="camEnabled ? t('callPage.cameraOff') : t('callPage.cameraOn')"
              :aria-pressed="!camEnabled"
              @click="toggleCam"
            >
              <span class="call-page__dock-ico" aria-hidden="true">
                <svg
                  v-if="camEnabled"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                  <path d="M3 3l18 18" />
                </svg>
              </span>
            </button>
            <button
              v-if="showMediaDevicePickers"
              type="button"
              class="call-page__dock-btn call-page__dock-btn--split-chev"
              :title="t('callPage.cameraInputMenu')"
              :aria-expanded="camPickerOpen"
              aria-haspopup="menu"
              @click.stop="camPickerOpen = !camPickerOpen; micPickerOpen = false"
            >
              <span class="call-page__dock-chev" aria-hidden="true" />
            </button>
            <div
              v-if="camPickerOpen && showMediaDevicePickers"
              class="call-page__device-pop sa-scrollbar"
              role="menu"
              :aria-label="t('callPage.cameraInputMenu')"
            >
              <p class="call-page__device-pop__title">{{ t('callPage.chooseCamera') }}</p>
              <button
                v-for="d in videoInputDevices"
                :key="d.deviceId"
                type="button"
                role="menuitemradio"
                class="call-page__device-pop__opt"
                :aria-checked="d.deviceId === localVideoInputDeviceId"
                :class="{ 'call-page__device-pop__opt--active': d.deviceId === localVideoInputDeviceId }"
                @click="pickVideoInput(d.deviceId)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="call-page__dock-btn call-page__dock-btn--compact-narrow-hide"
            :class="{ 'call-page__dock-btn--accent': handRaised }"
            :title="handRaised ? t('callPage.raiseHandOff') : t('callPage.raiseHandOn')"
            :aria-pressed="handRaised"
            @click="toggleRaiseHand"
          >
            <span class="call-page__dock-ico call-page__dock-ico--emoji" aria-hidden="true">✋</span>
          </button>
          <button
            type="button"
            class="call-page__dock-btn call-page__dock-btn--compact-narrow-hide"
            :class="{ 'call-page__dock-btn--accent': screenSharing }"
            :title="screenSharing ? t('callPage.screenShareStop') : t('callPage.screenShareStart')"
            :aria-pressed="screenSharing"
            @click="toggleScreenShare"
          >
            <span class="call-page__dock-ico" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" ry="2" />
                <path d="M7 21h10" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            class="call-page__dock-btn call-page__dock-btn--compact-narrow-hide"
            :class="{ 'call-page__dock-btn--accent': chatOpen }"
            :title="chatOpen ? t('callPage.chatHide') : t('callPage.chatShow')"
            :aria-pressed="chatOpen"
            @click="chatOpen = !chatOpen"
          >
            <span class="call-page__dock-ico" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            class="call-page__dock-btn call-page__dock-btn--leave"
            :title="t('callPage.leave')"
            @click="leaveCall"
          >
            <span class="call-page__dock-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path
                  d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
                />
              </svg>
            </span>
          </button>
        </div>
            <MafiaSpeakingQueueBar v-if="isMafiaRoute" />
          </div>
        </div>

        <aside
          v-if="session.inCall && !mafiaViewUi"
          class="call-page__chat"
          :class="{ 'call-page__chat--open': chatOpen }"
          :aria-label="t('callPage.chatTitle')"
          :aria-hidden="chatOpen ? 'false' : 'true'"
        >
          <div class="call-page__chat-head">
            <span class="call-page__chat-title">{{ t('callPage.chatTitle') }}</span>
            <button type="button" class="call-page__chat-close" @click="chatOpen = false">
              {{ t('callPage.chatClose') }}
            </button>
          </div>
          <div ref="chatScrollRef" class="call-page__chat-scroll sa-scrollbar">
            <ul class="call-page__chat-list" role="list">
              <template v-if="callChatMessages.length === 0">
                <li key="chat-empty" class="call-page__chat-li call-page__chat-li--empty">
                  {{ t('callPage.chatEmpty') }}
                </li>
              </template>
              <template v-else>
                <li
                  v-for="line in callChatMessages"
                  :key="line.id"
                  class="call-page__chat-li"
                  :class="{ 'call-page__chat-li--self': isSelfChatLine(line) }"
                >
                  <span class="call-page__chat-meta">
                    <span class="call-page__chat-name">{{ peerDisplayName(line.peerId) }}</span>
                    <time class="call-page__chat-time" :datetime="String(line.at)">{{ formatChatTime(line.at) }}</time>
                  </span>
                  <span class="call-page__chat-text">{{ line.text }}</span>
                </li>
              </template>
            </ul>
          </div>
          <form class="call-page__chat-form" @submit.prevent="sendChatFromForm">
            <input
              v-model="chatDraft"
              class="call-page__chat-input"
              type="text"
              maxlength="500"
              autocomplete="off"
              :placeholder="t('callPage.chatPlaceholder')"
            />
            <AppButton type="submit" variant="secondary" class="call-page__chat-send">{{
              t('callPage.chatSend')
            }}</AppButton>
          </form>
        </aside>

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

<style scoped>
.page-route {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-height: 100%;
  overflow: hidden;
}

.call-page {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
  overflow: hidden;
  /* Прозоро: позаду — шар AppShell (блискавки), без окремого «килима» під відео / формою. */
  background: transparent;
  color: var(--sa-color-text-body);
  padding-block: 0;
}

.call-page.app-container {
  max-width: 100%;
  width: 100%;
}

.call-page__shell {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  /* Active call: no top/bottom shell inset — stage + __active padding reserve dock; avoids double gap + scroll. */
  padding: 0;
  box-sizing: border-box;
}

.call-page--stage-full .call-page__shell {
  padding-inline: 0;
}

.call-page__hint--small {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  opacity: 0.85;
  color: var(--sa-color-text-muted);
}

.call-page__fieldset {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
}

.call-page__fieldset--in-pop {
  margin-top: 0.5rem;
}

.call-page__legend {
  padding: 0 0.25rem;
  font-size: 0.9rem;
}

.call-page__preset-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.call-page__preset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  cursor: pointer;
}

.call-page__check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  cursor: pointer;
}

.call-page__check--in-pop {
  margin-top: 0.5rem;
}

.call-page__meta {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.7;
  font-family: var(--sa-font-mono, monospace);
}

.call-page__meta--in-pop {
  margin-top: 0.5rem;
}

.call-page__btn--muted {
  opacity: 0.75;
}

.call-page__active {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  width: 100%;
  position: relative;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
}

.call-page__active--with-dock {
  /* Зазор під плаваючий dock. */
  padding-bottom: calc(3.25rem + env(safe-area-inset-bottom, 0px));
}

/* Mafia: speaking queue + dock stack on narrow viewports — reserve more stage space. */
@media (max-width: 40rem) {
  .call-page__active--with-dock.call-page__active--with-mafia-bottom {
    padding-bottom: calc(7.25rem + env(safe-area-inset-bottom, 0px));
  }
}

/* Room popover: Teleport target is `#call-room-dropdown-host` in AppShellLayout (positioned below header button). */
.call-page__room-pop {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 0.35rem;
  z-index: 100;
  width: min(22rem, calc(100vw - 2rem));
  max-height: min(70vh, 28rem);
  overflow: auto;
  padding: 0.75rem 0.85rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface) 94%, rgb(8 10 14 / 0.92));
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.4);
}

.call-page__room-pop-field--top {
  margin: 0 0 0.65rem;
}

.call-page__room-pop-code {
  margin: 0 0 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.call-page__room-pop-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.75;
  color: var(--sa-color-text-muted);
}

.call-page__room-pop-value {
  font-size: 0.95rem;
  font-family: var(--sa-font-mono, monospace);
  word-break: break-all;
  color: var(--sa-color-text-main);
}

.call-page__room-pop-code-row {
  display: flex;
  align-items: stretch;
  min-height: 2.25rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  /* Visible so the copy feedback tooltip can sit above the icon without clipping. */
  overflow: visible;
}

.call-page__room-pop-value--row {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.45rem 0.55rem;
  display: flex;
  align-items: center;
  border-radius: calc(var(--sa-radius-sm) - 1px) 0 0 calc(var(--sa-radius-sm) - 1px);
}

.call-page__room-pop-code-tools {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-inline-start: 1px solid var(--sa-color-border);
  padding: 0 0.1rem;
  background: color-mix(in srgb, var(--sa-color-surface) 92%, transparent);
  border-radius: 0 var(--sa-radius-sm) var(--sa-radius-sm) 0;
  overflow: visible;
}

.call-page__room-pop-copy-wrap {
  position: relative;
  display: flex;
  align-items: stretch;
}

.call-page__room-pop-copy-tooltip {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.35rem);
  padding: 0.35rem 0.5rem;
  border-radius: var(--sa-radius-sm);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  color: var(--sa-color-text-main);
  background: color-mix(in srgb, var(--sa-color-surface) 8%, rgb(18 20 26));
  border: 1px solid var(--sa-color-border);
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.35);
  z-index: 3;
  pointer-events: none;
}

.call-page__room-pop-ico-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  min-height: 2.25rem;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: calc(var(--sa-radius-sm) - 1px);
  background: transparent;
  color: var(--sa-color-text-muted);
  cursor: pointer;
}

.call-page__room-pop-ico-btn:hover:not(:disabled) {
  color: var(--sa-color-text-main);
  background: color-mix(in srgb, var(--sa-color-text-main) 10%, transparent);
}

.call-page__room-pop-ico-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.call-page__room-pop-join {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.call-page__room-pop-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
}

.call-page__room-pop-field input {
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  color: var(--sa-color-text-main);
  font: inherit;
}

.call-page__join-error {
  position: fixed;
  bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 55;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.65rem;
  width: min(22rem, calc(100vw - 2rem));
  padding: 0.75rem 0.9rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid color-mix(in srgb, #f87171 45%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-surface) 92%, rgb(20 10 12 / 0.95));
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
  box-sizing: border-box;
}

.call-page__join-error-text {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #fecaca;
}

.call-page__toasts {
  position: fixed;
  top: 4.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  width: min(22rem, calc(100vw - 2rem));
  pointer-events: none;
}

.call-page__toast-stack {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: stretch;
}

.call-page__toast {
  pointer-events: none;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  color: #f9fafb;
  border: 1px solid rgb(255 255 255 / 0.12);
  box-shadow: 0 10px 28px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.call-page__toast--join {
  background: color-mix(in srgb, var(--sa-color-primary, #a78bfa) 32%, rgb(15 16 20 / 0.92));
}

.call-page__toast--leave {
  background: color-mix(in srgb, #64748b 35%, rgb(15 16 20 / 0.92));
}

/* Above `theme.css` `.app-shell-header` (z-index: 100); same vertical band as `.call-page__toasts` */
.call-page__mafia-speak-hint {
  position: fixed;
  top: 4.75rem;
  right: 1rem;
  left: auto;
  transform: none;
  z-index: 110;
  pointer-events: none;
  width: min(20rem, calc(100vw - 1.5rem));
}

.call-toast-enter-active,
.call-toast-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.call-toast-enter-from,
.call-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.call-toast-move {
  transition: transform 0.2s ease;
}

.call-page__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  padding: 0 var(--sa-space-5) var(--sa-space-8);
}

/* Flex column + height:100% on a flex child often resolves wrong; flex:1 + min-height:0 for reliable fill. */
.call-page__grid {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: grid;
  /* overflow: hidden; */
  /* Matches GRID_CONTENT_INSET_PX in getGrid (6px each side): space for drag-active ring without clipping. */
  padding: 6px;
  box-sizing: border-box;
}

.call-page__tile-wrap {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
  isolation: isolate;
  cursor: grab;
  /* Match `.tile` in ParticipantTile (14px); stable radius avoids jitter vs --over-only radius + shadow animation. */
  border-radius: 14px;
  /**
   * Asymmetric fade: base = LEAVE (slower, softer exit), `--speaking` rule overrides to a
   * quicker ENTER. When `--speaking` is removed the style falls back here → leave animation.
   */
  transition:
    box-shadow 0.32s ease-out,
    transform 0.32s ease-out;
}

.call-page__tile-wrap--dragging {
  cursor: grabbing;
  transition: none;
}

/* Mafia: no tile reorder; players / OBS view use a normal pointer — not “grab” (host keeps mode cursors below). */
.call-page__tile-wrap--mafia-cursor-default {
  cursor: default;
}

/* Drag source: kill tile hover lift / shadow transition so 14px clip + video mask stay aligned. */
.call-page__tile-wrap--dragging :deep(.tile) {
  transform: none !important;
}

.call-page__tile-inner :deep(button:not(:disabled)) {
  cursor: pointer;
}

/* Сусідня клітина сітки інакше перекриває тінь попередньої (порядок малювання в DOM). */
.call-page__tile-wrap:hover,
.call-page__tile-wrap:focus-within,
.call-page__tile-wrap--over,
.call-page__tile-wrap--speaking {
  z-index: 2;
}

/**
 * Active speaker ring on the wrap (not the inner `.tile`) so `overflow: hidden` on `.call-page__grid`
 * does not clip the glow. `call-page__tile-wrap--speaking` from `isTileRowSpeaking(row)` (no `:has()`).
 */
.call-page__tile-wrap--speaking:not(.call-page__tile-wrap--dragging) {
  box-shadow: 0 0 24px rgba(140, 90, 255, 0.6);
  transform: scale(1.01);
  transform-origin: center center;
  /* ENTER is snappier than LEAVE; see base rule for the LEAVE duration. */
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .call-page__tile-wrap--speaking:not(.call-page__tile-wrap--dragging) {
    transform: none;
    box-shadow: 0 0 0 1px rgba(140, 90, 255, 0.5);
  }
}

.call-page__tile-wrap--over {
  outline: none;
  border-radius: 14px;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--sa-color-primary, #a78bfa) 90%, transparent),
    0 0 0 6px color-mix(in srgb, var(--sa-color-primary, #a78bfa) 22%, transparent);
}

.call-page__tile-wrap--mafia-host-mode {
  cursor: crosshair;
  /* Keep the same asymmetric LEAVE speed as the base rule; outline-color is host-mode UI only. */
  transition:
    box-shadow 0.32s ease-out,
    outline-color 0.2s ease,
    transform 0.32s ease-out;
}

.call-page__tile-wrap--mafia-host-mode-speaking {
  cursor: copy;
}

.call-page__tile-wrap--mafia-host-mode-swap {
  cursor: cell;
}

.call-page__tile-wrap--mafia-swap-selected {
  z-index: 2;
  border-radius: 14px;
  box-shadow: 0 0 0 2px color-mix(in srgb, #a855f7 80%, var(--sa-color-surface) 20%);
}

.call-page__tile-wrap--mafia-host-speaking-queued {
  z-index: 2;
  border-radius: 14px;
  box-shadow: 0 0 0 2px color-mix(in srgb, #22d3ee 80%, var(--sa-color-primary, #a78bfa) 10%);
}

.call-page__tile-wrap--mafia-host-target {
  z-index: 2;
  border-radius: 14px;
  box-shadow: 0 0 0 2px color-mix(in srgb, #fde047 75%, var(--sa-color-primary, #a78bfa) 15%);
}

.call-page__tile-inner {
  width: 100%;
  min-height: 0;
  min-width: 0;
}

.call-page__tile-inner :deep(.tile) {
  width: 100%;
  min-height: 0;
}

/**
 * Mafia (and call): 3 columns `1fr | auto (dock) | 1fr` so the queue never shifts the pill dock off center.
 */
.call-page__bottom-cluster {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  transform: none;
  z-index: 40;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.4rem;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  pointer-events: none;
}

.call-page__bottom-cluster__left {
  min-width: 0;
  max-width: 100%;
  justify-self: end;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  overflow: hidden;
  padding-right: 0.1rem;
  pointer-events: auto;
}

.call-page__bottom-cluster__left--empty {
  min-height: 0;
  padding: 0;
  overflow: hidden;
  pointer-events: none;
}

.call-page__bottom-cluster__center {
  justify-self: center;
  min-width: 0;
  pointer-events: auto;
}

/* Mafia speaking queue to the right of `.call-page__dock`, same row; long queues wrap to a second line inside the pill. */
.call-page__bottom-cluster__center--speak-dock {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--sa-space-2) var(--sa-space-3);
  min-width: 0;
  max-width: 100%;
}

.call-page__bottom-cluster__center--speak-dock .call-page__dock {
  flex: 0 0 auto;
  min-width: 0;
}

.call-page__bottom-cluster__right {
  justify-self: start;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.3rem 0.35rem;
  min-width: 0;
  padding-left: 0.1rem;
  pointer-events: auto;
}

@media (max-width: 40rem) {
  .call-page__bottom-cluster {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    row-gap: 0.4rem;
    left: 0.25rem;
    right: 0.25rem;
  }

  .call-page__bottom-cluster__left {
    justify-self: center;
    width: 100%;
    max-width: 100%;
    justify-content: center;
  }

  .call-page__bottom-cluster__center {
    grid-row: 2;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .call-page__bottom-cluster__center--speak-dock {
    flex-direction: column;
    align-items: stretch;
    max-width: min(100%, 100vw - 0.5rem);
  }

  .call-page__bottom-cluster__center--speak-dock :deep(.mafia-host-hud) {
    align-self: center;
    max-width: min(100%, 100vw - 0.5rem);
    width: min(100%, 42rem);
  }

  .call-page__bottom-cluster__right {
    grid-row: 3;
    justify-content: center;
    width: 100%;
  }
}

/* Pill surface only; position comes from `.call-page__bottom-cluster`. */
.call-page__dock {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.55rem 0.75rem;
  width: max-content;
  max-width: min(calc(100vw - 16px), 100%);
  padding: 0.62rem 0.9rem;
  /* overflow visible: device picker popups extend above the bar */
  box-sizing: border-box;
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.1), transparent 46%),
    rgb(72 42 98 / 0.34);
  border: 1px solid rgb(255 255 255 / 0.16);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.18),
    0 10px 24px rgb(10 3 24 / 0.22);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
}

/* Під час join overlay: та сама панель і відступ, без кліків (без стрибка сітки). */
.call-page__dock--pending {
  pointer-events: none;
  opacity: 0.62;
}

.call-page__dock-btn {
  width: 3.25rem;
  height: 3.25rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(15 9 28 / 0.34);
  color: #f3f4f6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    box-shadow 0.2s ease,
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

/* Без translateY і без великого «ореолу» — інакше hover виглядає як виступ над верхом пілюлі. */
.call-page__dock-btn:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.08);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.07),
    0 3px 12px rgb(167 139 250 / 0.28);
}

.call-page__dock-btn--split-main:hover:not(:disabled),
.call-page__dock-btn--split-chev:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.07);
}

.call-page__dock-split {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(15 9 28 / 0.34);
  overflow: visible;
}

.call-page__dock-split--solo {
  border: none;
  background: transparent;
}

.call-page__dock-split--solo .call-page__dock-btn--split-main {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(15 9 28 / 0.34);
}

.call-page__dock-split--open {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
}

.call-page__dock-btn--split-main {
  width: 2.75rem;
  height: 3.25rem;
  min-height: 3.25rem;
  border-radius: 999px 0 0 999px;
  border: none;
  border-right: 1px solid rgb(255 255 255 / 0.1);
}

.call-page__dock-btn--split-chev {
  width: 1.85rem;
  min-width: 1.85rem;
  height: 3.25rem;
  padding: 0;
  border-radius: 0 999px 999px 0;
  border: none;
  background: transparent;
}

.call-page__dock-chev {
  display: block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  opacity: 0.88;
}

.call-page__device-pop {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 13.5rem;
  max-width: min(18rem, calc(100vw - 2rem));
  max-height: min(50vh, 16rem);
  overflow-y: auto;
  padding: 10px 8px 10px;
  border-radius: 8px;
  border: 1px solid rgb(0 0 0 / 0.45);
  background: #2b2d31;
  box-shadow:
    0 12px 32px rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 50;
}

.call-page__device-pop__title {
  margin: 0 6px 8px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #949ba4;
}

.call-page__device-pop__opt {
  display: block;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  text-align: left;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.35;
  color: #dbdee1;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.call-page__device-pop__opt:hover {
  background: #35373c;
  color: #f2f3f5;
}

.call-page__device-pop__opt--active {
  background: color-mix(in srgb, #5865f2 22%, transparent);
  color: #fff;
}

.call-page__dock-btn:focus-visible {
  outline: 2px solid var(--sa-color-primary, #a78bfa);
  outline-offset: 1px;
}

.call-page__dock-btn--danger {
  border-color: color-mix(in srgb, #f87171 55%, rgb(255 255 255 / 0.12));
  color: #fecaca;
  box-shadow: 0 0 0 1px rgb(248 113 113 / 0.22);
}

.call-page__dock-btn--leave {
  background: linear-gradient(165deg, #ef4444, #b91c1c);
  border-color: #fca5a5;
  color: #fff;
}

.call-page__dock-btn--leave:hover {
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.12),
    0 3px 14px rgb(248 113 113 / 0.4);
}

.call-page__dock-btn--accent {
  border-color: color-mix(in srgb, #fde047 55%, rgb(255 255 255 / 0.12));
  color: #fef9c3;
  box-shadow: 0 0 0 1px rgb(250 204 21 / 0.22);
}

.call-page__dock-ico {
  display: flex;
  align-items: center;
  justify-content: center;
}

.call-page__dock-ico--emoji {
  font-size: 1.05rem;
  line-height: 1;
}

@media (max-width: 768px) {
  .call-page__dock-btn {
    width: 2.6rem;
    height: 2.6rem;
  }

  .call-page__dock-btn--split-main {
    width: 2.3rem;
    height: 2.6rem;
    min-height: 2.6rem;
  }

  .call-page__dock-btn--split-chev {
    width: 1.5rem;
    min-width: 1.5rem;
    height: 2.6rem;
  }

  .call-page__dock-split--solo .call-page__dock-btn--split-main {
    width: 2.6rem;
    height: 2.6rem;
  }
}

@media (max-width: 480px) {
  .call-page__dock {
    padding: 0.4rem 0.6rem;
    gap: 0.4rem;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }

  .call-page__dock::-webkit-scrollbar {
    display: none;
  }

  .call-page__dock-btn {
    width: 2.2rem;
    height: 2.2rem;
    flex-shrink: 0;
  }

  .call-page__dock-btn--split-main {
    width: 2rem;
    height: 2.2rem;
    min-height: 2.2rem;
  }

  .call-page__dock-btn--split-chev {
    width: 1.2rem;
    min-width: 1.2rem;
    height: 2.2rem;
  }

  .call-page__dock-split--solo .call-page__dock-btn--split-main {
    width: 2.2rem;
    height: 2.2rem;
  }

  .call-page__dock-split {
    flex-shrink: 0;
  }

  .call-page__dock-btn--compact-narrow-hide {
    display: none;
  }
}

.call-page__chat {
  position: fixed;
  top: 4.5rem;
  right: 0.75rem;
  bottom: 6.25rem;
  z-index: 38;
  width: min(20rem, calc(100vw - 1.5rem));
  display: flex;
  flex-direction: column;
  border-radius: var(--sa-radius-lg);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-card) 94%, transparent);
  color: var(--sa-color-text-body);
  box-shadow: var(--sa-shadow-card);
  overflow: hidden;
  contain: layout paint;
  transform: translate3d(calc(100% + 1.25rem), 0, 0);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.22s ease,
    visibility 0.22s ease;
}

.call-page__chat--open {
  transform: translate3d(0, 0, 0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .call-page__chat {
    transition: none;
  }
}

.call-page__chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
  padding: var(--sa-space-3) var(--sa-space-4);
  border-bottom: 1px solid var(--sa-color-border);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 40%, transparent);
}

.call-page__chat-title {
  font-family: var(--sa-font-display);
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: var(--sa-color-text-main);
}

.call-page__chat-close {
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 70%, transparent);
  color: var(--sa-color-text-main);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.28rem 0.55rem;
  border-radius: var(--sa-radius-sm);
}

.call-page__chat-close:hover {
  border-color: var(--sa-color-primary-border);
  background: color-mix(in srgb, var(--sa-color-primary) 14%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-strong);
}

.call-page__chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: auto;
  overscroll-behavior: contain;
  padding: var(--sa-space-2) var(--sa-space-3);
}

.call-page__chat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
}

.call-page__chat-li {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 58%, transparent);
  border: 1px solid var(--sa-color-border);
}

.call-page__chat-li--empty {
  text-align: center;
  font-size: 0.82rem;
  color: var(--sa-color-text-muted);
  border-style: dashed;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 28%, transparent);
}

.call-page__chat-li--self {
  border-color: var(--sa-color-primary-border);
  background: color-mix(in srgb, var(--sa-color-primary) 12%, var(--sa-color-surface-raised));
}

.call-page__chat-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sa-space-2);
  font-size: 0.68rem;
  color: var(--sa-color-text-muted);
}

.call-page__chat-name {
  font-weight: 700;
  color: var(--sa-color-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.call-page__chat-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.call-page__chat-text {
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.45;
}

.call-page__chat-form {
  display: flex;
  gap: var(--sa-space-2);
  padding: var(--sa-space-3) var(--sa-space-4);
  border-top: 1px solid var(--sa-color-border);
  flex-shrink: 0;
  align-items: center;
  background: color-mix(in srgb, var(--sa-color-surface-raised) 35%, transparent);
}

.call-page__chat-input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface) 92%, transparent);
  color: var(--sa-color-text-main);
  font: inherit;
  font-size: 0.84rem;
}

.call-page__chat-input:focus {
  outline: 2px solid color-mix(in srgb, var(--sa-color-primary) 45%, transparent);
  outline-offset: 1px;
}

.call-page__chat-send {
  flex-shrink: 0;
}

.call-page__debug {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 50;
  max-width: min(420px, calc(100vw - 1.5rem));
  padding: 0.65rem 0.75rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-main) 92%, #000);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
  font-size: 0.75rem;
  font-family: var(--sa-font-mono, ui-monospace, monospace);
}

.call-page__debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.call-page__debug-title {
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.call-page__debug-dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.65rem;
  margin: 0 0 0.5rem;
}

.call-page__debug-dl dt {
  margin: 0;
  opacity: 0.75;
}

.call-page__debug-dl dd {
  margin: 0;
}

.call-page__debug-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.call-page__debug-li {
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--sa-color-border);
}

.call-page__debug-peer {
  font-weight: 600;
  margin-right: 0.35rem;
}

.call-page__debug-fps,
.call-page__debug-loss {
  opacity: 0.85;
}
</style>
