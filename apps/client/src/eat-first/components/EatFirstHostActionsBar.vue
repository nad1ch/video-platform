<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import mafiaHostMuteAllActive from '@/assets/mafia/ui/host-mute-all-active.svg'
import mafiaHostMuteAll from '@/assets/mafia/ui/host-mute-all.svg'
import mafiaHostRoles from '@/assets/mafia/ui/host-roles.svg'

const emit = defineEmits<{
  'force-mute-all': [muted: boolean]
  reshuffle: []
}>()

const { t } = useI18n()
const eatFirstShell = useEatFirstCallShellStore()
const { isEatFirstRoomHost, playerOrder, playerCount, connectedPlayerCount } = storeToRefs(eatFirstShell)

const muteAllActive = ref(false)

const muteAllIcon = computed(() => (muteAllActive.value ? mafiaHostMuteAllActive : mafiaHostMuteAll))
const canReshuffle = computed(
  () => Math.max(playerOrder.value.length, playerCount.value, connectedPlayerCount.value) >= 5,
)

function onMuteAll(): void {
  if (!isEatFirstRoomHost.value) return
  muteAllActive.value = !muteAllActive.value
  emit('force-mute-all', muteAllActive.value)
}

function onReshuffle(): void {
  if (!isEatFirstRoomHost.value || !canReshuffle.value) return
  emit('reshuffle')
}
</script>

<template>
  <div
    v-if="isEatFirstRoomHost"
    class="ef-host-actions"
    role="toolbar"
    :aria-label="t('eatFirstCall.hostActionsAria')"
  >
    <button
      type="button"
      class="ef-host-actions__btn ef-host-actions__btn--mute"
      :class="{ 'ef-host-actions__btn--mute-active': muteAllActive }"
      :title="t('eatFirstCall.forceMuteAllTitle')"
      :aria-label="t('eatFirstCall.forceMuteAllTitle')"
      :aria-pressed="muteAllActive"
      @click="onMuteAll"
    >
      <img
        class="ef-host-actions__full-art"
        :src="muteAllIcon"
        alt=""
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      class="ef-host-actions__btn ef-host-actions__btn--roles"
      :disabled="!canReshuffle"
      :title="canReshuffle ? t('eatFirstCall.reshuffleOrderTitle') : t('eatFirstCall.reshuffleOrderHint')"
      :aria-label="canReshuffle ? t('eatFirstCall.reshuffleOrderTitle') : t('eatFirstCall.reshuffleOrderHint')"
      @click="onReshuffle"
    >
      <img
        class="ef-host-actions__roles-art"
        :src="mafiaHostRoles"
        alt=""
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.ef-host-actions {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 104px;
  height: 55px;
  padding: 7px;
  gap: 8px;
  border-radius: 33px;
  background: rgb(32 20 51 / 0.29);
  pointer-events: auto;
}

.ef-host-actions__btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 41px;
  height: 41px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: transparent;
  cursor: pointer;
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.16s ease;
}

.ef-host-actions__btn:hover:not(:disabled) {
  transform: scale(1.025);
}

.ef-host-actions__btn--mute-active {
  filter: brightness(1.05);
}

.ef-host-actions__btn:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.82);
  outline-offset: 2px;
}

.ef-host-actions__btn:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.ef-host-actions__btn--roles {
  background: rgb(102 56 143 / 0.47);
}

.ef-host-actions__full-art {
  --ef-host-action-hover: 0;
  --ef-host-action-x: 0px;
  --ef-host-action-y: 0px;
  --ef-host-action-scale: 0;
  --ef-host-action-rotate: 0deg;
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--ef-host-action-x) * var(--ef-host-action-hover)),
      calc(var(--ef-host-action-y) * var(--ef-host-action-hover))
    )
    scale(calc(1 + var(--ef-host-action-scale) * var(--ef-host-action-hover)))
    rotate(calc(var(--ef-host-action-rotate) * var(--ef-host-action-hover)));
  transform-origin: center;
  animation: ef-host-action-mics 1.18s ease-in-out infinite;
  transition: --ef-host-action-hover 0.24s ease;
}

.ef-host-actions__btn:hover:not(:disabled) .ef-host-actions__full-art {
  --ef-host-action-hover: 1;
}

.ef-host-actions__roles-art {
  --ef-host-action-hover: 0;
  --ef-host-action-x: 0px;
  --ef-host-action-y: 0px;
  --ef-host-action-scale: 0;
  --ef-host-action-rotate: 0deg;
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--ef-host-action-x) * var(--ef-host-action-hover)),
      calc(var(--ef-host-action-y) * var(--ef-host-action-hover))
    )
    scale(calc(1 + var(--ef-host-action-scale) * var(--ef-host-action-hover)))
    rotate(calc(var(--ef-host-action-rotate) * var(--ef-host-action-hover)));
  transform-origin: center;
  animation: ef-host-action-dice 1.18s ease-in-out infinite;
  transition: --ef-host-action-hover 0.24s ease;
}

.ef-host-actions__btn:hover:not(:disabled) .ef-host-actions__roles-art {
  --ef-host-action-hover: 1;
}

@property --ef-host-action-hover {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --ef-host-action-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --ef-host-action-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --ef-host-action-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --ef-host-action-rotate {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes ef-host-action-mics {
  0%, 100% {
    --ef-host-action-x: 0px;
    --ef-host-action-y: 0px;
    --ef-host-action-scale: 0;
    --ef-host-action-rotate: 0deg;
  }
  42% {
    --ef-host-action-y: -1.2px;
    --ef-host-action-scale: 0.035;
    --ef-host-action-rotate: -1.5deg;
  }
  74% {
    --ef-host-action-y: -0.5px;
    --ef-host-action-scale: 0.016;
    --ef-host-action-rotate: 1deg;
  }
}

@keyframes ef-host-action-dice {
  0%, 100% {
    --ef-host-action-x: 0px;
    --ef-host-action-y: 0px;
    --ef-host-action-scale: 0;
    --ef-host-action-rotate: 0deg;
  }
  38% {
    --ef-host-action-y: -1px;
    --ef-host-action-scale: 0.055;
    --ef-host-action-rotate: -5deg;
  }
  70% {
    --ef-host-action-y: -0.4px;
    --ef-host-action-scale: 0.024;
    --ef-host-action-rotate: 2.5deg;
  }
}
</style>
