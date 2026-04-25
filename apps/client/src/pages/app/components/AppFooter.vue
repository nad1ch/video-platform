<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { STREAMER_TWITCH_URL } from '@/eat-first/constants/brand.js'

type LocaleOption = {
  value: string
  label: string
}

const props = defineProps<{
  brandName: string
  year: number
  feedbackHref: string
  locale: string
  localeOptions: LocaleOption[]
}>()

const emit = defineEmits<{
  'update:locale': [value: string]
}>()

const { t } = useI18n()
const activeLocaleLabel = computed(
  () => props.localeOptions.find((option) => option.value === props.locale)?.label ?? props.localeOptions[0]?.label ?? 'English',
)

const localeDetailsRef = ref<HTMLDetailsElement | null>(null)
const eggOpen = ref(false)
const stickIn = ref(false)

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
    closeEgg()
  }
}

function toggleStick(event: Event) {
  event.stopPropagation()
  stickIn.value = !stickIn.value
}

function closeEgg() {
  eggOpen.value = false
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
  <footer class="app-landing-footer">
    <div class="app-landing-footer__rights">
      <a
        class="app-landing-footer__brand"
        :href="STREAMER_TWITCH_URL"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('app.twitchAria', { nick: brandName })"
      >
        {{ brandName }}
      </a>
      <span class="app-landing-footer__copy">
        <button
          type="button"
          class="app-landing-footer__copy-symbol"
          :aria-label="t('app.footerEggTriggerAria')"
          @click="eggOpen = true"
        >
          {{ t('app.footerCopyrightSymbol') }}
        </button>
        {{ year }} All rights reserved.
      </span>
    </div>

    <div class="app-landing-footer__actions">
      <a class="app-landing-footer__feedback sa-glass-button" :href="feedbackHref">
        Feedback
      </a>

      <details ref="localeDetailsRef" class="app-landing-footer__locale">
        <summary class="app-landing-footer__locale-trigger sa-glass-button" aria-label="Choose language">
          <span>{{ activeLocaleLabel }}</span>
        </summary>
        <div class="app-landing-footer__locale-list">
          <button
            v-for="option in localeOptions"
            :key="option.value"
            class="app-landing-footer__locale-option"
            :class="{ 'app-landing-footer__locale-option--active': option.value === locale }"
            type="button"
            @click="selectLocale(option.value, $event)"
          >
            {{ option.label }}
          </button>
        </div>
      </details>
    </div>

    <Teleport to="body">
      <div
        v-if="eggOpen"
        class="footer-egg-backdrop"
        role="presentation"
        @click.self="closeEgg"
      >
        <div
          class="footer-egg-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="t('app.footerEggTriggerAria')"
        >
          <button type="button" class="footer-egg-close" :aria-label="t('app.footerEggClose')" @click="closeEgg">
            &times;
          </button>
          <div
            class="footer-egg-scene"
            role="button"
            tabindex="0"
            :aria-label="t('app.footerEggHint')"
            @click="toggleStick"
            @keydown.enter.prevent="toggleStick"
            @keydown.space.prevent="toggleStick"
          >
            <div class="footer-egg-perspective" aria-hidden="true">
              <div class="footer-egg-world">
                <div class="footer-egg-stick" :class="{ 'footer-egg-stick--in': stickIn }" />
                <div class="footer-egg-donut" />
              </div>
            </div>
          </div>
          <p class="footer-egg-hint">{{ t('app.footerEggHint') }}</p>
        </div>
      </div>
    </Teleport>
  </footer>
</template>

<style scoped>
.app-landing-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4.6rem;
  padding: 1rem clamp(1.4rem, 2.2vw, 2.8rem);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(32, 20, 52, 0.68);
  color: #fff;
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.app-landing-footer__rights {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(81, 48, 116, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.app-landing-footer__brand {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.8rem;
  border-radius: inherit;
  background: rgba(81, 48, 116, 0.6);
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 0.72rem;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
  color: #fff;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.18s ease;
}

.app-landing-footer__brand:hover {
  background: rgba(102, 56, 143, 0.78);
}

.app-landing-footer__copy {
  display: inline-flex;
  align-items: center;
  gap: 0.16rem;
  min-width: 0;
  overflow: hidden;
  padding: 0 0.85rem;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.66rem;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-landing-footer__copy-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 0.08rem 0 0;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  font: inherit;
  line-height: inherit;
}

.app-landing-footer__copy-symbol:hover {
  color: #ffda44;
}

.app-landing-footer__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  min-width: 0;
}

.app-landing-footer__feedback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.7rem;
  min-height: 2.35rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.14), transparent 46%),
    rgba(81, 48, 116, 0.62);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 12px 28px rgba(10, 3, 24, 0.22);
  -webkit-backdrop-filter: blur(20px) saturate(1.24);
  backdrop-filter: blur(20px) saturate(1.24);
  font-size: 0.82rem;
  font-weight: 400;
  text-decoration: none;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.app-landing-footer__locale {
  position: relative;
  z-index: 4;
  width: 8.9rem;
  height: 2.35rem;
}

.app-landing-footer__locale[open] {
  z-index: 6;
}

.app-landing-footer__locale-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2.35rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 1.25rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.14), transparent 46%),
    rgba(81, 48, 117, 0.54);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    0 12px 28px rgba(10, 3, 24, 0.22);
  color: #fff;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 400;
  list-style: none;
  -webkit-backdrop-filter: blur(22px) saturate(1.24);
  backdrop-filter: blur(22px) saturate(1.24);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.app-landing-footer__locale-trigger::-webkit-details-marker {
  display: none;
}

