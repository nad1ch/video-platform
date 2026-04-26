<script setup>
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  /** Відео/аудіо з MediaStream (mediasoup / call-core). */
  mediaStream: { type: Object, default: null },
  identity: { type: String, default: '' },
  label: { type: String, default: '' },
  isLocal: { type: Boolean, default: false },
  showVideo: { type: Boolean, default: true },
  isMuted: { type: Boolean, default: false },
  isSpeaking: { type: Boolean, default: false },
  volume: { type: Number, default: 1 },
  /** Компактний режим для вбудови в картку гравця */
  embed: { type: Boolean, default: false },
  /** Повна клітинка сітки / шар під оверлеєм */
  layer: { type: Boolean, default: false },
  /** Персональний повноекранний фон (без radius) */
  soloFill: { type: Boolean, default: false },
  /**
   * Глобальна мозаїка: відео вміщується в область над підписом/гучністю (object-fit: contain — без обрізки кадру).
   * Зелена «говоряча» рамка на батьківській клітинці (inset), не на ptile.
   */
  mosaicMode: { type: Boolean, default: false },
  /** Optional profile image when `showVideo` is false (stable HTTPS URL; no generated URLs). */
  avatarUrl: { type: String, default: '' },
})

const emit = defineEmits(['update:volume'])
const { t } = useI18n()

const videoRef = ref(null)
const audioRef = ref(null)

const ptileClass = computed(() => ({
  'ptile--speaking': props.isSpeaking && !props.mosaicMode,
  'ptile--audio': !props.showVideo,
  'ptile--embed': props.embed && !props.layer,
  'ptile--layer': props.layer,
  'ptile--solo-fill': props.soloFill,
  'ptile--mosaic-dynamic': props.mosaicMode && props.layer,
}))

function clearVideoEl() {
  const el = videoRef.value
  if (el) el.srcObject = null
}

function clearAudioEl() {
  const el = audioRef.value
  if (el) el.srcObject = null
}

