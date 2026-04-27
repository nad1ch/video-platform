<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import mafiaHostMuteAllActive from '@/assets/mafia/ui/host-mute-all-active.svg'
import mafiaHostMuteAll from '@/assets/mafia/ui/host-mute-all.svg'
import mafiaHostRoles from '@/assets/mafia/ui/host-roles.svg'

const emit = defineEmits<{
  'force-mute-all': []
}>()

const { t } = useI18n()
const mafia = useMafiaGameStore()
const mafiaPlayers = useMafiaPlayersStore()
const { isMafiaHost } = storeToRefs(mafia)
const muteAllActive = ref(false)
let muteAllActiveTimer: ReturnType<typeof setTimeout> | undefined

const canReshuffle = computed(() => {
  const n = mafiaPlayers.joinOrder.length
  return n >= 5 && n <= 12
})

const muteAllIcon = computed(() => (muteAllActive.value ? mafiaHostMuteAllActive : mafiaHostMuteAll))

function flashMuteAllActive(): void {
  muteAllActive.value = true
  if (muteAllActiveTimer != null) {
    clearTimeout(muteAllActiveTimer)
  }
  muteAllActiveTimer = setTimeout(() => {
    muteAllActive.value = false
    muteAllActiveTimer = undefined
  }, 850)
}

function onMuteAll(): void {
  if (!isMafiaHost.value) {
    return
  }
  flashMuteAllActive()
  emit('force-mute-all')
}

function onReshuffle(): void {
  if (!isMafiaHost.value || !canReshuffle.value) {
    return
  }
  mafia.reshuffleGame()
}

onBeforeUnmount(() => {
  if (muteAllActiveTimer != null) {
    clearTimeout(muteAllActiveTimer)
  }
})
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
    filter 0.16s ease,
    transform 0.16s ease,
    opacity 0.16s ease;
}

.mafia-host-actions__btn:hover:not(:disabled),
.mafia-host-actions__btn:focus-visible:not(:disabled) {
  filter: brightness(1.08);
  transform: scale(1.03);
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
  display: block;
  width: 41px;
  height: 41px;
  object-fit: contain;
}

.mafia-host-actions__btn--roles {
  background: rgb(102 56 143 / 0.47);
}

.mafia-host-actions__roles-art {
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
}
</style>
