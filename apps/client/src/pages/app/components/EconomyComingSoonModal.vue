<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import economyComingEn from '@/assets/economy-coming-modal/economy-coming-en.png'
import economyComingUk from '@/assets/economy-coming-modal/economy-coming-uk.png'

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

const { locale } = useI18n()

const modalImage = computed(() =>
  String(locale.value).toLowerCase().startsWith('uk') ? economyComingUk : economyComingEn,
)

const descriptionText = computed(() =>
  props.description
    .split('\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join(' '),
)

const closeModal = () => {
  emit('close')
}
</script>

<template>
  <Transition name="economy-coming-modal">
    <div v-if="props.open" class="economy-coming-modal" role="presentation" @keydown.esc="closeModal">
      <button type="button" class="economy-coming-modal__backdrop" :aria-label="closeLabel" @click="closeModal" />

      <section
        class="economy-coming-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="economy-coming-modal-title"
        aria-describedby="economy-coming-modal-desc"
        tabindex="-1"
      >
        <h2 id="economy-coming-modal-title" class="economy-coming-modal__sr-only">{{ title }}</h2>
        <p id="economy-coming-modal-desc" class="economy-coming-modal__sr-only">
          {{ eyebrow }} {{ descriptionText }}
        </p>

        <img class="economy-coming-modal__image" :src="modalImage" alt="" aria-hidden="true" draggable="false" />

        <button type="button" class="economy-coming-modal__close" :aria-label="closeLabel" @click="closeModal" />
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
  position: relative;
  z-index: 1;
  width: min(1024px, calc(100vw - 2rem));
  max-width: 100%;
  aspect-ratio: 1024 / 305;
  overflow: visible;
  border: 0;
  filter: drop-shadow(0 25px 75px rgb(0 0 0 / 0.48));
  outline: none;
}

.economy-coming-modal__image {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.economy-coming-modal__close {
  position: absolute;
  top: 7.5%;
  right: 2.3%;
  width: 3.7%;
  min-width: 1.75rem;
  height: auto;
  aspect-ratio: 1;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  clip-path: circle(50% at 50% 50%);
  background: rgb(30 27 40 / 0.9);
  cursor: pointer;
  box-sizing: border-box;
}

.economy-coming-modal__close:focus-visible {
  outline: none;
  filter: brightness(1.12);
}

.economy-coming-modal__close::before,
.economy-coming-modal__close::after {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52%;
  height: 2px;
  border-radius: 999px;
  background: #fff;
  content: '';
  transform-origin: center;
}

.economy-coming-modal__close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.economy-coming-modal__close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.economy-coming-modal__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
    width: min(1024px, calc(100vw - 1.5rem));
  }
}
</style>