watch(
  () => [props.mediaStream, props.showVideo, props.identity],
  async () => {
    await nextTick()
    clearVideoEl()
    if (!props.showVideo) return
    const el = videoRef.value
    if (!el) return
    if (props.mediaStream instanceof MediaStream) {
      try {
        el.srcObject = props.mediaStream
        el.muted = !!props.isLocal
      } catch {
        /* */
      }
    }
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => [props.mediaStream, props.isLocal, props.identity],
  async () => {
    await nextTick()
    clearAudioEl()
    if (props.isLocal) return
    const el = audioRef.value
    if (!el) return
    if (props.mediaStream instanceof MediaStream) {
      try {
        el.srcObject = props.mediaStream
      } catch {
        /* */
      }
    }
  },
  { immediate: true, flush: 'post' },
)

onUnmounted(() => {
  clearVideoEl()
  clearAudioEl()
})

function initials() {
  const s = String(props.label || props.identity || '')
  return s.slice(0, 2).toUpperCase()
}

const showAvatarImage = computed(() => {
  const u = props.avatarUrl
  return typeof u === 'string' && u.trim().length > 0
})

/** Stable src for `<img>` (trimmed once). */
const avatarSrc = computed(() => (showAvatarImage.value ? props.avatarUrl.trim() : ''))
</script>

<template>
  <div class="ptile" :class="ptileClass">
    <audio ref="audioRef" class="ptile__audio" autoplay playsinline />
    <template v-if="mosaicMode && layer">
      <div class="ptile__video-stage" :class="{ 'ptile__video-stage--avatar-only': !showVideo }">
        <template v-if="showVideo">
          <!-- v-memo: name/volume row can update without touching <video> bindings. -->
          <div class="ptile__video-wrap" v-memo="[mediaStream, showVideo, avatarSrc]">
            <video
              ref="videoRef"
              class="ptile__video ptile__video--mosaic"
              playsinline
              autoplay
            />
          </div>
        </template>
        <div
          v-else
          class="ptile__avatar ptile__avatar--mosaic"
          :class="{ 'ptile__avatar--photo': showAvatarImage }"
          aria-hidden="true"
        >
          <img
            v-if="showAvatarImage"
            :src="avatarSrc"
            alt=""
            class="ptile__avatar-img"
            loading="lazy"
            decoding="async"
          />
          <span v-else class="ptile__mono">{{ initials() }}</span>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="ptile__media-slot" v-memo="[mediaStream, showVideo, isLocal, avatarSrc]">
        <video
          v-show="showVideo"
          ref="videoRef"
          class="ptile__video"
          playsinline
          autoplay
        />
        <div
          v-show="!showVideo"
          class="ptile__avatar"
          :class="{ 'ptile__avatar--photo': showAvatarImage }"
          aria-hidden="true"
        >
          <img
            v-if="showAvatarImage"
            :src="avatarSrc"
            alt=""
            class="ptile__avatar-img"
            loading="lazy"
            decoding="async"
          />
          <div v-else class="ptile__avatar-letter">
            <span class="ptile__mono">{{ initials() }}</span>
          </div>
        </div>
      </div>
    </template>
    <div class="ptile__meta">
      <span class="ptile__name">{{ label }}</span>
      <span v-if="isMuted" class="ptile__muted" :title="t('app.mediaMuted')" :aria-label="t('app.mediaMuted')">🔇</span>
    </div>
    <label v-if="!isLocal" class="ptile__vol">
      <span class="sr-only">{{ t('app.mediaVolume') }}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="volume"
        @input="(e) => emit('update:volume', Number(e.target.value))"
      />
    </label>
  </div>
</template>

<style scoped>
.ptile {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: #121018;
  border: 2px solid transparent;
  min-height: 0;
  aspect-ratio: 16 / 10;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.ptile--embed {
  aspect-ratio: 16 / 9;
  max-height: clamp(4.5rem, 14vw, 7rem);
  border-radius: 8px;
}
.ptile--embed.ptile--audio {
  max-height: 4.25rem;
  min-height: 4rem;
}
.ptile--layer {
  aspect-ratio: unset;
  max-height: none;
  min-height: 0;
  width: 100%;
  height: 100%;
  border-radius: 14px;
}
.ptile--layer.ptile--audio {
  min-height: 6rem;
}
.ptile--layer .ptile__vol {
  pointer-events: auto;
}
.ptile__audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
/* Fills tile like the former absolutely-positioned <video> (wrapper for v-memo + v-show). */
.ptile__media-slot {
  position: absolute;
  inset: 0;
}
.ptile__media-slot .ptile__avatar {
  position: absolute;
  inset: 0;
  flex: unset;
}
.ptile__avatar--photo {
  padding: 0;
  overflow: hidden;
}
.ptile__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
}
.ptile__avatar-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.ptile--speaking {
  border-color: rgba(34, 197, 94, 0.75);
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.35);
}
.ptile--audio {
  aspect-ratio: auto;
  min-height: 5rem;
}
.ptile__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}
.ptile--layer.ptile--mosaic-dynamic {
  aspect-ratio: unset;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 0;
  border-width: 0;
  background: transparent;
  overflow: hidden;
}
.ptile__video-stage {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
}
.ptile__video-stage--avatar-only {
  flex: 1 1 auto;
  min-height: 3.5rem;
}
.ptile__video-wrap {
  flex: 1 1 auto;
  align-self: stretch;
  width: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
}
.ptile__video--mosaic {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  background: #000;
  border-radius: 6px;
}
.ptile__avatar {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #2a2438, #15121c);
}
.ptile__avatar--mosaic {
  flex: 1 1 auto;
  width: 100%;
  min-height: 3.5rem;
  align-self: stretch;
  border-radius: 6px;
}
.ptile__mono {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.85);
}
.ptile__meta {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.45rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.82));
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.92);
}
.ptile__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ptile__muted {
  opacity: 0.85;
  font-size: 0.85rem;
}
.ptile__vol {
  position: relative;
  z-index: 1;
  display: flex;
  padding: 0 0.45rem 0.4rem;
}
.ptile__vol input {
  width: 100%;
  accent-color: #a78bfa;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