.app-landing-footer__locale-trigger::after {
  position: absolute;
  right: 1rem;
  top: 50%;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 1px solid rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(255, 255, 255, 0.78);
  content: '';
  transform: translateY(-66%) rotate(45deg);
}

.app-landing-footer__locale-list {
  position: absolute;
  left: 0;
  bottom: calc(100% + 0.45rem);
  z-index: 1;
  display: none;
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 1.25rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.1), transparent 40%),
    rgba(65, 43, 91, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 -18px 34px rgba(10, 3, 24, 0.3);
  -webkit-backdrop-filter: blur(22px) saturate(1.22);
  backdrop-filter: blur(22px) saturate(1.22);
}

.app-landing-footer__locale[open] .app-landing-footer__locale-list {
  display: grid;
}

.app-landing-footer__locale-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  border: 0;
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.app-landing-footer__locale-option--active {
  background: rgba(255, 255, 255, 0.94);
  color: #1a1a1a;
}

.app-landing-footer__locale-trigger:hover,
.app-landing-footer__locale[open] .app-landing-footer__locale-trigger {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(102, 56, 143, 0.68);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 14px 30px rgba(10, 3, 24, 0.28);
}

.app-landing-footer__locale-option:hover,
.app-landing-footer__locale-option:focus-visible {
  background: rgba(124, 77, 219, 0.42);
  color: #fff;
}

.app-landing-footer__locale-option--active:hover,
.app-landing-footer__locale-option--active:focus-visible {
  background: #fff;
  color: #1a1a1a;
}

.app-landing-footer__feedback:hover {
  background: rgba(102, 56, 143, 0.76);
  transform: translateY(-1px);
}

.app-landing-footer__feedback:focus-visible,
.app-landing-footer__brand:focus-visible,
.app-landing-footer__copy-symbol:focus-visible,
.app-landing-footer__locale-trigger:focus-visible,
.app-landing-footer__locale-option:focus-visible {
  outline: 2px solid rgba(255, 218, 68, 0.86);
  outline-offset: 3px;
}

.footer-egg-backdrop {
  position: fixed;
  inset: 0;
  z-index: 11980;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.footer-egg-modal {
  position: relative;
  width: min(17rem, 100%);
  padding: 1.25rem 1rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 1rem;
  background: rgba(32, 20, 52, 0.95);
  box-shadow: 0 16px 48px rgba(10, 3, 24, 0.55);
  color: #fff;
}

.footer-egg-close {
  position: absolute;
  top: 0.4rem;
  right: 0.45rem;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font-size: 1.35rem;
  line-height: 1;
}

.footer-egg-close:hover {
  color: #fff;
}

.footer-egg-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0.35rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
  cursor: pointer;
  outline: none;
}

.footer-egg-scene:focus-visible {
  box-shadow: 0 0 0 2px rgba(255, 218, 68, 0.62);
}

.footer-egg-perspective {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 11rem;
  height: 9rem;
  perspective: 520px;
  perspective-origin: 52% 38%;
  pointer-events: none;
}

.footer-egg-world {
  position: relative;
  width: 7rem;
  height: 7rem;
  transform: rotateX(58deg) rotateZ(-8deg);
  transform-style: preserve-3d;
}

.footer-egg-donut {
  position: absolute;
  left: 50%;
  top: 50%;
  box-sizing: border-box;
  width: 6.25rem;
  height: 6.25rem;
  margin: -3.125rem 0 0 -3.125rem;
  border: 1rem solid;
  border-color: #e8c08a #b8743a #7a4218 #c99552;
  border-radius: 50%;
  background: transparent;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    0 0.35rem 0.6rem rgba(0, 0, 0, 0.45),
    inset 0 -0.4rem 0.85rem rgba(60, 25, 8, 0.35);
  transform: translateZ(0);
}

.footer-egg-stick {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0.45rem;
  height: 5rem;
  margin-left: -0.225rem;
  margin-top: -5.5rem;
  border-radius: 0.2rem;
  background: linear-gradient(90deg, #4a3728, #c4a574 45%, #6b4a2e);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0.12rem 0.2rem 0.35rem rgba(0, 0, 0, 0.4);
  transform: translateZ(2.6rem) translateY(-0.9rem);
  transform-origin: 50% 100%;
  transition: transform 0.48s cubic-bezier(0.42, 0, 0.18, 1);
}

.footer-egg-stick--in {
  transform: translateZ(-1.35rem) translateY(1.15rem);
}

.footer-egg-hint {
  margin: 0.65rem 0 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
}

@media (max-width: 640px) {
  .app-landing-footer {
    flex-direction: column;
    align-items: stretch;
    padding-block: 1.1rem;
  }

  .app-landing-footer__rights {
    justify-content: center;
  }

  .app-landing-footer__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .app-landing-footer__locale {
    width: 100%;
  }

  .app-landing-footer__feedback {
    width: 100%;
  }
}

@media (min-width: 641px) and (max-width: 1200px) {
  .app-landing-footer {
    min-height: 5.2rem;
  }

  .app-landing-footer__feedback {
    min-width: 9.5rem;
    min-height: 2.55rem;
    font-size: 0.9rem;
  }
}
</style>
