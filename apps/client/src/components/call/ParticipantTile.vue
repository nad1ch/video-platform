<script setup lang="ts">
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
import { useI18n } from 'vue-i18n'
import { normalizeDisplayName } from 'call-core'
import { createLogger } from '@/utils/logger'
import type { MafiaRole } from '@/utils/mafiaGameTypes'
import MafiaEliminationMark from '../mafia/MafiaEliminationMark.vue'
import StreamAudio from '../StreamAudio.vue'
import StreamVideo from '../StreamVideo.vue'
import type { MafiaEliminationAvatarKind } from '@/utils/mafiaEliminationAvatarKind'

const tileLog = createLogger('participant-tile')

const { t } = useI18n()

const emit = defineEmits<{
  'update:listenVolume': [value: number]
  'update:listenMuted': [value: boolean]
  /** Local-only label override (`name` null or empty clears). */
  'commit-local-display-name': [payload: { peerId: string; name: string | null }]
  /** Mafia host: toggle eliminated / alive for this remote tile. */
  'mafia-toggle-life': [peerId: string]
  /** Mafia: tile intersects viewport (for `setPeerVisible` / simulcast layers). */
  'mafia-viewport-layers': [visible: boolean]
  /** Remote `<video>` `waiting`: fast playback stall signal for adaptive FPS (CallPage). */
  'remote-playback-stall': [payload: { peerId: string; stalling: boolean }]
}>()

const props = withDefaults(
  defineProps<{
    /** Room participant id (for optional volume_* localStorage mirror). */
    peerId?: string
    displayName: string
    stream: MediaStream | null
    isLocal: boolean
    videoEnabled: boolean
    audioEnabled: boolean
    /** Bumps play() when stream ref or tracks change (local / remote). */
    playRev?: number
    /** CSS size tier from parent grid: sm | md | lg */
    sizeTier: 'sm' | 'md' | 'lg'
    /**
     * CallPage drives speaking UI: wrap glow + this tile’s `is-speaking` / video nudge
     * (from `activeSpeakerPeerId` + local RMS; see `isTileRowSpeaking` in `CallPage`).
     */
    rowSpeaking: boolean
    /** Local-only remote listening gain 0..2 (0–200%). */
    remoteListenVolume?: number
    /** Local-only remote listen mute */
    remoteListenMuted?: boolean
    /** “Raise hand” from signaling (call room). */
    raiseHand?: boolean
    /** Passed to StreamVideo `fill-cover`; CallPage sets false so grid video uses contain (no crop). */
    videoFillCover?: boolean
    /** Outbound/inbound presentation; local may be `none` when outbound video is paused / no track. */
    videoPresentation?: 'camera' | 'screen' | 'none'
    /** Profile image when video is off (HTTPS URL from parent; never fetch here). */
    avatarUrl?: string
    /** Mafia: 1-based seat index; shown in a small circle before the role chip (optional UI only). */
    mafiaSeatIndex?: number
    /**
     * Mafia: when set, show a role label (CallPage sets only for host or that tile’s local player; off for stream capture).
     */
    mafiaVisibleRole?: MafiaRole
    /** Mafia stream capture: hide per-tile menu and name editing. */
    streamViewMode?: boolean
    /** Mafia: host marked this peer dead — hide WebRTC video and show elimination art. */
    mafiaEliminated?: boolean
    mafiaEliminationKind?: MafiaEliminationAvatarKind
    /** Mafia: host, round started — show persistent 💀/❤️ life toggle (top-right). */
    mafiaHostShowLifeToggle?: boolean
    /**
     * Call / Mafia: track tile intersection with the viewport; parent maps to `setPeerVisible` for simulcast.
     * Remotes only.
     */
    mafiaLayerViewportObserve?: boolean
    /**
     * Remote-only: pause `<video>` playback while tile is off-screen (Phase 2); audio unchanged.
     */
    videoPlaybackSuppressed?: boolean
    /** Phase 3.5: optional `<video>` presentation cap (see `StreamVideo.targetPlaybackFps`). */
    videoTargetPlaybackFps?: number
  }>(),
  {
    streamViewMode: false,
    mafiaEliminated: false,
    mafiaEliminationKind: 'skull',
    mafiaHostShowLifeToggle: false,
    mafiaLayerViewportObserve: false,
    videoPlaybackSuppressed: false,
    rowSpeaking: false,
  },
)

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
/** Mafia: IntersectionObserver root (`.tile`). */
const tileRootRef = ref<HTMLElement | null>(null)
let mafiaLayerObserver: IntersectionObserver | null = null
let mafiaLayerLastEmitted: boolean | null = null

