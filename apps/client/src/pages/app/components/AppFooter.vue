<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { STREAMER_TWITCH_URL } from '@/eat-first/constants/brand.js'
import AppLandingFooterActions from './AppLandingFooterActions.vue'

type LocaleOption = {
  value: string
  label: string
}

defineProps<{
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
const eggOpen = ref(false)
const stickIn = ref(false)

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
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

function updateLocale(value: string) {
  emit('update:locale', value)
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
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

    <AppLandingFooterActions
      :feedback-href="feedbackHref"
      :locale="locale"
      :locale-options="localeOptions"
      @update:locale="updateLocale"
    />

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

.app-landing-footer__brand:focus-visible,
.app-landing-footer__copy-symbol:focus-visible {
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
}

@media (min-width: 641px) and (max-width: 1200px) {
  .app-landing-footer {
    min-height: 5.2rem;
  }
}
</style>
