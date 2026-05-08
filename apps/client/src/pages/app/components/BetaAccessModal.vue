<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import eatFirstEn from '@/assets/beta-access-modals/eat-first-en.png'
import eatFirstUk from '@/assets/beta-access-modals/eat-first-uk.png'
import mafiaEn from '@/assets/beta-access-modals/mafia-en.png'
import mafiaUk from '@/assets/beta-access-modals/mafia-uk.png'
import videoCallEn from '@/assets/beta-access-modals/video-call-en.png'
import videoCallUk from '@/assets/beta-access-modals/video-call-uk.png'

type BetaAccessModalKind = 'video-call' | 'mafia' | 'eat-first'
type BetaAccessModalLocale = 'en' | 'uk'

const props = defineProps<{
  open: boolean
  kind: BetaAccessModalKind
}>()

const emit = defineEmits<{
  close: []
}>()

const { locale } = useI18n()
const closeButtonRef = ref<HTMLButtonElement | null>(null)

const modalImages: Record<BetaAccessModalKind, Record<BetaAccessModalLocale, string>> = {
  'video-call': {
    en: videoCallEn,
    uk: videoCallUk,
  },
  mafia: {
    en: mafiaEn,
    uk: mafiaUk,
  },
  'eat-first': {
    en: eatFirstEn,
    uk: eatFirstUk,
  },
}

const modalCopy: Record<
  BetaAccessModalKind,
  Record<BetaAccessModalLocale, { title: string; description: string; note: string }>
> = {
  'video-call': {
    en: {
      title: 'Video call',
      description: 'Content is available only for beta testing.',
      note: 'Video calls require significant server resources, so for now the feature is available only to streamers.',
    },
    uk: {
      title: 'Відеодзвінок',
      description: 'Контент доступний лише для бета-тесту.',
      note: 'Відеодзвінки потребують численних серверних ресурсів, тому зараз опції відкриті лише для стрімерів.',
    },
  },
  mafia: {
    en: {
      title: 'Mafia',
      description: 'Content is available only for beta testing.',
      note: 'The feature is available only to streamers during beta testing.',
    },
    uk: {
      title: 'Мафія',
      description: 'Контент доступний лише для бета-тесту.',
      note: 'Зараз опції відкриті лише для стрімерів.',
    },
  },
  'eat-first': {
    en: {
      title: 'Who we should eat first',
      description: 'Content is available only for beta testing.',
      note: 'The feature is available only to streamers during beta testing.',
    },
    uk: {
      title: 'Кого зʼїсти першим',
      description: 'Контент доступний лише для бета-тесту.',
      note: 'Зараз опції відкриті лише для стрімерів.',
    },
  },
}

const resolvedLocale = computed<BetaAccessModalLocale>(() =>
  String(locale.value).toLowerCase().startsWith('uk') ? 'uk' : 'en',
)

const modalImage = computed(() => modalImages[props.kind][resolvedLocale.value])
const copy = computed(() => modalCopy[props.kind][resolvedLocale.value])
const closeLabel = computed(() => (resolvedLocale.value === 'uk' ? 'Закрити вікно' : 'Close dialog'))
const titleId = computed(() => `beta-access-modal-${props.kind}-title`)
const descriptionId = computed(() => `beta-access-modal-${props.kind}-description`)

function closeModal(): void {
  emit('close')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void nextTick(() => {
    closeButtonRef.value?.focus({ preventScroll: true })
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="beta-access-modal">
      <div v-if="open" class="beta-access-modal" role="presentation">
        <button
          type="button"
          class="beta-access-modal__backdrop"
          :aria-label="closeLabel"
          @click="closeModal"
        />

        <section
          class="beta-access-modal__dialog"
          :class="`beta-access-modal__dialog--${kind}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
        >
          <h2 :id="titleId" class="beta-access-modal__sr-only">{{ copy.title }}</h2>
          <p :id="descriptionId" class="beta-access-modal__sr-only">
            {{ copy.description }} {{ copy.note }}
          </p>

          <img class="beta-access-modal__image" :src="modalImage" alt="" aria-hidden="true" decoding="async" />

          <button
            ref="closeButtonRef"
            type="button"
            class="beta-access-modal__close"
            :aria-label="closeLabel"
            @click="closeModal"
          />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.beta-access-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: clamp(0.75rem, 2.5vw, 1.75rem);
  box-sizing: border-box;
  background: rgba(3, 0, 11, 0.72);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.beta-access-modal__backdrop {
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: default;
}

.beta-access-modal__dialog {
  position: relative;
  z-index: 1;
  width: min(1024px, calc(100vw - 1.5rem));
  max-width: 100%;
  border: 0;
  border-radius: clamp(1rem, 4.99vw, 3.19rem);
  outline: none;
  filter: drop-shadow(0 1.25rem 3rem rgba(2, 0, 12, 0.58));
}

.beta-access-modal__image {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
  border-radius: 46px;
}

.beta-access-modal__close {
  position: absolute;
  top: 6.25%;
  right: 3.32%;
  width: 4%;
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

.beta-access-modal__close::before,
.beta-access-modal__close::after {
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

.beta-access-modal__close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.beta-access-modal__close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.beta-access-modal__close:focus-visible {
  outline: none;
  filter: brightness(1.12);
}

.beta-access-modal__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.beta-access-modal-enter-active,
.beta-access-modal-leave-active {
  transition: opacity 0.18s ease;
}

.beta-access-modal-enter-active .beta-access-modal__dialog,
.beta-access-modal-leave-active .beta-access-modal__dialog {
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.beta-access-modal-enter-from,
.beta-access-modal-leave-to {
  opacity: 0;
}

.beta-access-modal-enter-from .beta-access-modal__dialog,
.beta-access-modal-leave-to .beta-access-modal__dialog {
  transform: translateY(0.75rem) scale(0.985);
}

@media (max-width: 640px) {
  .beta-access-modal {
    align-items: start;
    padding-top: max(1rem, env(safe-area-inset-top, 0px));
  }

  .beta-access-modal__dialog {
    width: min(1024px, calc(100vw - 0.75rem));
  }

  .beta-access-modal__close {
    top: 4.5%;
    right: 2.7%;
    width: 2.15rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .beta-access-modal-enter-active,
  .beta-access-modal-leave-active,
  .beta-access-modal-enter-active .beta-access-modal__dialog,
  .beta-access-modal-leave-active .beta-access-modal__dialog {
    transition: none;
  }
}
</style>
