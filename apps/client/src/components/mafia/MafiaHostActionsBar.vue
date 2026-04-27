<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import mafiaHostMuteAllActive from '@/assets/mafia/ui/host-mute-all-active.svg'
import mafiaHostMuteAll from '@/assets/mafia/ui/host-mute-all.svg'
import mafiaHostRoles from '@/assets/mafia/ui/host-roles.svg'

const emit = defineEmits<{
  'force-mute-all': [muted: boolean]
}>()

const { t } = useI18n()
const mafia = useMafiaGameStore()
const mafiaPlayers = useMafiaPlayersStore()
const { isMafiaHost, oldMafiaMode } = storeToRefs(mafia)
const muteAllActive = ref(false)

const canReshuffle = computed(() => {
  const n = mafiaPlayers.joinOrder.length
  if (oldMafiaMode.value) {
    return n >= 2
  }
  return n >= 5 && n <= 12
})

const muteAllIcon = computed(() => (muteAllActive.value ? mafiaHostMuteAllActive : mafiaHostMuteAll))

function onMuteAll(): void {
  if (!isMafiaHost.value) {
    return
  }
  muteAllActive.value = !muteAllActive.value
  emit('force-mute-all', muteAllActive.value)
}

function onReshuffle(): void {
  if (!isMafiaHost.value || !canReshuffle.value) {
    return
  }
  mafia.reshuffleGame()
}

</script>

<template>
  <div
    v-if="isMafiaHost"
    class="mafia-host-actions"
    role="toolbar"
    :aria-label="t('mafiaPage.hostActionsAria')"
  >
    <button
      type="button"
      class="mafia-host-actions__btn mafia-host-actions__btn--mute"
      :class="{ 'mafia-host-actions__btn--mute-active': muteAllActive }"
      :title="t('mafiaPage.forceMuteAllTitle')"
      :aria-label="t('mafiaPage.forceMuteAllTitle')"
      :aria-pressed="muteAllActive"
      @click="onMuteAll"
    >
      <img class="mafia-host-actions__full-art" :src="muteAllIcon" alt="" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="mafia-host-actions__btn mafia-host-actions__btn--roles"
      :disabled="!canReshuffle"
      :title="canReshuffle ? t('mafiaPage.overlayShuffleButtonTitle') : t('mafiaPage.reshuffleCountHint')"
      :aria-label="canReshuffle ? t('mafiaPage.overlayShuffleButtonTitle') : t('mafiaPage.reshuffleCountHint')"
      @click="onReshuffle"
    >
      <img class="mafia-host-actions__roles-art" :src="mafiaHostRoles" alt="" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.mafia-host-actions {
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

.mafia-host-actions__btn {
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

.mafia-host-actions__btn:hover:not(:disabled) {
  transform: scale(1.025);
}

.mafia-host-actions__btn--mute-active {
  filter: brightness(1.05);
}

.mafia-host-actions__btn:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.82);
  outline-offset: 2px;
}

.mafia-host-actions__btn:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.mafia-host-actions__full-art {
  --mafia-host-action-hover: 0;
  --mafia-host-action-x: 0px;
  --mafia-host-action-y: 0px;
  --mafia-host-action-scale: 0;
  --mafia-host-action-rotate: 0deg;
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--mafia-host-action-x) * var(--mafia-host-action-hover)),
      calc(var(--mafia-host-action-y) * var(--mafia-host-action-hover))
    )
    scale(calc(1 + var(--mafia-host-action-scale) * var(--mafia-host-action-hover)))
    rotate(calc(var(--mafia-host-action-rotate) * var(--mafia-host-action-hover)));
  transform-origin: center;
  animation: mafia-host-action-mics 1.18s ease-in-out infinite;
  transition: --mafia-host-action-hover 0.24s ease;
}

.mafia-host-actions__btn:hover:not(:disabled) .mafia-host-actions__full-art {
  --mafia-host-action-hover: 1;
}

.mafia-host-actions__btn--roles {
  background: rgb(102 56 143 / 0.47);
}

.mafia-host-actions__roles-art {
  --mafia-host-action-hover: 0;
  --mafia-host-action-x: 0px;
  --mafia-host-action-y: 0px;
  --mafia-host-action-scale: 0;
  --mafia-host-action-rotate: 0deg;
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
  transform:
    translate(
      calc(var(--mafia-host-action-x) * var(--mafia-host-action-hover)),
      calc(var(--mafia-host-action-y) * var(--mafia-host-action-hover))
    )
    scale(calc(1 + var(--mafia-host-action-scale) * var(--mafia-host-action-hover)))
    rotate(calc(var(--mafia-host-action-rotate) * var(--mafia-host-action-hover)));
  transform-origin: center;
  animation: mafia-host-action-dice 1.18s ease-in-out infinite;
  transition: --mafia-host-action-hover 0.24s ease;
}

.mafia-host-actions__btn:hover:not(:disabled) .mafia-host-actions__roles-art {
  --mafia-host-action-hover: 1;
}

@property --mafia-host-action-hover {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --mafia-host-action-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --mafia-host-action-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --mafia-host-action-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --mafia-host-action-rotate {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes mafia-host-action-mics {
  0%,
  100% {
    --mafia-host-action-x: 0px;
    --mafia-host-action-y: 0px;
    --mafia-host-action-scale: 0;
    --mafia-host-action-rotate: 0deg;
  }

  42% {
    --mafia-host-action-y: -1.2px;
    --mafia-host-action-scale: 0.035;
    --mafia-host-action-rotate: -1.5deg;
  }

  74% {
    --mafia-host-action-y: -0.5px;
    --mafia-host-action-scale: 0.016;
    --mafia-host-action-rotate: 1deg;
  }
}

@keyframes mafia-host-action-dice {
  0%,
  100% {
    --mafia-host-action-x: 0px;
    --mafia-host-action-y: 0px;
    --mafia-host-action-scale: 0;
    --mafia-host-action-rotate: 0deg;
  }

  38% {
    --mafia-host-action-y: -1px;
    --mafia-host-action-scale: 0.055;
    --mafia-host-action-rotate: -5deg;
  }

  70% {
    --mafia-host-action-y: -0.4px;
    --mafia-host-action-scale: 0.024;
    --mafia-host-action-rotate: 2.5deg;
  }
}
</style>
