<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  BRAND_LOGO_COMPACT_PNG,
  BRAND_LOGO_PNG,
  BRAND_LOGO_SVG_FALLBACK,
  STREAMER_NICK,
  STREAMER_TWITCH_URL,
} from '@/eat-first/constants/brand.js'

defineProps<{
  year: number
}>()

const route = useRoute()
const { t } = useI18n()

const footerLineKey = computed(() =>
  route.meta.footerContext === 'eat' ? 'app.footerLineEat' : 'app.footerLineStream',
)

const eggOpen = ref(false)
const stickIn = ref(false)

function toggleStick(ev: Event) {
  ev.stopPropagation()
  stickIn.value = !stickIn.value
}

function closeEgg() {
  eggOpen.value = false
}

function onDocKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && eggOpen.value) {
    ev.preventDefault()
    closeEgg()
  }
}

watch(eggOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open) {
    stickIn.value = false
    document.addEventListener('keydown', onDocKeydown)
  } else {
    document.removeEventListener('keydown', onDocKeydown)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onDocKeydown)
})

const footerLogoSrc = ref(BRAND_LOGO_PNG)

function onFooterLogoError() {
  if (footerLogoSrc.value === BRAND_LOGO_PNG) {
    footerLogoSrc.value = BRAND_LOGO_COMPACT_PNG
    return
  }
  if (footerLogoSrc.value === BRAND_LOGO_COMPACT_PNG) {
    footerLogoSrc.value = BRAND_LOGO_SVG_FALLBACK
    return
  }
  footerLogoSrc.value = ''
}

function footerInitial() {
  const s = String(STREAMER_NICK ?? 'N').trim()
  return (s[0] ?? 'N').toUpperCase()
}
</script>

<template>
  <footer class="app-site-footer">
    <div class="app-site-footer__inner">
      <a
        class="app-site-footer__brand-link"
        :href="STREAMER_TWITCH_URL"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('app.twitchAria')"
      >
        <div class="app-site-footer__logo-wrap">
          <img
            v-if="footerLogoSrc"
            class="app-site-footer__logo"
            :src="footerLogoSrc"
            width="44"
            height="44"
            alt=""
            decoding="async"
            fetchpriority="low"
            @error="onFooterLogoError"
          />
          <span v-else class="app-site-footer__logo-fallback" aria-hidden="true">{{ footerInitial() }}</span>
        </div>
        <span class="app-site-footer__nick">{{ STREAMER_NICK }}</span>
      </a>
      <div class="app-site-footer__meta">
        <p class="app-site-footer__copy">
          <button
            type="button"
            class="app-site-footer__copy-symbol"
            :aria-label="t('app.footerEggTriggerAria')"
            @click="eggOpen = true"
          >
            {{ t('app.footerCopyrightSymbol') }}
          </button>
          <span class="app-site-footer__copy-rest">{{ t(footerLineKey, { year }) }}</span>
        </p>
      </div>
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
            ×
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
.app-site-footer__copy-symbol {
  display: inline;
  margin: 0;
  padding: 0 0.1rem 0 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--text-heading);
  cursor: pointer;
  border-radius: 4px;
  vertical-align: baseline;
  line-height: inherit;
}

.app-site-footer__copy-symbol:hover {
  color: var(--text-cyan-strong, #7dd3fc);
}

.app-site-footer__copy-symbol:focus-visible {
  outline: 2px solid var(--border-cyan-strong, rgba(94, 231, 223, 0.55));
  outline-offset: 2px;
}

.app-site-footer__logo-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--logo-pad-bg, color-mix(in srgb, var(--sa-color-primary) 28%, var(--sa-color-bg-deep)));
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-heading, var(--sa-color-text-main));
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
  backdrop-filter: blur(3px);
}

.footer-egg-modal {
  position: relative;
  width: min(17rem, 100%);
  padding: 1.25rem 1rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--border-strong);
  background: var(--bg-dropdown, var(--bg-card-solid));
  box-shadow: 0 16px 48px var(--shadow-deep);
}

.footer-egg-close {
  position: absolute;
  top: 0.4rem;
  right: 0.45rem;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: var(--bg-muted-strong);
  color: var(--text-muted);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
}

.footer-egg-close:hover {
  color: var(--text-heading);
}

.footer-egg-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 0.35rem;
  cursor: pointer;
  border-radius: 12px;
  padding: 0.5rem;
  outline: none;
}

.footer-egg-scene:focus-visible {
  box-shadow: 0 0 0 2px var(--border-cyan-strong, rgba(94, 231, 223, 0.55));
}

.footer-egg-perspective {
  width: 11rem;
  height: 9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  perspective: 520px;
  perspective-origin: 52% 38%;
}

.footer-egg-world {
  position: relative;
  width: 7rem;
  height: 7rem;
  transform-style: preserve-3d;
  transform: rotateX(58deg) rotateZ(-8deg);
}

.footer-egg-donut {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6.25rem;
  height: 6.25rem;
  margin: -3.125rem 0 0 -3.125rem;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1rem solid;
  border-color: #e8c08a #b8743a #7a4218 #c99552;
  background: transparent;
  transform: translateZ(0);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    0 0.35rem 0.6rem rgba(0, 0, 0, 0.45),
    inset 0 -0.4rem 0.85rem rgba(60, 25, 8, 0.35);
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
  transform-origin: 50% 100%;
  background: linear-gradient(90deg, #4a3728, #c4a574 45%, #6b4a2e);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0.12rem 0.2rem 0.35rem rgba(0, 0, 0, 0.4);
  transform: translateZ(2.6rem) translateY(-0.9rem);
  transition: transform 0.48s cubic-bezier(0.42, 0, 0.18, 1);
}

.footer-egg-stick--in {
  transform: translateZ(-1.35rem) translateY(1.15rem);
}

.footer-egg-hint {
  margin: 0.65rem 0 0;
  text-align: center;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.35;
}

@media (prefers-reduced-motion: reduce) {
  .footer-egg-stick {
    transition: none;
  }
}
</style>
