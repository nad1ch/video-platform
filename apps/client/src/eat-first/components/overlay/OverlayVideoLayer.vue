<script setup>
import VoiceVideoGrid from '../VoiceVideoGrid.vue'

defineProps({
  lkConnectionState: { type: String, required: true },
  lkError: { type: Object, default: null },
  lkRoomEnabled: { type: Boolean, default: false },
  overlayReady: { type: Boolean, default: false },
  canPublish: { type: Boolean, default: false },
  spectatorMode: { type: Boolean, default: false },
  speakerSlot: { type: String, default: '' },
  spotlightUnmuteMode: { type: Boolean, default: false },
  eliminatedLocal: { type: Boolean, default: false },
  localIdentity: { type: String, required: true },
})
</script>

<template>
  <VoiceVideoGrid
    :lk-connection-state="lkConnectionState"
    :lk-error="lkError"
    :lk-room-enabled="lkRoomEnabled"
    :overlay-ready="overlayReady"
    :can-publish="canPublish"
    :spectator-mode="spectatorMode"
    :speaker-slot="speakerSlot"
    :spotlight-unmute-mode="spotlightUnmuteMode"
    :eliminated-local="eliminatedLocal"
    :local-identity="localIdentity"
  />
</template>
