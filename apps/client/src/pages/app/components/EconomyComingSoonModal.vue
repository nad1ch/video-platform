<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    eyebrow: string
    title: string
    description: string
    closeLabel: string
  }>(),
  {
    eyebrow: 'coming soon...',
    title: 'Interaction Economy',
    description: '',
    closeLabel: 'Close',
  },
)

const emit = defineEmits<{
  close: []
}>()

const slotLetters = Object.freeze(['T', 'W', 'I', 'T', 'C', 'H'] as const)
</script>

<template>
  <Transition name="economy-coming-modal">
    <div v-if="props.open" class="economy-coming-modal" role="presentation" @keydown.esc="emit('close')">
      <button type="button" class="economy-coming-modal__backdrop" :aria-label="closeLabel" @click="emit('close')" />

      <section
        class="economy-coming-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="economy-coming-modal-title"
        aria-describedby="economy-coming-modal-desc"
        tabindex="-1"
      >
        <button type="button" class="economy-coming-modal__close" :aria-label="closeLabel" @click="emit('close')" />

        <span class="economy-coming-modal__speck economy-coming-modal__speck--a" aria-hidden="true" />
        <span class="economy-coming-modal__speck economy-coming-modal__speck--b" aria-hidden="true" />
        <span class="economy-coming-modal__speck economy-coming-modal__speck--c" aria-hidden="true" />
        <span class="economy-coming-modal__speck economy-coming-modal__speck--d" aria-hidden="true" />

        <div class="economy-coming-modal__copy">
          <p class="economy-coming-modal__eyebrow">{{ eyebrow }}</p>
          <h2 id="economy-coming-modal-title" class="economy-coming-modal__title">{{ title }}</h2>
          <p id="economy-coming-modal-desc" class="economy-coming-modal__description">{{ description }}</p>
        </div>

        <span class="economy-coming-modal__machine" aria-hidden="true">
          <span class="economy-coming-modal__jackpot">JACKPOT</span>
          <span class="economy-coming-modal__cells">
            <span v-for="letter in slotLetters" :key="letter" class="economy-coming-modal__cell">{{ letter }}</span>
          </span>
          <span class="economy-coming-modal__underbar economy-coming-modal__underbar--left" />
          <span class="economy-coming-modal__underbar economy-coming-modal__underbar--right" />
          <span class="economy-coming-modal__slot-bar" />
          <span class="economy-coming-modal__machine-dot economy-coming-modal__machine-dot--a" />
          <span class="economy-coming-modal__machine-dot economy-coming-modal__machine-dot--b" />
          <span class="economy-coming-modal__machine-dot economy-coming-modal__machine-dot--c" />
          <span class="economy-coming-modal__handle">
            <span class="economy-coming-modal__handle-stick" />
          </span>
        </span>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.economy-coming-modal {
  position: fixed;
  inset: 0;
  z-index: 13000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.economy-coming-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background:
    radial-gradient(circle at 50% 30%, rgb(124 77 219 / 0.22), transparent 37rem),
    rgb(8 3 18 / 0.76);
  cursor: pointer;
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
}

.economy-coming-modal__dialog {
  --economy-coming-u: calc(100cqw / 1024);
  position: relative;
  z-index: 1;
  container-type: inline-size;
  width: min(1024px, calc(100vw - 2rem));
  aspect-ratio: 1024 / 266;
  min-height: 16.625rem;
  overflow: hidden;
  border: calc(var(--economy-coming-u) * 5.673) solid #fff;
  border-radius: calc(var(--economy-coming-u) * 28.366);
  box-sizing: border-box;
  background:
    linear-gradient(156deg, rgb(124 77 219 / 0.084) 0%, rgb(60 36 99 / 0.144) 73.2%),
    rgb(30 24 39 / 0.96);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 25px 75px rgb(0 0 0 / 0.48);
}

.economy-coming-modal__close {
  position: absolute;
  right: calc(var(--economy-coming-u) * 12);
  top: calc(var(--economy-coming-u) * 12);
  z-index: 4;
  width: calc(var(--economy-coming-u) * 34);
  height: calc(var(--economy-coming-u) * 34);
  min-width: 1.65rem;
  min-height: 1.65rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  opacity: 0;
}

.economy-coming-modal__close:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
  opacity: 1;
}

.economy-coming-modal__close::before,
.economy-coming-modal__close::after {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.95rem;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  content: '';
  transform-origin: center;
}

.economy-coming-modal__close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.economy-coming-modal__close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.economy-coming-modal__speck,
.economy-coming-modal__machine-dot {
  position: absolute;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.11);
  pointer-events: none;
}

