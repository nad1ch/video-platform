<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppContainer from '@/components/ui/AppContainer.vue'
import PurpleLightningBackdrop from '@/components/ui/PurpleLightningBackdrop.vue'
import { STREAM_APP_BRAND_NAME, STREAMER_NICK } from '@/eat-first/constants/brand.js'

const { t, locale } = useI18n()

const defaultWordleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

function syncDocumentTitle() {
  document.title = t('landing.documentTitle')
}

onMounted(() => {
  syncDocumentTitle()
})

watch(locale, () => {
  syncDocumentTitle()
})
</script>

<template>
  <div class="landing eat-first-root page-stack" data-theme="dark">
    <PurpleLightningBackdrop :light="false" />
    <main class="landing__main">
      <AppContainer class="landing__container">
        <header class="landing__hero">
          <p class="landing__eyebrow">{{ STREAM_APP_BRAND_NAME }}</p>
          <h1 class="landing__title">{{ t('landing.heroTitle') }}</h1>
          <p class="landing__lead">{{ t('landing.heroSubtitle') }}</p>
          <div class="landing__actions">
            <RouterLink class="landing__btn landing__btn--primary" :to="{ name: 'home' }">
              {{ t('landing.ctaOpenApp') }}
            </RouterLink>
            <RouterLink
              class="landing__btn landing__btn--ghost"
              :to="{ name: 'wordle-streamer', params: { streamer: defaultWordleStreamer } }"
            >
              {{ t('landing.ctaTryWordle') }}
            </RouterLink>
          </div>
        </header>

        <section class="landing__section" :aria-label="t('landing.featuresAria')">
          <h2 class="landing__h2">{{ t('landing.featuresHeading') }}</h2>
          <ul class="landing__features">
            <li class="landing__feature">
              <h3 class="landing__h3">{{ t('landing.featureCallsTitle') }}</h3>
              <p class="landing__p">{{ t('landing.featureCallsBody') }}</p>
            </li>
            <li class="landing__feature">
              <h3 class="landing__h3">{{ t('landing.featureGamesTitle') }}</h3>
              <p class="landing__p">{{ t('landing.featureGamesBody') }}</p>
            </li>
            <li class="landing__feature">
              <h3 class="landing__h3">{{ t('landing.featureOverlayTitle') }}</h3>
              <p class="landing__p">{{ t('landing.featureOverlayBody') }}</p>
            </li>
          </ul>
        </section>

        <section class="landing__closing">
          <h2 class="landing__h2">{{ t('landing.closingTitle') }}</h2>
          <p class="landing__p landing__p--center">{{ t('landing.closingLead') }}</p>
          <div class="landing__actions landing__actions--center">
            <RouterLink class="landing__btn landing__btn--primary" :to="{ name: 'eat', query: { view: 'join' } }">
              {{ t('landing.ctaEatLobby') }}
            </RouterLink>
            <RouterLink class="landing__btn landing__btn--ghost" :to="{ name: 'call' }">
              {{ t('landing.ctaJoinCall') }}
            </RouterLink>
          </div>
        </section>
      </AppContainer>
    </main>
  </div>
</template>

<style scoped>
.landing {
  position: relative;
  flex: 1 1 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: var(--text-body, var(--sa-color-text-body));
}

.landing__main {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.landing__container {
  padding-bottom: var(--sa-space-12);
}

.landing__hero {
  max-width: 40rem;
  margin: clamp(2.5rem, 10vh, 4rem) auto 0;
  text-align: center;
}

.landing__eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary, var(--sa-color-text-muted));
}

.landing__title {
  margin: var(--sa-space-3) 0 0;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: clamp(1.85rem, 4.2vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--text-title, var(--sa-color-text-main));
}

.landing__lead {
  margin: var(--sa-space-4) 0 0;
  font-size: 1.05rem;
  line-height: 1.55;
}

.landing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  margin-top: var(--sa-space-6);
}

.landing__actions--center {
  margin-top: var(--sa-space-5);
}

.landing__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.65rem;
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.landing__btn:focus-visible {
  outline: 2px solid var(--sa-color-primary);
  outline-offset: 3px;
}

.landing__btn--primary {
  background: var(--sa-color-primary, #5865f2);
  border-color: color-mix(in srgb, var(--sa-color-primary) 70%, #000 30%);
  color: #fff;
  box-shadow: 0 1px 0 color-mix(in srgb, #000 35%, transparent);
}

.landing__btn--primary:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.landing__btn--ghost {
  background: color-mix(in srgb, var(--sa-color-surface, #2b2d31) 88%, transparent);
  border-color: color-mix(in srgb, var(--sa-color-text-main, #fff) 10%, transparent);
  color: var(--text-title, var(--sa-color-text-main));
}

.landing__btn--ghost:hover {
  border-color: color-mix(in srgb, var(--sa-color-text-main, #fff) 16%, transparent);
  transform: translateY(-1px);
}

.landing__section {
  margin-top: clamp(2.5rem, 8vh, 4rem);
  max-width: 56rem;
  margin-inline: auto;
}

.landing__closing {
  margin-top: clamp(2.25rem, 7vh, 3.5rem);
  max-width: 40rem;
  margin-inline: auto;
  text-align: center;
}

.landing__h2 {
  margin: 0;
  font-size: clamp(1.15rem, 2.5vw, 1.35rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-title, var(--sa-color-text-main));
}

.landing__h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-title, var(--sa-color-text-main));
}

.landing__p {
  margin: var(--sa-space-3) 0 0;
  font-size: 0.95rem;
  line-height: 1.5;
}

.landing__p--center {
  text-align: center;
}

.landing__features {
  list-style: none;
  margin: var(--sa-space-5) 0 0;
  padding: 0;
  display: grid;
  gap: var(--sa-space-5);
}

@media (min-width: 720px) {
  .landing__features {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sa-space-4);
  }
}

.landing__feature {
  margin: 0;
  padding: var(--sa-space-4);
  border-radius: var(--sa-radius-md, 12px);
  border: 1px solid color-mix(in srgb, var(--sa-color-text-main, #fff) 8%, transparent);
  background: color-mix(in srgb, var(--sa-color-surface, #2b2d31) 82%, transparent);
}
</style>
