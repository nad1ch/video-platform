<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import setupClipboardSrc from '@/assets/nadraw-show/setup-clipboard.svg'
import setupClockSrc from '@/assets/nadraw-show/setup-clock.svg'
import setupRoundSrc from '@/assets/nadraw-show/setup-round.svg'
import type { NadrawRoundSetupWordSource } from '../core/nadrawTypes'

const wordSource = defineModel<NadrawRoundSetupWordSource>('wordSource', { required: true })
const roundDurationSec = defineModel<number>('roundDurationSec', { required: true })
const roundCount = defineModel<number>('roundCount', { required: true })

defineProps<{
  startDisabled: boolean
}>()

const emit = defineEmits<{
  start: []
}>()

const { t } = useI18n()

const durationChoices = [30, 60, 90, 120, 240, 360] as const
const roundCountChoices = [5, 10, 20, 30, 50, 100] as const
</script>

<template>
  <section
    class="nadraw-setup sa-glass-panel"
    :aria-label="t('nadrawShow.roundSetupTitle')"
  >
    <div class="nadraw-setup__block nadraw-setup__block--mode">
      <h2 class="nadraw-setup__title">Regimen</h2>
      <div class="nadraw-setup__track nadraw-setup__track--mode sa-glass-panel" role="group" :aria-label="t('nadrawShow.wordSource')">
        <span class="nadraw-setup__icon nadraw-setup__icon--clipboard" aria-hidden="true">
          <img :src="setupClipboardSrc" alt="" aria-hidden="true" />
        </span>
        <button
          type="button"
          class="nadraw-setup__mode sa-glass-button"
          :class="{ 'nadraw-setup__choice--on': wordSource !== 'manual' }"
          @click="wordSource = 'global'"
        >
          System words
        </button>
        <button
          type="button"
          class="nadraw-setup__mode sa-glass-button"
          :class="{ 'nadraw-setup__choice--on': wordSource === 'manual' }"
          @click="wordSource = 'manual'"
        >
          Custom words
        </button>
      </div>
    </div>

    <div class="nadraw-setup__block nadraw-setup__block--timer">
      <h2 class="nadraw-setup__title">Timer</h2>
      <div class="nadraw-setup__track nadraw-setup__track--chips sa-glass-panel" role="group" :aria-label="t('nadrawShow.roundDurationLabel')">
        <span class="nadraw-setup__icon nadraw-setup__icon--clock" aria-hidden="true">
          <img :src="setupClockSrc" alt="" aria-hidden="true" />
        </span>
        <button
          v-for="sec in durationChoices"
          :key="sec"
          type="button"
          class="nadraw-setup__chip sa-glass-button"
          :class="{ 'nadraw-setup__choice--on': roundDurationSec === sec }"
          @click="roundDurationSec = sec"
        >
          {{ sec }}
        </button>
      </div>
    </div>

    <div class="nadraw-setup__block nadraw-setup__block--round">
      <h2 class="nadraw-setup__title">Round</h2>
      <div class="nadraw-setup__track nadraw-setup__track--chips sa-glass-panel" role="group" :aria-label="t('nadrawShow.roundCountLabel')">
        <span class="nadraw-setup__icon nadraw-setup__icon--round" aria-hidden="true">
          <img :src="setupRoundSrc" alt="" aria-hidden="true" />
        </span>
        <button
          v-for="n in roundCountChoices"
          :key="n"
          type="button"
          class="nadraw-setup__chip sa-glass-button"
          :class="{ 'nadraw-setup__choice--on': roundCount === n }"
          @click="roundCount = n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="nadraw-setup__start sa-glass-button"
      :disabled="startDisabled"
      @click="emit('start')"
    >
      Start
    </button>
  </section>
</template>

<style scoped>
.nadraw-setup {
  box-sizing: border-box;
  width: 423px;
  max-width: 100%;
  color: #66388f;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-variation-settings: 'YEAR' 1979;
  letter-spacing: 0;
}

.nadraw-setup.sa-glass-panel {
  border: 0;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.nadraw-setup__block {
  position: relative;
  width: 423px;
}

.nadraw-setup__block--mode {
  height: 141px;
}

.nadraw-setup__block--timer,
.nadraw-setup__block--round {
  height: 121px;
}

.nadraw-setup__title {
  margin: 0;
  height: 57px;
  color: #66388f;
  font-family: inherit;
  font-size: 20px;
  font-weight: 400;
  line-height: 54.904px;
  letter-spacing: 0;
  text-align: center;
  transform: translateY(6px);
}

.nadraw-setup__track {
  position: relative;
  box-sizing: border-box;
  width: 423px;
  overflow: hidden;
  background: rgba(80, 57, 119, 0.21);
}

.nadraw-setup__track--mode {
  height: 91px;
  border-radius: 23px;
  background: rgba(80, 57, 119, 0.25);
}

.nadraw-setup__track--chips {
  display: block;
  height: 61px;
  padding: 0;
  border-radius: 33.691px;
}

.nadraw-setup__icon {
  position: absolute;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8154aa;
  pointer-events: none;
}

.nadraw-setup__icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  user-select: none;
}