.economy-coming-modal__speck--a {
  left: calc(var(--economy-coming-u) * 15);
  top: calc(var(--economy-coming-u) * 15);
  width: calc(var(--economy-coming-u) * 2.1);
  height: calc(var(--economy-coming-u) * 2.1);
}

.economy-coming-modal__speck--b {
  left: calc(var(--economy-coming-u) * 82);
  top: calc(var(--economy-coming-u) * 28);
  width: calc(var(--economy-coming-u) * 1.6);
  height: calc(var(--economy-coming-u) * 1.6);
}

.economy-coming-modal__speck--c {
  left: calc(var(--economy-coming-u) * 174);
  top: calc(var(--economy-coming-u) * 61);
  width: calc(var(--economy-coming-u) * 1.6);
  height: calc(var(--economy-coming-u) * 1.6);
}

.economy-coming-modal__speck--d {
  left: calc(var(--economy-coming-u) * 204);
  top: calc(var(--economy-coming-u) * 16);
  width: calc(var(--economy-coming-u) * 1.6);
  height: calc(var(--economy-coming-u) * 1.6);
}

.economy-coming-modal__copy {
  position: absolute;
  left: calc(var(--economy-coming-u) * 25.16);
  top: calc(var(--economy-coming-u) * 29.16);
  z-index: 2;
  width: calc(var(--economy-coming-u) * 455);
}

.economy-coming-modal__eyebrow {
  margin: 0 0 calc(var(--economy-coming-u) * 41);
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: calc(var(--economy-coming-u) * 16.791);
  font-variation-settings: 'YEAR' 1979;
  line-height: 1.06;
  text-transform: lowercase;
}

.economy-coming-modal__title {
  margin: 0 0 calc(var(--economy-coming-u) * 21);
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: calc(var(--economy-coming-u) * 24);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
}

.economy-coming-modal__description {
  width: calc(var(--economy-coming-u) * 480);
  margin: 0;
  color: rgb(255 255 255 / 0.96);
  font-family: "Marmelad", var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: calc(var(--economy-coming-u) * 15);
  line-height: 1.18;
  white-space: pre-line;
}

.economy-coming-modal__machine {
  position: absolute;
  left: calc(var(--economy-coming-u) * 506);
  top: calc(var(--economy-coming-u) * 26);
  z-index: 1;
  display: block;
  width: calc(var(--economy-coming-u) * 532);
  height: calc(var(--economy-coming-u) * 165);
}

.economy-coming-modal__cells {
  position: absolute;
  left: calc(var(--economy-coming-u) * 3);
  top: calc(var(--economy-coming-u) * 28.23);
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  width: calc(var(--economy-coming-u) * 483.106);
  height: calc(var(--economy-coming-u) * 86.996);
  overflow: hidden;
  border: calc(var(--economy-coming-u) * 5.553) solid #66388f;
  border-radius: calc(var(--economy-coming-u) * 22.212);
  box-sizing: border-box;
  background: #c9d6ff;
}

.economy-coming-modal__cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-right: calc(var(--economy-coming-u) * 0.925) solid #b3c2f5;
  background: #f7f8ff;
  color: #ff3b30;
  font-family: var(--app-home-jackpot, 'Arbutus', serif);
  font-size: calc(var(--economy-coming-u) * 49.977);
  line-height: 1;
  text-shadow:
    calc(var(--economy-coming-u) * 2) 0 0 #ffc831,
    calc(var(--economy-coming-u) * -2) 0 0 #ffc831,
    0 calc(var(--economy-coming-u) * 2) 0 #ffc831,
    0 calc(var(--economy-coming-u) * -2) 0 #ffc831;
}

.economy-coming-modal__cell:last-child {
  border-right: 0;
}

.economy-coming-modal__jackpot {
  position: absolute;
  left: calc(var(--economy-coming-u) * 154);
  top: 0;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--economy-coming-u) * 175.265);
  height: calc(var(--economy-coming-u) * 43.382);
  border: calc(var(--economy-coming-u) * 4.627) solid #7c4ddb;
  border-radius: calc(var(--economy-coming-u) * 22.212);
  box-sizing: border-box;
  background: rgb(255 59 48 / 0.68);
  color: #fff;
  font-family: var(--app-home-jackpot, 'Arbutus', serif);
  font-size: calc(var(--economy-coming-u) * 24.063);
  letter-spacing: 0.04em;
  line-height: 1;
}

.economy-coming-modal__underbar {
  position: absolute;
  top: calc(var(--economy-coming-u) * 138.82);
  width: calc(var(--economy-coming-u) * 40.722);
  height: calc(var(--economy-coming-u) * 7.404);
  border-radius: calc(var(--economy-coming-u) * 3.702);
  background: rgb(255 59 48 / 0.51);
}