const editingName = ref(false)
const nameDraft = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function peerIdForNameEdit(): string {
  return typeof props.peerId === 'string' ? props.peerId.trim() : ''
}

const remotePlaybackStallPeerIdForVideo = computed(() => {
  if (props.isLocal) {
    return null
  }
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  return id.length > 0 ? id : null
})

function startNameEdit(): void {
  if (props.streamViewMode) {
    return
  }
  const id = peerIdForNameEdit()
  if (!id) {
    return
  }
  nameDraft.value = props.displayName
  editingName.value = true
  void nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

function cancelNameEdit(): void {
  editingName.value = false
  nameDraft.value = props.displayName
}

function finishNameEdit(): void {
  if (!editingName.value) {
    return
  }
  editingName.value = false
  const id = peerIdForNameEdit()
  if (!id) {
    return
  }
  const trimmed = normalizeDisplayName(nameDraft.value).slice(0, 64)
  if (trimmed === normalizeDisplayName(props.displayName)) {
    return
  }
  emit('commit-local-display-name', { peerId: id, name: trimmed.length > 0 ? trimmed : null })
}

function onNameInputEnter(ev: KeyboardEvent): void {
  const el = ev.target
  if (el instanceof HTMLInputElement) {
    el.blur()
  }
}

function onDocPointerDown(ev: PointerEvent): void {
  if (!menuOpen.value) {
    return
  }
  const root = menuRoot.value
  if (root && ev.target instanceof Node && root.contains(ev.target)) {
    return
  }
  menuOpen.value = false
}

watch(menuOpen, (open) => {
  if (typeof document === 'undefined') {
    return
  }
  if (open) {
    document.addEventListener('pointerdown', onDocPointerDown, true)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
  }
})

function initials(name: string): string {
  const n = normalizeDisplayName(name)
  const parts = n.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Remote: audio-only split stream for Web Audio path (video uses the same composite stream as props). */
const audioSplitStream = shallowRef<MediaStream | null>(null)

function clearSplitHolder(holder: { value: MediaStream | null }): void {
  const m = holder.value
  if (!m) {
    return
  }
  for (const t of [...m.getTracks()]) {
    m.removeTrack(t)
  }
  holder.value = null
}

function syncSplitStream(
  holder: { value: MediaStream | null },
  tracks: MediaStreamTrack[],
): void {
  if (tracks.length === 0) {
    clearSplitHolder(holder)
    return
  }
  if (!holder.value) {
    holder.value = new MediaStream()
  }
  const m = holder.value
  const want = new Set(tracks.map((t) => t.id))
  const kind = tracks[0]?.kind
  const current = kind === 'video' ? m.getVideoTracks() : m.getAudioTracks()
  for (const t of current) {
    if (!want.has(t.id)) {
      m.removeTrack(t)
    }
  }
  for (const t of tracks) {
    if (!m.getTracks().some((et) => et.id === t.id)) {
      m.addTrack(t)
    }
  }
}

watch(
  () => [props.stream, props.playRev ?? 0, props.isLocal] as const,
  () => {
    if (!props.stream || props.isLocal) {
      clearSplitHolder(audioSplitStream)
      return
    }
    syncSplitStream(audioSplitStream, props.stream.getAudioTracks())
  },
  { immediate: true },
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
  }
  clearSplitHolder(audioSplitStream)
})

const showMafiaSeat = computed(
  () => typeof props.mafiaSeatIndex === 'number' && props.mafiaSeatIndex > 0,
)

/** Mafia call tiles: name only; seat is a separate circle before the role chip. */
const mafiaCallPrimaryLine = computed(() => {
  if (!showMafiaSeat.value || typeof props.mafiaSeatIndex !== 'number') {
    return props.displayName
  }
  return normalizeDisplayName(props.displayName)
})

const showMafiaRole = computed(() => !props.streamViewMode && props.mafiaVisibleRole != null)

const mafiaRoleLabel = computed(() => {
  const r = props.mafiaVisibleRole
  if (r == null) {
    return ''
  }
  return t(`mafiaPage.nightRole.${r}`)
})

const hasLiveLocalVideo = computed(() => {
  if (!props.stream || !props.isLocal) {
    return false
  }
  void props.playRev
  if (props.videoPresentation === 'none') {
    return false
  }
  return props.stream.getVideoTracks().some((t) => t.readyState === 'live')
})