.nadraw-setup__icon--clipboard {
  left: 17px;
  top: 7px;
  width: 47px;
  height: 70px;
}

.nadraw-setup__icon--clock {
  left: 18px;
  top: 8px;
  width: 44px;
  height: 45px;
}

.nadraw-setup__icon--round {
  left: 20px;
  top: 9px;
  width: 42px;
  height: 44px;
}

.nadraw-setup__mode,
.nadraw-setup__chip,
.nadraw-setup__start {
  appearance: none;
  border: 0;
  color: rgba(255, 255, 255, 0.94);
  font-family: "Coda Caption", var(--sa-font-display, system-ui, sans-serif);
  font-weight: 800;
  letter-spacing: -0.9076px;
  cursor: pointer;
  transition:
    filter 0.16s ease,
    transform 0.16s ease,
    background 0.16s ease;
}

.nadraw-setup__mode:focus-visible,
.nadraw-setup__chip:focus-visible,
.nadraw-setup__start:focus-visible {
  outline: 2px solid rgba(102, 56, 143, 0.82);
  outline-offset: 2px;
}

.nadraw-setup__mode:hover,
.nadraw-setup__chip:hover,
.nadraw-setup__start:hover:not(:disabled) {
  filter: brightness(1.06);
}

.nadraw-setup__mode:active,
.nadraw-setup__chip:active,
.nadraw-setup__start:active:not(:disabled) {
  transform: scale(0.985);
}

.nadraw-setup__mode {
  position: absolute;
  left: 78px;
  width: 335px;
  height: 32px;
  border-radius: 25.645px;
  background: rgba(102, 56, 143, 0.17);
  font-size: 15.127px;
  line-height: 30.255px;
}

.nadraw-setup__mode:nth-of-type(1) {
  top: 10px;
}

.nadraw-setup__mode:nth-of-type(2) {
  top: 49px;
}

.nadraw-setup__chip {
  position: absolute;
  top: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46.627px;
  height: 32px;
  min-width: 0;
  border-radius: 25.645px;
  background: rgba(102, 56, 143, 0.17);
  font-size: 15.127px;
  line-height: 30.255px;
  text-align: center;
}

.nadraw-setup__track--chips .nadraw-setup__chip:nth-of-type(1) {
  left: 87px;
}

.nadraw-setup__track--chips .nadraw-setup__chip:nth-of-type(2) {
  left: 139px;
}

.nadraw-setup__track--chips .nadraw-setup__chip:nth-of-type(3) {
  left: 191px;
}

.nadraw-setup__track--chips .nadraw-setup__chip:nth-of-type(4) {
  left: 246px;
}

.nadraw-setup__track--chips .nadraw-setup__chip:nth-of-type(5) {
  left: 301px;
  width: 47px;
}

.nadraw-setup__track--chips .nadraw-setup__chip:nth-of-type(6) {
  left: 356px;
  width: 47px;
}

.nadraw-setup__choice--on {
  background: #66388f;
}

.nadraw-setup__start {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 417px;
  height: 67px;
  margin: 9px auto 0;
  border-radius: 25.645px;
  background: #66388f;
  color: #ffffff;
  font-family: "Climate Crisis", var(--sa-font-display, system-ui, sans-serif);
  font-size: 32px;
  
  font-variation-settings: 'YEAR' 1979;
  line-height: 54.904px;
  letter-spacing: 0;
  text-align: center;
}

.nadraw-setup__start:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

@media (max-width: 720px) {
  .nadraw-setup,
  .nadraw-setup__block,
  .nadraw-setup__track {
    width: min(423px, calc(100vw - 48px));
  }

  .nadraw-setup__track--chips {
    height: auto;
    min-height: 61px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 14px 14px 14px 76px;
  }

  .nadraw-setup__track--chips .nadraw-setup__chip {
    position: static;
    width: auto;
    min-width: 46px;
    flex: 1 1 46px;
  }

  .nadraw-setup__mode {
    width: calc(100% - 88px);
  }

  .nadraw-setup__start {
    width: calc(100% - 6px);
  }
}
</style>