.economy-coming-modal__underbar--left {
  left: calc(var(--economy-coming-u) * 110.43);
}

.economy-coming-modal__underbar--right {
  left: calc(var(--economy-coming-u) * 345.5);
}

.economy-coming-modal__slot-bar {
  position: absolute;
  left: calc(var(--economy-coming-u) * 179.61);
  top: calc(var(--economy-coming-u) * 105.04);
  width: calc(var(--economy-coming-u) * 129.569);
  height: calc(var(--economy-coming-u) * 25.914);
  border: calc(var(--economy-coming-u) * 2.776) solid #fff;
  border-radius: calc(var(--economy-coming-u) * 12.957);
  box-sizing: border-box;
  background: rgb(60 36 99 / 0.62);
}

.economy-coming-modal__machine-dot--a {
  left: calc(var(--economy-coming-u) * 234);
  top: calc(var(--economy-coming-u) * 93);
  width: calc(var(--economy-coming-u) * 3);
  height: calc(var(--economy-coming-u) * 3);
}

.economy-coming-modal__machine-dot--b {
  left: calc(var(--economy-coming-u) * 434);
  top: calc(var(--economy-coming-u) * 33);
  width: calc(var(--economy-coming-u) * 3);
  height: calc(var(--economy-coming-u) * 3);
}

.economy-coming-modal__machine-dot--c {
  left: calc(var(--economy-coming-u) * 470);
  top: calc(var(--economy-coming-u) * 56);
  width: calc(var(--economy-coming-u) * 3);
  height: calc(var(--economy-coming-u) * 3);
}

.economy-coming-modal__handle {
  position: absolute;
  left: calc(var(--economy-coming-u) * 493);
  top: calc(var(--economy-coming-u) * 38.18);
  width: calc(var(--economy-coming-u) * 24.294);
  height: calc(var(--economy-coming-u) * 81.559);
  border-radius: calc(var(--economy-coming-u) * 11.106);
  background: rgb(150 131 180 / 0.63);
}

.economy-coming-modal__handle::before {
  position: absolute;
  left: calc(var(--economy-coming-u) * -1.72);
  top: calc(var(--economy-coming-u) * -38.18);
  width: calc(var(--economy-coming-u) * 27.765);
  height: calc(var(--economy-coming-u) * 27.765);
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #ff6c60, #c8322f 68%);
  content: '';
}

.economy-coming-modal__handle-stick {
  position: absolute;
  left: calc(var(--economy-coming-u) * 7.75);
  top: calc(var(--economy-coming-u) * -20.13);
  width: calc(var(--economy-coming-u) * 7.404);
  height: calc(var(--economy-coming-u) * 53.679);
  border-radius: calc(var(--economy-coming-u) * 3.702);
  background: #1a1133;
}

.economy-coming-modal-enter-active,
.economy-coming-modal-leave-active {
  transition: opacity 0.18s ease;
}

.economy-coming-modal-enter-active .economy-coming-modal__dialog,
.economy-coming-modal-leave-active .economy-coming-modal__dialog {
  transition: transform 0.18s ease;
}

.economy-coming-modal-enter-from,
.economy-coming-modal-leave-to {
  opacity: 0;
}

.economy-coming-modal-enter-from .economy-coming-modal__dialog,
.economy-coming-modal-leave-to .economy-coming-modal__dialog {
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 720px) {
  .economy-coming-modal {
    align-items: flex-start;
    overflow-y: auto;
    padding: 1rem 0.75rem;
  }

  .economy-coming-modal__dialog {
    container-type: normal;
    width: min(100%, 26rem);
    min-height: 34rem;
    aspect-ratio: auto;
    border-width: 5px;
    border-radius: 1.65rem;
  }

  .economy-coming-modal__copy {
    left: 1.35rem;
    top: 1.45rem;
    width: calc(100% - 2.7rem);
  }

  .economy-coming-modal__eyebrow {
    margin-bottom: 2.1rem;
    font-size: 0.88rem;
  }

  .economy-coming-modal__title {
    margin-bottom: 1.25rem;
    font-size: 1.42rem;
    line-height: 1.08;
  }

  .economy-coming-modal__description {
    width: 100%;
    font-size: 0.88rem;
    line-height: 1.24;
  }

  .economy-coming-modal__machine {
    --economy-mobile-u: calc(min(22rem, calc(100vw - 3.5rem)) / 532);
    left: 1.25rem;
    right: auto;
    top: 23rem;
    width: calc(var(--economy-mobile-u) * 532);
    height: calc(var(--economy-mobile-u) * 165);
  }

  .economy-coming-modal__machine * {
    --economy-coming-u: var(--economy-mobile-u);
  }
}
</style>
