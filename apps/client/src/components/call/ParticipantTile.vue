<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeDisplayName } from 'call-core'
import { createLogger } from '@/utils/logger'
import StreamAudio from '../StreamAudio.vue'
import StreamVideo from '../StreamVideo.vue'

const tileLog = createLogger('participant-tile')

const { t } = useI18n()

const emit = defineEmits<{
  'update:listenVolume': [value: number]
  'update:listenMuted': [value: boolean]
  /** Local-only label override (`name` null or empty clears). */
  'commit-local-display-name': [payload: { peerId: string; name: string | null }]
}>()

const props = defineProps<{
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
  /** Remote/local tile with strongest mic level (Web Audio analyser). */
  activeSpeaker?: boolean
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
}>()

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

const editingName = ref(false)
const nameDraft = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function peerIdForNameEdit(): string {
  return typeof props.peerId === 'string' ? props.peerId.trim() : ''
}

function startNameEdit(): void {
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

function persistVolumeMirror(gain: number): void {
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (!id || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(`volume_${id}`, String(Math.round(gain * 100)))
  } catch {
    /* ignore */
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

onMounted(() => {
  if (props.isLocal) {
    return
  }
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (!id || typeof localStorage === 'undefined') {
    return
  }
  try {
    const raw = localStorage.getItem(`volume_${id}`)
    if (raw == null) {
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 200) {
      return
    }
    emit('update:listenVolume', n / 100)
  } catch {
    /* ignore */
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

const resolvedAvatarUrl = computed(() => {
  const u = props.avatarUrl
  return typeof u === 'string' && u.trim().length > 0 ? u.trim() : ''
})

/** Video-off filler: OAuth avatar when provided, else initials (below). */
const showAvatar = computed(() => !showVideo.value && resolvedAvatarUrl.value !== '')
const showInitialsFallback = computed(() => !showVideo.value && resolvedAvatarUrl.value === '')

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

/** Memo deps for the video subtree — label/mic/activeSpeaker can change without patching WebRTC. */
const streamVideoMemoDeps = computed(() => [
  props.stream,
  props.playRev ?? 0,
  showVideo.value,
  hasLiveVideoTrack.value,
  Boolean(props.videoFillCover),
  props.isLocal,
  props.videoPresentation,
])

function onVolumeSliderInput(ev: Event): void {
  const t = ev.target as HTMLInputElement
  const pct = Math.min(200, Math.max(0, Number(t.value)))
  const gain = pct / 100
  emit('update:listenVolume', gain)
  persistVolumeMirror(gain)
}

function onMuteCheckboxChange(ev: Event): void {
  const t = ev.target as HTMLInputElement
  emit('update:listenMuted', t.checked)
}

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

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
    class="tile"
    draggable="false"
    :data-video-presentation="videoPresentation"
    :class="[
      `tile--${sizeTier}`,
      { 'tile--active-speaker': activeSpeaker, 'tile--menu-open': menuOpen },
    ]"
  >
    <div class="tile-media">
      <!-- v-memo: label/activeSpeaker/etc. must not re-patch WebRTC elements when only metadata changes. -->
      <StreamAudio
        v-if="!isLocal && audioSplitStream"
        class="tile-audio"
        v-memo="[audioSplitStream, playRev ?? 0, remoteListenVolume ?? 1, remoteListenMuted ?? false]"
        :stream="audioSplitStream"
        :play-rev="playRev"
        :listen-volume="remoteListenVolume ?? 1"
        :listen-muted="remoteListenMuted ?? false"
      />
      <div v-if="showVideo" class="tile-video-wrap">
        <div class="tile-video-clip" v-memo="streamVideoMemoDeps">
          <StreamVideo
            :key="streamVideoStableKey"
            :stream="stream"
            muted
            :play-rev="playRev"
            :report-video-ui="false"
            :video-presentation="
              videoPresentation && videoPresentation !== 'none' ? videoPresentation : undefined
            "
            fill
            :fill-cover="Boolean(videoFillCover)"
          />
        </div>
        <div class="tile-overlay" aria-hidden="false">
          <span
            v-if="!editingName"
            class="tile-overlay__name tile-overlay__name--editable"
            title="Double-click to rename (local only)"
            @dblclick.stop="startNameEdit"
            >{{ displayName }}</span
          >
          <input
            v-else
            ref="nameInputRef"
            v-model="nameDraft"
            class="tile-overlay__name tile-overlay__name-input"
            type="text"
            maxlength="64"
            aria-label="Edit display name"
            @blur="finishNameEdit"
            @keydown.enter.prevent="onNameInputEnter"
            @keydown.escape.prevent="cancelNameEdit"
          />
          <span class="tile-overlay__icons" aria-hidden="true">
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
          <img
            v-if="showAvatar"
            class="tile-placeholder-avatar tile-placeholder-avatar--img"
            :src="resolvedAvatarUrl"
            alt=""
            decoding="async"
            loading="lazy"
          />
          <span v-else-if="showInitialsFallback" class="tile-placeholder-avatar">{{ initials(displayName) }}</span>
        </div>
        <div class="tile-overlay tile-overlay--on-placeholder" aria-hidden="false">
          <span
            v-if="!editingName"
            class="tile-overlay__name tile-overlay__name--editable"
            title="Double-click to rename (local only)"
            @dblclick.stop="startNameEdit"
            >{{ displayName }}</span
          >
          <input
            v-else
            ref="nameInputRef"
            v-model="nameDraft"
            class="tile-overlay__name tile-overlay__name-input"
            type="text"
            maxlength="64"
            aria-label="Edit display name"
            @blur="finishNameEdit"
            @keydown.enter.prevent="onNameInputEnter"
            @keydown.escape.prevent="cancelNameEdit"
          />
          <span class="tile-overlay__icons" aria-hidden="true">
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
      <div v-if="!isLocal" ref="menuRoot" class="tile-menu tile-menu--remote">
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
        <div v-if="menuOpen" class="tile-menu__dropdown">
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
            @input="onVolumeSliderInput"
          />
          <label class="tile-menu__row tile-menu__row--check">
            <input
              type="checkbox"
              :checked="remoteListenMuted ?? false"
              @change="onMuteCheckboxChange"
            />
            <span>{{ t('callPage.listenMuteLocal') }}</span>
          </label>
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
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.tile:hover {
  transform: translateY(-1px);
  box-shadow:
    0 12px 32px rgb(0 0 0 / 0.45),
    0 0 0 1px color-mix(in srgb, var(--sa-color-border, #2e303a) 80%, transparent);
}

.tile--menu-open {
  overflow: visible;
  z-index: 4;
}

.tile--active-speaker {
  border-color: var(--accent, #c084fc);
  box-shadow:
    inset 0 0 0 2px rgba(192, 132, 252, 0.45),
    0 12px 28px rgb(0 0 0 / 0.35);
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

.tile-video-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
  border-radius: 14px;
  /* Clips video/overlay; participant menu is a sibling under `.tile-media` so it is not clipped here. */
  overflow: hidden;
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

.tile-overlay__name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #f9fafb;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tile-overlay__name--editable {
  pointer-events: auto;
  cursor: text;
}

.tile-overlay__name-input {
  pointer-events: auto;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  font: inherit;
  font-weight: 600;
  color: #f9fafb;
  background: rgb(0 0 0 / 0.5);
  border: 1px solid rgb(255 255 255 / 0.22);
  border-radius: 6px;
  padding: 0.15rem 0.35rem;
  outline: none;
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

.tile-menu {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  transition: opacity 0.15s ease;
}

/** Remote menu above overlays; visibility: hover on desktop, always on touch / narrow viewports. */
.tile-menu--remote {
  z-index: 40;
}

@media (max-width: 768px), (hover: none) {
  .tile-menu--remote {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (min-width: 769px) and (hover: hover) {
  .tile-menu--remote {
    opacity: 0;
    pointer-events: none;
  }

  .tile:hover .tile-menu--remote,
  .tile--menu-open .tile-menu--remote {
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



