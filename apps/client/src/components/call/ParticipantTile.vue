<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import StreamAudio from '../StreamAudio.vue'
import StreamVideo from '../StreamVideo.vue'

const props = defineProps<{
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
}>()

function initials(name: string): string {
  const n = typeof name === 'string' ? name : String(name ?? '')
  const parts = n.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** Remote: audio-only split stream for <audio> (video uses the same composite stream as props). */
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
  clearSplitHolder(audioSplitStream)
})

/** Local: any video track — no muted/readyState gating (getUserMedia quirk). */
const hasAnyVideoTrack = computed(
  () => Boolean(props.stream && props.stream.getVideoTracks().length > 0),
)

/**
 * Remote: show <video> once the track exists and is live.
 * Do not require !track.muted — recv tracks often stay muted until the first RTP frame.
 */
const hasLiveRemoteVideo = computed(() => {
  if (!props.stream || props.isLocal) {
    return false
  }
  return props.stream
    .getVideoTracks()
    .some((t) => t.enabled && t.readyState === 'live')
})

const showVideo = computed(() => {
  if (!props.stream) {
    return false
  }
  if (props.isLocal) {
    return hasAnyVideoTrack.value
  }
  return props.videoEnabled && hasLiveRemoteVideo.value
})

const videoUi = shallowRef({ readyState: -1, videoWidth: 0, videoHeight: 0 })

function onVideoUi(p: { readyState: number; videoWidth: number; videoHeight: number }): void {
  if (props.isLocal) {
    return
  }
  videoUi.value = p
}

watch(
  () => showVideo.value,
  (show) => {
    if (!show) {
      videoUi.value = { readyState: -1, videoWidth: 0, videoHeight: 0 }
    }
  },
)

const isFrozen = computed(() => {
  if (props.isLocal || !showVideo.value || !props.stream) {
    return false
  }
  const v = props.stream.getVideoTracks().find((t) => t.kind === 'video')
  if (!v || v.readyState !== 'live' || !v.enabled) {
    return false
  }
  const rs = videoUi.value.readyState
  if (rs < 0) {
    return false
  }
  return rs === HTMLMediaElement.HAVE_NOTHING
})

const placeholderHint = computed(() => {
  if (props.isLocal) {
    if (!props.stream) {
      return 'Connecting…'
    }
    if (!hasAnyVideoTrack.value) {
      return 'Camera off'
    }
    return ''
  }
  if (!props.videoEnabled) {
    return 'No video'
  }
  if (!hasLiveRemoteVideo.value) {
    return 'Connecting…'
  }
  return ''
})
</script>

<template>
  <div
    class="tile"
    :class="[`tile--${sizeTier}`, { 'tile--active-speaker': activeSpeaker }]"
  >
    <div class="tile-media">
      <StreamAudio
        v-if="!isLocal && audioSplitStream"
        class="tile-audio"
        :stream="audioSplitStream"
        :play-rev="playRev"
      />
      <div v-if="showVideo" class="tile-video-wrap">
        <StreamVideo
          :stream="stream"
          muted
          :play-rev="playRev"
          :report-video-ui="!isLocal"
          fill
          @video-ui="onVideoUi"
        />
        <div v-if="isFrozen" class="tile-freeze" aria-live="polite">Reconnecting…</div>
      </div>
      <div v-else class="tile-placeholder">
        <span class="tile-placeholder-avatar">{{ initials(displayName) }}</span>
        <span class="tile-placeholder-hint">{{ placeholderHint }}</span>
      </div>
    </div>
    <div class="tile-bar">
      <span class="tile-name">{{ displayName }}</span>
      <span class="tile-mic" :class="{ 'tile-mic--off': !audioEnabled }" aria-hidden="true">
        {{ audioEnabled ? '●' : '○' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--call-tile-bg, #1a1b22);
  border: 1px solid var(--call-tile-border, #2e303a);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.tile--active-speaker {
  border-color: var(--accent, #c084fc);
  /* Inset glow avoids extra outer box-shadow footprint (less perceived “jump” vs video). */
  box-shadow: inset 0 0 0 2px rgba(192, 132, 252, 0.55);
}

.tile--lg .tile-media {
  aspect-ratio: 16 / 10;
  min-height: 200px;
}

.tile--md .tile-media {
  aspect-ratio: 16 / 10;
  min-height: 140px;
}

.tile--sm .tile-media {
  aspect-ratio: 16 / 10;
  min-height: 100px;
}

.tile-media {
  position: relative;
  flex: 1;
  min-height: 0;
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
}

.tile-video-wrap :deep(.stream-video) {
  width: 100%;
  height: 100%;
}

.tile-freeze {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: var(--text-h, #f3f4f6);
  font-size: 0.75rem;
  z-index: 2;
  pointer-events: none;
}

.tile-video {
  position: absolute;
  inset: 0;
}

.tile-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(160deg, #252630 0%, #12131a 100%);
  color: var(--text-h, #f3f4f6);
  z-index: 1;
}

.tile-placeholder-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--accent-bg, rgba(192, 132, 252, 0.2));
  color: var(--accent, #c084fc);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
}

.tile--sm .tile-placeholder-avatar {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 0.95rem;
}

.tile-placeholder-hint {
  font-size: 0.75rem;
  opacity: 0.75;
}

.tile-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  background: rgba(0, 0, 0, 0.35);
  color: var(--text-h, #f3f4f6);
}

.tile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-mic {
  flex-shrink: 0;
  opacity: 0.9;
  font-size: 0.65rem;
}

.tile-mic--off {
  opacity: 0.45;
}
</style>
