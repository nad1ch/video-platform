<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type LocaleOption = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    feedbackHref?: string
    locale?: string
    localeOptions?: readonly LocaleOption[]
    mode?: 'both' | 'feedback' | 'locale'
    tone?: 'glass' | 'light'
  }>(),
  {
    feedbackHref: '#',
    locale: '',
    localeOptions: () => [],
    mode: 'both',
    tone: 'glass',
  },
)

const emit = defineEmits<{
  'update:locale': [value: string]
}>()

const showFeedback = computed(() => props.mode === 'both' || props.mode === 'feedback')
const showLocale = computed(() => props.mode === 'both' || props.mode === 'locale')

const activeLocaleLabel = computed(
  () => props.localeOptions.find((option) => option.value === props.locale)?.label ?? props.localeOptions[0]?.label ?? 'English',
)

const localeDetailsRef = ref<HTMLDetailsElement | null>(null)

function closeLocaleMenu() {
  localeDetailsRef.value?.removeAttribute('open')
}

function onDocumentPointerDown(event: PointerEvent) {
  const details = localeDetailsRef.value
  const target = event.target
  if (!details?.open || !(target instanceof Node) || details.contains(target)) {
    return
  }
  closeLocaleMenu()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeLocaleMenu()
  }
}

function selectLocale(value: string, event: MouseEvent) {
  emit('update:locale', value)
  const details = (event.currentTarget as HTMLElement | null)?.closest('details')
  details?.removeAttribute('open')
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div
    class="app-landing-footer-actions"
    :class="[
      `app-landing-footer-actions--${tone}`,
      `app-landing-footer-actions--${mode}`,
    ]"
  >
    <a v-if="showFeedback" class="app-landing-footer-actions__feedback sa-glass-button" :href="feedbackHref">
      Feedback
    </a>

    <details v-if="showLocale" ref="localeDetailsRef" class="app-landing-footer-actions__locale">
      <summary class="app-landing-footer-actions__locale-trigger sa-glass-button" aria-label="Choose language">
        <span>{{ activeLocaleLabel }}</span>
      </summary>
      <div class="app-landing-footer-actions__locale-list">
        <button
          v-for="option in localeOptions"
          :key="option.value"
          class="app-landing-footer-actions__locale-option"
          :class="{ 'app-landing-footer-actions__locale-option--active': option.value === locale }"
          type="button"
          @click="selectLocale(option.value, $event)"
        >
          {{ option.label }}
        </button>
      </div>
    </details>
  </div>
</template>

<style scoped>
.app-landing-footer-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-landing-footer-actions-gap, 0.75rem);
  min-width: 0;
}

.app-landing-footer-actions__feedback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--app-landing-footer-feedback-width, 8.7rem);
  min-width: var(--app-landing-footer-feedback-width, 8.7rem);
  height: var(--app-landing-footer-action-height, 2.35rem);
  min-height: var(--app-landing-footer-action-height, 2.35rem);
  box-sizing: border-box;
  border: 1px solid var(--app-landing-footer-action-border, rgba(255, 255, 255, 0.18));
  border-radius: 999px;
  background:
    linear-gradient(135deg, var(--app-landing-footer-action-shine, rgba(255, 255, 255, 0.14)), transparent 46%),
    var(--app-landing-footer-feedback-bg, var(--app-home-glass-action-bg, rgba(81, 48, 116, 0.1)));
  color: var(--app-landing-footer-action-color, #fff);
  box-shadow:
    inset 0 1px 0 var(--app-landing-footer-action-inset-shadow, rgba(255, 255, 255, 0.2)),
    0 12px 28px var(--app-landing-footer-action-drop-shadow, rgba(10, 3, 24, 0.22));
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  font-size: var(--app-landing-footer-action-font-size, 0.82rem);
  font-weight: 400;
  text-decoration: none;
  transition:
    background 0.3s ease,
    box-shadow 0.3s ease,
    transform 0.3s ease;
}

.app-landing-footer-actions__locale {
  position: relative;
  z-index: 4;
  width: var(--app-landing-footer-locale-width, 8.9rem);
  height: var(--app-landing-footer-action-height, 2.35rem);
}

.app-landing-footer-actions__locale[open] {
  z-index: 6;
}

.app-landing-footer-actions__locale-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--app-landing-footer-action-height, 2.35rem);
  border: 1px solid var(--app-landing-footer-locale-border, rgba(255, 255, 255, 0.16));
  border-radius: 1.25rem;
  background:
    linear-gradient(135deg, var(--app-landing-footer-action-shine, rgba(255, 255, 255, 0.14)), transparent 46%),
    var(--app-landing-footer-locale-bg, var(--app-home-glass-action-bg, rgba(81, 48, 116, 0.1)));
  box-shadow:
    inset 0 1px 0 var(--app-landing-footer-action-inset-shadow, rgba(255, 255, 255, 0.22)),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    0 12px 28px var(--app-landing-footer-action-drop-shadow, rgba(10, 3, 24, 0.22));
  color: var(--app-landing-footer-action-color, #fff);
  cursor: pointer;
  font-size: var(--app-landing-footer-action-font-size, 0.82rem);
  font-weight: 400;
  list-style: none;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}

