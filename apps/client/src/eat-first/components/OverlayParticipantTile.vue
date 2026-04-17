<script setup>
/**
 * Витягує поля з getTile(player) для ParticipantTile (mediasoup / MediaStream).
 */
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import ParticipantTile from './ParticipantTile.vue'
import { overlayAvatarUrlForTile } from '../utils/overlayParticipantDisplay.js'

const props = defineProps({
  player: { type: Object, required: true },
  getTile: { type: Function, required: true },
  getVolume: { type: Function, required: true },
  layer: { type: Boolean, default: false },
  soloFill: { type: Boolean, default: false },
  mosaicMode: { type: Boolean, default: false },
  embed: { type: Boolean, default: false },
})

const emit = defineEmits(['update:volume'])

const { user } = useAuth()

/**
 * Single derived snapshot per player: one `getTile` + one `getVolume` per invalidation
 * (avoids a chain of computeds each re-reading `tile.value` and extra dependency edges).
 */
const tileView = computed(() => {
  const raw = props.getTile(props.player)
  const volume = props.getVolume(props.player)
  if (!raw || !(raw.mediaStream instanceof MediaStream)) {
    return null
  }
  const v = typeof volume === 'number' && Number.isFinite(volume) ? volume : 1
  return {
    mediaStream: raw.mediaStream,
    identity: raw.identity ?? '',
    label: raw.label ?? '',
    isLocal: Boolean(raw.isLocal),
    showVideo: Boolean(raw.showVideo),
    isMuted: Boolean(raw.isMuted),
    isSpeaking: Boolean(raw.isSpeaking),
    volume: v,
  }
})

const avatarUrlForTile = computed(() => {
  if (!tileView.value) {
    return ''
  }
  return overlayAvatarUrlForTile(props.player, tileView.value.isLocal, user.value?.avatar)
})
</script>

<template>
  <ParticipantTile
    v-if="tileView"
    :layer="layer"
    :solo-fill="soloFill"
    :mosaic-mode="mosaicMode"
    :embed="embed"
    :media-stream="tileView.mediaStream"
    :identity="tileView.identity"
    :label="tileView.label"
    :is-local="tileView.isLocal"
    :show-video="tileView.showVideo"
    :is-muted="tileView.isMuted"
    :is-speaking="tileView.isSpeaking"
    :volume="tileView.volume"
    :avatar-url="avatarUrlForTile"
    @update:volume="emit('update:volume', $event)"
  />
</template>
