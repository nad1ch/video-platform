<script setup>
/**
 * Обгортка: витягує поля з getTile(player) у скрипті, у шаблоні лише готові пропси для ParticipantTile.
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

const lk = computed(() => props.getTile(props.player))

const participant = computed(() => lk.value?.participant ?? null)
const identity = computed(() => lk.value?.identity ?? '')
const label = computed(() => lk.value?.label ?? '')
const isLocal = computed(() => lk.value?.isLocal ?? false)
const showVideo = computed(() => lk.value?.showVideo ?? false)
const isMuted = computed(() => lk.value?.isMuted ?? false)
const isSpeaking = computed(() => lk.value?.isSpeaking ?? false)
const volume = computed(() => props.getVolume(props.player))

const ready = computed(() => Boolean(lk.value && participant.value))
</script>

<template>
  <ParticipantTile
    v-if="ready"
    :layer="layer"
    :solo-fill="soloFill"
    :mosaic-mode="mosaicMode"
    :embed="embed"
    :participant="participant"
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