.app-landing-footer-actions__locale-trigger::-webkit-details-marker {
  display: none;
}

.app-landing-footer-actions__locale-trigger::after {
  position: absolute;
  right: 1rem;
  top: 50%;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 1px solid var(--app-landing-footer-chevron-color, rgba(255, 255, 255, 0.78));
  border-bottom: 1px solid var(--app-landing-footer-chevron-color, rgba(255, 255, 255, 0.78));
  content: '';
  transform: translateY(-66%) rotate(45deg);
}

.app-landing-footer-actions__locale-list {
  position: absolute;
  left: 0;
  bottom: calc(100% + 0.45rem);
  z-index: 1;
  display: none;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--app-landing-footer-locale-list-border, rgba(255, 255, 255, 0.16));
  border-radius: 1.25rem;
  background:
    linear-gradient(135deg, var(--app-landing-footer-list-shine, rgba(255, 255, 255, 0.1)), transparent 40%),
    var(--app-landing-footer-locale-list-bg, rgba(65, 43, 91, 0.72));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 -18px 34px rgba(10, 3, 24, 0.3);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.22);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.22);
}

.app-landing-footer-actions__locale[open] .app-landing-footer-actions__locale-list {
  display: grid;
}

.app-landing-footer-actions__locale-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  border: 0;
  background: transparent;
  color: var(--app-landing-footer-locale-option-color, #fff);
  font: inherit;
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.app-landing-footer-actions__locale-option--active {
  background: rgba(255, 255, 255, 0.94);
  color: #1a1a1a;
}

.app-landing-footer-actions__locale-trigger:hover,
.app-landing-footer-actions__locale[open] .app-landing-footer-actions__locale-trigger {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(102, 56, 143, 0.26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 12px 28px rgba(10, 3, 24, 0.24);
}

.app-landing-footer-actions__locale-option:hover,
.app-landing-footer-actions__locale-option:focus-visible {
  background: rgba(124, 77, 219, 0.42);
  color: #fff;
}

.app-landing-footer-actions__locale-option--active:hover,
.app-landing-footer-actions__locale-option--active:focus-visible {
  background: #fff;
  color: #1a1a1a;
}

.app-landing-footer-actions__feedback:hover {
  background: var(--app-landing-footer-feedback-hover-bg, rgba(102, 56, 143, 0.28));
  transform: translateY(-0.5px);
}

.app-landing-footer-actions--light {
  --app-landing-footer-action-border: rgba(255, 255, 255, 0.72);
  --app-landing-footer-locale-border: rgba(255, 255, 255, 0.72);
  --app-landing-footer-locale-list-border: rgba(255, 255, 255, 0.54);
  --app-landing-footer-action-shine: rgba(255, 255, 255, 0.62);
  --app-landing-footer-list-shine: rgba(255, 255, 255, 0.42);
  --app-landing-footer-feedback-bg: rgba(255, 255, 255, 0.92);
  --app-landing-footer-locale-bg: rgba(255, 255, 255, 0.92);
  --app-landing-footer-locale-list-bg: rgba(255, 255, 255, 0.94);
  --app-landing-footer-feedback-hover-bg: #fff;
  --app-landing-footer-action-color: #1f1432;
  --app-landing-footer-locale-option-color: #1f1432;
  --app-landing-footer-chevron-color: rgba(31, 20, 50, 0.62);
  --app-landing-footer-action-inset-shadow: rgba(255, 255, 255, 0.5);
  --app-landing-footer-action-drop-shadow: rgba(10, 3, 24, 0.16);
}

.app-landing-footer-actions--light .app-landing-footer-actions__locale-trigger:hover,
.app-landing-footer-actions--light .app-landing-footer-actions__locale[open] .app-landing-footer-actions__locale-trigger {
  background: #fff;
}

.app-landing-footer-actions--light .app-landing-footer-actions__locale-option:hover,
.app-landing-footer-actions--light .app-landing-footer-actions__locale-option:focus-visible {
  background: rgba(255, 255, 255, 0.72);
  color: #1a1a1a;
}

.app-landing-footer-actions__feedback:focus-visible,
.app-landing-footer-actions__locale-trigger:focus-visible,
.app-landing-footer-actions__locale-option:focus-visible {
  outline: 2px solid rgba(255, 218, 68, 0.86);
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .app-landing-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .app-landing-footer-actions--both .app-landing-footer-actions__locale {
    width: 100%;
  }

  .app-landing-footer-actions--both .app-landing-footer-actions__feedback {
    width: 100%;
  }
}

@media (min-width: 641px) and (max-width: 1200px) {
  .app-landing-footer-actions--both .app-landing-footer-actions__feedback {
    min-width: 9.5rem;
    min-height: 2.55rem;
    font-size: 0.9rem;
  }
}
</style>
