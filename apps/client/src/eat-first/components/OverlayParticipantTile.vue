<script setup>
/**
 * Витягує поля з getTile(player) для ParticipantTile (mediasoup / MediaStream).
 */
import { computed } from 'vue'
import ParticipantTile from './ParticipantTile.vue'

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

const tile = computed(() => props.getTile(props.player))

const mediaStream = computed(() =>
  tile.value?.mediaStream instanceof MediaStream ? tile.value.mediaStream : null,
)
const identity = computed(() => tile.value?.identity ?? '')
const label = computed(() => tile.value?.label ?? '')
const isLocal = computed(() => tile.value?.isLocal ?? false)
const showVideo = computed(() => tile.value?.showVideo ?? false)
const isMuted = computed(() => tile.value?.isMuted ?? false)
const isSpeaking = computed(() => tile.value?.isSpeaking ?? false)
const volume = computed(() => props.getVolume(props.player))

const ready = computed(() => Boolean(mediaStream.value))
</script>

<template>
  <ParticipantTile
    v-if="ready"
    :layer="layer"
    :solo-fill="soloFill"
    :mosaic-mode="mosaicMode"
    :embed="embed"
    :media-stream="mediaStream"
    :identity="identity"
    :label="label"
    :is-local="isLocal"
    :show-video="showVideo"
    :is-muted="isMuted"
    :is-speaking="isSpeaking"
    :volume="volume"
    @update:volume="emit('update:volume', $event)"
  />
</template>