/** Remote only: at least one video track with `readyState === 'live'` (do not use `muted` / `enabled`). */
const hasLiveVideoTrack = computed(() => {
  if (!props.stream || props.isLocal) {
    return false
  }
  void props.playRev
  return props.stream.getVideoTracks().some((t) => t.readyState === 'live')
})

const showVideo = computed(() => {
  if (!props.stream) {
    return false
  }
  if (props.isLocal) {
    return props.videoEnabled && hasLiveLocalVideo.value
  }
  return props.videoEnabled && hasLiveVideoTrack.value
})

/** Mafia: dim + grayscale the frame while still rendering the stream. */
const mafiaDeadShade = computed(
  () => !props.isLocal && !props.streamViewMode && Boolean(props.mafiaEliminated),
)

const resolvedAvatarUrl = computed(() => {
  const u = props.avatarUrl
  return typeof u === 'string' && u.trim().length > 0 ? u.trim() : ''
})

/** Video-off filler: OAuth avatar when provided, else initials (below). Elimination art takes priority. */
const showMafiaElimination = computed(() => Boolean(props.mafiaEliminated) && !showVideo.value)
const showAvatar = computed(
  () => !showMafiaElimination.value && !showVideo.value && resolvedAvatarUrl.value !== '',
)
const showInitialsFallback = computed(
  () => !showMafiaElimination.value && !showVideo.value && resolvedAvatarUrl.value === '',
)

const volumePercentUi = computed(() =>
  Math.min(200, Math.max(0, Math.round((props.remoteListenVolume ?? 1) * 100))),
)

/**
 * Stable DOM identity for `<StreamVideo>`: peer id only (no playRev/stream in key).
 * Track/cam changes are handled inside `StreamVideo` via `playRev` + `bindStream`; remounting on every bump was redundant and costly at scale.
 */
const streamVideoStableKey = computed(() =>
  props.isLocal ? 'local' : typeof props.peerId === 'string' && props.peerId.length > 0 ? props.peerId : 'peer',
)

const isSpeaking = computed(() => props.rowSpeaking)

/** Memo deps for the video subtree — label/mic/row speaking can change without patching WebRTC. */
const streamVideoMemoDeps = computed(() => [
  props.stream,
  props.playRev ?? 0,
  showVideo.value,
  hasLiveVideoTrack.value,
  Boolean(props.videoFillCover),
  props.isLocal,
  props.videoPresentation,
  props.mafiaEliminated,
  Boolean(props.videoPlaybackSuppressed),
  props.videoTargetPlaybackFps ?? null,
])

function onVolumeSliderInput(ev: Event): void {
  const t = ev.target as HTMLInputElement
  const pct = Math.min(200, Math.max(0, Number(t.value)))
  const gain = pct / 100
  emit('update:listenVolume', gain)
}

function onMuteCheckboxChange(ev: Event): void {
  const t = ev.target as HTMLInputElement
  emit('update:listenMuted', t.checked)
}

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

const mafiaKillAnim = ref(false)
const mafiaReviveAnim = ref(false)
let mafiaKillAnimTimer: ReturnType<typeof setTimeout> | undefined
let mafiaReviveAnimTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.mafiaEliminated,
  (next, prev) => {
    if (props.isLocal || props.streamViewMode) {
      return
    }
    if (prev === undefined) {
      return
    }
    if (prev === true && next === false) {
      mafiaReviveAnim.value = true
      if (mafiaReviveAnimTimer != null) {
        clearTimeout(mafiaReviveAnimTimer)
      }
      mafiaReviveAnimTimer = setTimeout(() => {
        mafiaReviveAnim.value = false
        mafiaReviveAnimTimer = undefined
      }, 700)
    } else if (prev === false && next === true) {
      mafiaKillAnim.value = true
      if (mafiaKillAnimTimer != null) {
        clearTimeout(mafiaKillAnimTimer)
      }
      mafiaKillAnimTimer = setTimeout(() => {
        mafiaKillAnim.value = false
        mafiaKillAnimTimer = undefined
      }, 420)
    }
  },
)

function onMafiaHostLifeClick(): void {
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (id.length < 1) {
    return
  }
  emit('mafia-toggle-life', id)
}

onBeforeUnmount(() => {
  if (mafiaKillAnimTimer != null) {
    clearTimeout(mafiaKillAnimTimer)
  }
  if (mafiaReviveAnimTimer != null) {
    clearTimeout(mafiaReviveAnimTimer)
  }
  disconnectMafiaLayerObserver()
  mafiaLayerLastEmitted = null
  if (props.mafiaLayerViewportObserve && !props.isLocal) {
    emit('mafia-viewport-layers', true)
  }
})

function disconnectMafiaLayerObserver(): void {
  if (mafiaLayerObserver) {
    mafiaLayerObserver.disconnect()
    mafiaLayerObserver = null
  }
}

function emitMafiaLayerViewport(visible: boolean): void {
  if (mafiaLayerLastEmitted === visible) {
    return
  }
  mafiaLayerLastEmitted = visible
  emit('mafia-viewport-layers', visible)
}

function connectMafiaLayerObserver(): void {
  disconnectMafiaLayerObserver()
  mafiaLayerLastEmitted = null
  if (typeof window === 'undefined' || !props.mafiaLayerViewportObserve || props.isLocal) {
    return
  }
  const id = peerIdForNameEdit()
  if (!id) {
    return
  }
  const el = tileRootRef.value
  if (!el) {
    return
  }
  mafiaLayerObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === el) {
          emitMafiaLayerViewport(entry.isIntersecting)
        }
      }
    },
    { root: null, rootMargin: '10% 10% 10% 10%', threshold: 0 },
  )
  mafiaLayerObserver.observe(el)
}

function scheduleMafiaLayerObserverConnect(): void {
  void nextTick(() => {
    if (!props.mafiaLayerViewportObserve || props.isLocal) {
      disconnectMafiaLayerObserver()
      mafiaLayerLastEmitted = null
      return
    }
    connectMafiaLayerObserver()
  })
}

watch(
  () => [props.mafiaLayerViewportObserve, props.isLocal, props.peerId] as const,
  () => {
    scheduleMafiaLayerObserverConnect()
  },
  { flush: 'post' },
)

onMounted(() => {
  scheduleMafiaLayerObserverConnect()
})

if (import.meta.env.DEV) {
  watch(
    () =>
      [
        props.peerId,
        props.isLocal,
        showVideo.value,
        props.videoPresentation,
        props.videoFillCover,
        props.stream,
        props.playRev,
        hasLiveVideoTrack.value,
        props.videoEnabled,
      ] as const,
    () => {
      if (props.isLocal) {
        return
      }
      const v = props.stream?.getVideoTracks()[0]
      tileLog.debug('remote tile', {
        peerId: props.peerId,
        showVideo: showVideo.value,
        videoPresentation: props.videoPresentation,
        videoEnabled: props.videoEnabled,
        hasLiveVideoTrack: hasLiveVideoTrack.value,
        vt: v
          ? {
              readyState: v.readyState,
              muted: v.muted,
              enabled: v.enabled,
            }
          : null,
      })
    },
    { flush: 'post' },
  )
}
</script>

<template>
  <div
    ref="tileRootRef"
    class="tile"
    draggable="false"
    :data-video-presentation="videoPresentation"
    :class="[
      `tile--${sizeTier}`,
      {
        'is-speaking': isSpeaking,
        'tile--speaking': isSpeaking,
        'tile--menu-open': menuOpen,
        'tile--mafia-kill-anim': mafiaKillAnim,
        'tile--mafia-revive-glow': mafiaReviveAnim,
      },
    ]"
  >
    <div class="tile-media">
      <!-- v-memo: label/speaking zoom/etc. must not re-patch WebRTC elements when only metadata changes. -->
      <StreamAudio
        v-if="!isLocal && audioSplitStream"
        class="tile-audio"
        v-memo="[audioSplitStream, playRev ?? 0, remoteListenVolume ?? 1, remoteListenMuted ?? false]"
        :stream="audioSplitStream"
        :play-rev="playRev"
        :listen-volume="remoteListenVolume ?? 1"
        :listen-muted="remoteListenMuted ?? false"
      />
      <div
        v-if="showVideo"
        class="tile-video-wrap"
        :class="{ 'tile-video-wrap--mafia-dead': mafiaDeadShade }"
      >
        <div class="tile-video-clip" v-memo="streamVideoMemoDeps">
          <StreamVideo
            :key="streamVideoStableKey"
            :stream="stream"
            muted
            :play-rev="playRev"
            :report-video-ui="false"
            :remote-playback-stall-peer-id="remotePlaybackStallPeerIdForVideo"
            :video-presentation="
              videoPresentation && videoPresentation !== 'none' ? videoPresentation : undefined
            "
            fill
            :fill-cover="Boolean(videoFillCover)"
            :playback-suppressed="Boolean(videoPlaybackSuppressed)"
            :target-playback-fps="videoTargetPlaybackFps"
            @remote-playback-stall="(p) => emit('remote-playback-stall', p)"
          />
        </div>
        <div v-if="mafiaDeadShade" class="tile-dead-veneer" aria-hidden="true" />
        <div class="tile-overlay" aria-hidden="false">
          <div
            v-if="!editingName"
            class="tile-overlay__label-group"
            :class="{ 'tile-overlay__label-group--editable': !streamViewMode }"
            :title="streamViewMode ? undefined : t('callPage.renameLocalHint')"
            @dblclick.stop="startNameEdit"
          >
            <span
              v-if="showMafiaSeat"
              class="tile-overlay__seat-badge"
              aria-hidden="true"
              >{{ mafiaSeatIndex }}</span
            >
            <span
              v-if="showMafiaRole"
              class="tile-overlay__role-badge"
              :title="mafiaRoleLabel"
              aria-hidden="true"
              >{{ mafiaRoleLabel }}</span
            >
            <span
              class="tile-overlay__display-name"
              :class="{ 'tile-overlay__display-name--editable': !streamViewMode }"
            >{{ mafiaCallPrimaryLine }}</span>
          </div>
          <div v-else class="tile-overlay__name-edit">
            <span v-if="showMafiaSeat" class="tile-overlay__seat-badge" aria-hidden="true">{{ mafiaSeatIndex }}</span>
            <span
              v-if="showMafiaRole"
              class="tile-overlay__role-badge"
              :title="mafiaRoleLabel"
              aria-hidden="true"
              >{{ mafiaRoleLabel }}</span
            >
            <input
              ref="nameInputRef"
              v-model="nameDraft"
              class="tile-overlay__name-input"
              type="text"
              maxlength="64"
              :aria-label="t('callPage.editNameAria')"
              @blur="finishNameEdit"
              @keydown.enter.prevent="onNameInputEnter"
              @keydown.escape.prevent="cancelNameEdit"
            />
          </div>
          <span v-if="!streamViewMode" class="tile-overlay__icons" aria-hidden="true">
            <span v-if="raiseHand" class="tile-overlay__hand" :title="t('callPage.raiseHandBadge')" aria-hidden="true"
              >✋</span
            >
            <span class="tile-overlay__mic" :class="{ 'tile-overlay__mic--off': !audioEnabled }">
              <svg
                v-if="audioEnabled"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                width="15"
                height="15"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3c-1.66 0-3 1.2-3 2.7v4.6c0 1.5 1.34 2.7 3 2.7s3-1.2 3-2.7V5.7C15 4.2 13.66 3 12 3Z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="15"
                height="15"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <path d="M12 19v3" />
                <path d="M3 3l18 18" />
              </svg>
            </span>
          </span>
        </div>
      </div>
      <div v-if="!showVideo" class="tile-placeholder">
        <div class="tile-placeholder__main">
          <MafiaEliminationMark
            v-if="showMafiaElimination"
            class="tile-placeholder-elimination"
            :kind="mafiaEliminationKind"
          />
          <img
            v-else-if="showAvatar"
            class="tile-placeholder-avatar tile-placeholder-avatar--img"
            :src="resolvedAvatarUrl"
            alt=""
            decoding="async"
            loading="lazy"
          />
          <span v-else-if="showInitialsFallback" class="tile-placeholder-avatar">{{ initials(displayName) }}</span>
        </div>
        <div class="tile-overlay tile-overlay--on-placeholder" aria-hidden="false">
          <div
            v-if="!editingName"
            class="tile-overlay__label-group"
            :class="{ 'tile-overlay__label-group--editable': !streamViewMode }"
            :title="streamViewMode ? undefined : t('callPage.renameLocalHint')"
            @dblclick.stop="startNameEdit"
          >
            <span
              v-if="showMafiaSeat"
              class="tile-overlay__seat-badge"
              aria-hidden="true"
              >{{ mafiaSeatIndex }}</span
            >
            <span
              v-if="showMafiaRole"
              class="tile-overlay__role-badge"
              :title="mafiaRoleLabel"
              aria-hidden="true"
              >{{ mafiaRoleLabel }}</span
            >
            <span
              class="tile-overlay__display-name"
              :class="{ 'tile-overlay__display-name--editable': !streamViewMode }"
            >{{ mafiaCallPrimaryLine }}</span>
          </div>
          <div v-else class="tile-overlay__name-edit">
            <span v-if="showMafiaSeat" class="tile-overlay__seat-badge" aria-hidden="true">{{ mafiaSeatIndex }}</span>
            <span
              v-if="showMafiaRole"
              class="tile-overlay__role-badge"
              :title="mafiaRoleLabel"
              aria-hidden="true"
              >{{ mafiaRoleLabel }}</span
            >
            <input
              ref="nameInputRef"
              v-model="nameDraft"
              class="tile-overlay__name-input"
              type="text"
              maxlength="64"
              :aria-label="t('callPage.editNameAria')"
              @blur="finishNameEdit"
              @keydown.enter.prevent="onNameInputEnter"
              @keydown.escape.prevent="cancelNameEdit"
            />
          </div>
          <span v-if="!streamViewMode" class="tile-overlay__icons" aria-hidden="true">
            <span v-if="raiseHand" class="tile-overlay__hand" :title="t('callPage.raiseHandBadge')" aria-hidden="true"
              >✋</span
            >
            <span class="tile-overlay__mic" :class="{ 'tile-overlay__mic--off': !audioEnabled }">
              <svg
                v-if="audioEnabled"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                width="15"
                height="15"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3c-1.66 0-3 1.2-3 2.7v4.6c0 1.5 1.34 2.7 3 2.7s3-1.2 3-2.7V5.7C15 4.2 13.66 3 12 3Z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="15"
                height="15"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <path d="M12 19v3" />
                <path d="M3 3l18 18" />
              </svg>
            </span>
          </span>
        </div>
      </div>
      <div v-if="!isLocal && !streamViewMode" class="tile-menu-cluster">
        <button
          v-if="mafiaHostShowLifeToggle"
          type="button"
          class="tile-menu__life"
          data-no-mafia-tile-host
          :title="
            mafiaEliminated
              ? t('mafiaPage.hostTileReviveTitle')
              : t('mafiaPage.hostTileEliminateTitle')
          "
          :aria-label="
            mafiaEliminated
              ? t('mafiaPage.hostTileReviveTitle')
              : t('mafiaPage.hostTileEliminateTitle')
          "
          @click.stop="onMafiaHostLifeClick"
        >
          <span class="tile-menu__life-ico" aria-hidden="true">{{
            mafiaEliminated ? '❤️' : '💀'
          }}</span>
        </button>
        <div ref="menuRoot" class="tile-menu-hoverable tile-menu-hoverable--remote">
          <div class="tile-menu tile-menu--remote">
            <button
              type="button"
              class="tile-menu__trigger"
              draggable="false"
              :aria-expanded="menuOpen"
              :aria-label="t('callPage.participantMenu')"
              @click.stop="toggleMenu"
            >
              ⋯
            </button>
            <div
              v-if="menuOpen"
              class="tile-menu__dropdown"
              draggable="false"
              @click.stop
              @dragstart.stop.prevent
              @mousedown.stop
              @pointerdown.stop
              @touchstart.stop
            >
              <label class="tile-menu__row">
                <span class="tile-menu__label">{{ t('callPage.listenVolume') }}</span>
                <span class="tile-menu__pct">{{ volumePercentUi }}%</span>
              </label>
              <input
                class="tile-menu__range"
                type="range"
                min="0"
                max="200"
                :value="volumePercentUi"
                draggable="false"
                @input="onVolumeSliderInput"
                @click.stop
                @dragstart.stop.prevent
                @mousedown.stop
                @pointerdown.stop
                @touchstart.stop
              />
              <label class="tile-menu__row tile-menu__row--check">
                <input
                  type="checkbox"
                  :checked="remoteListenMuted ?? false"
                  @change="onMuteCheckboxChange"
                  @click.stop
                  @mousedown.stop
                  @pointerdown.stop
                  @touchstart.stop
                />
                <span>{{ t('callPage.listenMuteLocal') }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 14px;
  overflow: hidden;
  background: transparent;
  border: 1px solid var(--call-tile-border, #2e303a);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

/**
 * Active talker: Web Audio RMS in call-core (remotes) or `useLocalTileSpeakingVisual` (local).
 * Outer glow + tile scale live on `CallPage` `.call-page__tile-wrap` (grid `overflow` clips inner shadow).
 * Here: border + inner video nudge only.
 */
.tile.is-speaking {
  overflow: visible;
  z-index: 1;
  border-color: color-mix(in srgb, #a855f7 40%, var(--call-tile-border, #2e303a));
}

.tile.is-speaking .tile-video-wrap {
  transform: none;
}

/* Без тіні — лише легкий scale (і рамка), щоб не «випирала» картка над сіткою. */
.tile:hover:not(.is-speaking),
.tile:focus-within:not(.is-speaking) {
  transform: scale(1.01);
  border-color: color-mix(in srgb, var(--sa-color-border, #2e303a) 80%, transparent);
}

.tile--menu-open {
  overflow: visible;
  z-index: 4;
}

.tile--mafia-kill-anim {
  animation: mafia-tile-kill 0.42s ease;
}

.tile--mafia-revive-glow {
  animation: mafia-tile-revive 0.7s ease;
}

@keyframes mafia-tile-kill {
  0% {
    filter: none;
  }
  100% {
    filter: brightness(0.7);
  }
}

@keyframes mafia-tile-revive {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, #22c55e 0%, transparent);
  }
  40% {
    box-shadow: 0 0 0 3px color-mix(in srgb, #4ade80 50%, transparent),
      0 0 20px color-mix(in srgb, #22c55e 45%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile--mafia-kill-anim,
  .tile--mafia-revive-glow {
    animation: none;
  }

  .tile--speaking .tile-video-wrap {
    transform: none;
  }

  .tile.is-speaking {
    box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.45);
    transform: none;
  }

  .tile-video-wrap {
    transition: none;
  }
}

.tile-media {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  min-height: 0;
  aspect-ratio: 16 / 9;
  /* Matting behind `object-fit: contain` video (camera or screen); portrait phone feeds letterbox inside. */
  background: #050508;
  border-radius: 14px;
  container-type: size;
}

.tile-audio {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
}

/* Speaking highlight: `rowSpeaking` from CallPage; scales whole `.tile-video-wrap` (webcam + overlay). */
.tile-video-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
  border-radius: 14px;
  /* Clips video/overlay; participant menu is a sibling under `.tile-media` so it is not clipped here. */
  overflow: hidden;
  transform-origin: center center;
  transition: transform 0.2s ease;
}

.tile--speaking .tile-video-wrap {
  transform: scale(1.02);
}

.tile-video-wrap--mafia-dead .tile-video-clip {
  filter: grayscale(0.9) brightness(0.5);
  transition: filter 0.32s ease;
}

.tile-dead-veneer {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 14px;
  pointer-events: none;
  background: linear-gradient(180deg, rgb(0 0 0 / 0.35) 0%, rgb(0 0 0 / 0.6) 100%);
  transition: opacity 0.32s ease;
}

.tile-video-clip {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  z-index: 0;
  /* `overflow:hidden` alone often leaves square bottom corners on <video>; clip-path forces a rounded mask. */
  clip-path: inset(0 round 14px);
}

.tile-video-wrap :deep(.stream-video) {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

/**
 * Call grid uses `fill-cover=false` → StreamVideo `object-fit: contain` (camera + screen).
 * Extra guard for narrow tiles if `fill-cover` ever changes.
 */
@media (max-width: 768px) {
  .tile-video-clip :deep(.stream-video--fill) {
    object-fit: contain !important;
  }
}

.tile-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem 0.55rem;
  background: linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.05));
  pointer-events: none;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
}

/* Bottom bar: name + Mafia seat — layout matches call HUD density (`--sa-space-*`). */
.tile-overlay__label-group {
  display: flex;
  align-items: center;
  gap: var(--sa-space-2, 0.5rem);
  flex: 1;
  min-width: 0;
  pointer-events: none;
}

.tile-overlay__label-group--editable {
  pointer-events: auto;
}

/** Mafia seat: small dark circle, white digit — left of the role chip (name is separate). */
.tile-overlay__seat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 1.3rem;
  height: 1.3rem;
  padding: 0 0.2rem;
  border-radius: 9999px;
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1;
  color: #fff;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: color-mix(in srgb, #2a2a2e 88%, #000);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
}

.tile-overlay__role-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 5.2rem;
  padding: 0.1rem 0.32rem;
  border-radius: 6px;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #f5f3ff;
  border: 1px solid color-mix(in srgb, #a78bfa 50%, transparent);
  background: color-mix(in srgb, #4c1d95 35%, #000 65%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-overlay__display-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #f9fafb;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tile-overlay__display-name--editable {
  pointer-events: auto;
  cursor: text;
}

.tile-overlay__name-edit {
  display: flex;
  align-items: center;
  gap: var(--sa-space-2, 0.5rem);
  flex: 1;
  min-width: 0;
  pointer-events: auto;
}

/** Inline rename: matches `CallPage` `.call-page__room-pop-field input` (call shell / `sa` tokens). */
.tile-overlay__name-input {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  color: var(--sa-color-text-main);
  outline: none;
}

.tile-overlay__name-input:focus-visible {
  outline: 2px solid var(--sa-color-primary, #a78bfa);
  outline-offset: 1px;
}

.tile-overlay__icons {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.tile-overlay__hand {
  font-size: 0.85rem;
  line-height: 1;
  filter: drop-shadow(0 0 4px rgb(250 204 21 / 0.45));
}

.tile-overlay__mic {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.95;
  color: #86efac;
}

.tile-overlay__mic--off {
  color: #f87171;
  opacity: 0.95;
}

/**
 * Mafia + remote controls: top-right, row-reverse so 💀/❤️ sits at the true top-right, ⋯ to its left.
 * Life control stays visible; ⋯ is hidden on desktop until tile hover.
 */
.tile-menu-cluster {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 40;
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  max-width: calc(100% - 0.5rem);
  pointer-events: auto;
  opacity: 1;
}

.tile-menu {
  position: relative;
  transition: opacity 0.15s ease;
}

/** Remote menu above overlays; visibility: hover on desktop, always on touch / narrow viewports. */
.tile-menu--remote {
  z-index: 1;
}

.tile-menu__life {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  line-height: 0;
  font-size: 0;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #f87171 50%, var(--sa-color-border, #2e303a));
  background: rgb(0 0 0 / 0.58);
  color: #fecaca;
  cursor: pointer;
  box-shadow: 0 0 0 1px color-mix(in srgb, #f87171 20%, transparent);
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.16s ease;
  z-index: 2;
}

.tile-menu__life:hover {
  background: color-mix(in srgb, #f87171 18%, #000 82%);
  box-shadow: 0 0 12px color-mix(in srgb, #f87171 38%, transparent);
  transform: scale(1.05);
}

.tile-menu__life-ico {
  display: block;
  font-size: 1.05rem;
  line-height: 1;
}

/** Wraps the ⋯ menu only; fade on desktop until tile hover. */
.tile-menu-hoverable--remote {
  position: relative;
  transition: opacity 0.15s ease;
}

@media (max-width: 768px), (hover: none) {
  .tile-menu-hoverable--remote {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (min-width: 769px) and (hover: hover) {
  .tile-menu-hoverable--remote {
    opacity: 0;
    pointer-events: none;
  }

  .tile:hover .tile-menu-hoverable--remote,
  .tile--menu-open .tile-menu-hoverable--remote {
    opacity: 1;
    pointer-events: auto;
  }
}

.tile-menu__trigger {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.18);
  background: rgb(0 0 0 / 0.55);
  color: #f3f4f6;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;
}

.tile-menu__trigger:hover {
  background: rgb(0 0 0 / 0.72);
  box-shadow: 0 0 16px rgb(255 255 255 / 0.12);
  transform: scale(1.04);
}

.tile-menu__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  bottom: auto;
  right: 0;
  z-index: 60;
  min-width: 13rem;
  max-width: min(17rem, calc(100vw - 1.5rem));
  padding: 10px 12px 12px;
  border-radius: 8px;
  border: 1px solid rgb(0 0 0 / 0.45);
  background: #2b2d31;
  box-shadow:
    0 12px 32px rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.tile-menu__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #f2f3f5;
  margin-bottom: 0.5rem;
}

.tile-menu__row--check {
  margin-bottom: 0;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgb(0 0 0 / 0.35);
  font-size: 0.72rem;
  font-weight: 500;
  color: #dbdee1;
  cursor: pointer;
}

.tile-menu__label {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.tile-menu__pct {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.7rem;
  color: #949ba4;
}

.tile-menu__range {
  width: 100%;
  margin: 0;
  height: 5px;
  border-radius: 3px;
  accent-color: #5865f2;
  cursor: pointer;
}

.tile-menu__row--check input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  accent-color: #5865f2;
  cursor: pointer;
}

.tile-placeholder {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 14px;
  overflow: hidden;
  clip-path: inset(0 round 14px);
  background: #000;
  color: var(--text-h, #f3f4f6);
}

.tile-placeholder__main {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  min-height: 0;
  min-width: 0;
  pointer-events: none;
}

.tile-overlay--on-placeholder {
  z-index: 2;
}

.tile-placeholder-avatar {
  box-sizing: border-box;
  flex-shrink: 0;
  /* Scales with the tile: cqmin tracks the smaller tile axis; cap relative to inline size. */
  --tile-avatar-size: min(42cqmin, 32cqi, 7.5rem);
  width: var(--tile-avatar-size);
  height: var(--tile-avatar-size);
  min-width: 2.5rem;
  min-height: 2.5rem;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.08);
  border: 1px solid rgb(255 255 255 / 0.14);
  color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: clamp(0.75rem, 9cqmin, 1.4rem);
}

.tile-placeholder-avatar--img {
  display: block;
  object-fit: cover;
  padding: 0;
  flex-shrink: 0;
}
</style>



