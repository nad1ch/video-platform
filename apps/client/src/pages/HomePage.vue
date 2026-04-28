<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import AppEconomySection from '@/pages/app/components/AppEconomySection.vue'
import AppGamesSection from '@/pages/app/components/AppGamesSection.vue'
import AppVideoCallSection from '@/pages/app/components/AppVideoCallSection.vue'
import eatFirstImage from '@/assets/landing/eat-first.png'
import eatFirstImageWebp from '@/assets/landing/eat-first.webp'
import mafiaImage from '@/assets/landing/mafia.png'
import mafiaImageWebp from '@/assets/landing/mafia.webp'
import nadleImage from '@/assets/landing/nadle.png'
import nadleImageWebp from '@/assets/landing/nadle.webp'
import nadrawImage from '@/assets/landing/nadraw-phone.png'
import nadrawImageWebp from '@/assets/landing/nadraw-phone.webp'
import spyImage from '@/assets/landing/spy.png'
import spyImageWebp from '@/assets/landing/spy.webp'
import whoTakeShitImage from '@/assets/landing/who-take-shit.png'
import { useAuth } from '@/composables/useAuth'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { loadMafiaPage, loadNadleStreamPage } from '@/routerRouteLoaders'
import { prefetchRoute } from '@/utils/routePrefetch'

type AppGameCard = {
  id: string
  title: string
  subtitle?: string
  to?: RouteLocationRaw
  image: string
  imageWebp?: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
  prefetch?: () => void
  modalVisual?: 'image' | 'economy-slot'
  comingSoon?: {
    eyebrow: string
    title?: string
    description: string
    status: string
    variant?: 'game' | 'economy'
  }
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuth()

const defaultNadleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

const callRoute = { name: 'call' } satisfies RouteLocationRaw
const mafiaRoute = { name: 'mafia' } satisfies RouteLocationRaw
const economyComingSoonRoute = { name: 'home', query: { comingSoon: 'economy' } } satisfies RouteLocationRaw

const nadleRoute = computed<RouteLocationRaw>(() => ({
  name: 'nadle-streamer',
  params: { streamer: defaultNadleStreamer },
}))

const nadrawRoute = computed<RouteLocationRaw>(() => ({
  name: 'nadraw-show',
  params: { streamer: defaultNadleStreamer },
}))

const prefetchMafia = () => prefetchRoute(loadMafiaPage)
const prefetchNadle = () => prefetchRoute(loadNadleStreamPage)

const gameCards = computed<AppGameCard[]>(() => [
  {
    id: 'eat-first',
    title: t('home.gameEatFirst'),
    image: eatFirstImage,
    imageWebp: eatFirstImageWebp,
    ariaLabel: t('home.openEatFirst'),
    tone: 'amber',
    comingSoon: {
      eyebrow: t('home.comingSoonEyebrow'),
      title: t('home.gameEatFirstComingSoonTitle'),
      description: t('home.gameEatFirstComingSoonDesc'),
      status: t('home.comingSoonStatus'),
    },
  },
  {
    id: 'mafia',
    title: t('home.gameMafia'),
    to: mafiaRoute,
    image: mafiaImage,
    imageWebp: mafiaImageWebp,
    ariaLabel: t('home.openMafia'),
    tone: 'slate',
    prefetch: prefetchMafia,
  },
  {
    id: 'nadle',
    title: t('home.gameNadle'),
    to: nadleRoute.value,
    image: nadleImage,
    imageWebp: nadleImageWebp,
    ariaLabel: t('home.openNadle'),
    tone: 'green',
    prefetch: prefetchNadle,
  },
  {
    id: 'nadraw',
    title: t('home.gameNadraw'),
    to: nadrawRoute.value,
    image: nadrawImage,
    imageWebp: nadrawImageWebp,
    ariaLabel: t('home.openNadraw'),
    tone: 'violet',
  },
  {
    id: 'spy',
    title: t('home.gameSpy'),
    image: spyImage,
    imageWebp: spyImageWebp,
    ariaLabel: t('home.openSpy'),
    tone: 'slate',
    comingSoon: {
      eyebrow: t('home.comingSoonEyebrow'),
      title: t('home.gameSpyComingSoonTitle'),
      description: t('home.gameSpyComingSoonDesc'),
      status: t('home.comingSoonStatus'),
    },
  },
  {
    id: 'hot-seat',
    title: t('home.gameMic'),
    image: whoTakeShitImage,
    ariaLabel: t('home.openHotSeat'),
    tone: 'amber',
    comingSoon: {
      eyebrow: t('home.comingSoonEyebrow'),
      title: t('home.gameMicComingSoonTitle'),
      description: t('home.gameMicComingSoonDesc'),
      status: t('home.comingSoonStatus'),
    },
  },
])

const economyComingSoonCards = computed<AppGameCard[]>(() => [
  {
    id: 'economy',
    title: t('home.economyComingSoonTitle'),
    image: '',
    ariaLabel: t('home.openEconomyComingSoon'),
    modalVisual: 'economy-slot',
    comingSoon: {
      eyebrow: t('home.comingSoonEyebrow'),
      title: t('home.economyComingSoonTitle'),
      description: t('home.economyComingSoonDesc'),
      status: t('home.comingSoonStatus'),
      variant: 'economy',
    },
  },
])

const needLoginBanner = computed(() => route.query.needLogin === '1')
const authRedirectTarget = computed(() => {
  const r = route.query.authRedirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app/call'
})

const authLoading = computed(() => !auth.loaded.value)
const comingSoonGameId = computed(() => {
  const value = route.query.comingSoon
  return typeof value === 'string' ? value : null
})

function clearComingSoonGame(): void {
  if (!('comingSoon' in route.query)) return
  const query = { ...route.query }
  delete query.comingSoon
  void router.replace({ name: 'home', query })
}

onMounted(() => {
  void auth.refresh()
})

watch(
  () => route.query.needLogin,
  (need) => {
    if (need === '1') {
      void router.replace({
        name: 'auth',
        query: {
          redirect: authRedirectTarget.value,
          mode: 'login',
        },
      })
    }
  },
  { immediate: true },
)

watch(
  () => [route.query.needLogin, auth.isAuthenticated.value, route.query.authRedirect] as const,
  ([need, authed, redir]) => {
    if (need === '1' && authed && typeof redir === 'string' && redir.startsWith('/')) {
      void router.replace(redir)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-home" :aria-busy="authLoading">
    <div class="app-home__shell">
      <main class="app-home__main">
        <p v-if="needLoginBanner" class="app-home__auth-banner" role="status">
          {{ t('app.authNeedLogin') }}
          {{ t('app.authNeedLoginHeaderHint') }}
        </p>

        <div class="app-home__grid">
          <div class="app-home__feature-stack">
            <AppVideoCallSection :to="callRoute" :auth-hint="t('home.openVideoCall')" />
            <AppEconomySection :to="economyComingSoonRoute" />
          </div>

          <AppGamesSection
            :items="gameCards"
            :modal-items="economyComingSoonCards"
            :coming-soon-item-id="comingSoonGameId"
            @coming-soon-close="clearComingSoonGame"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-home {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
  color: #fff;
  letter-spacing: 0;
  --app-home-display: "Climate Crisis", "Arial Black", Impact, var(--sa-font-display, system-ui), sans-serif;
  --app-home-ui: "Marmelad", var(--sa-font-main, system-ui), sans-serif;
  --app-home-jackpot: "Arbutus", Georgia, serif;
  --app-home-counter: "Coda Caption", var(--sa-font-display, system-ui), sans-serif;
  --app-home-card-border: 5px;
  --app-home-glass-blur: 6px;
  --app-home-glass-panel-bg: rgba(28, 12, 52, 0.14);
  --app-home-glass-inner-bg: rgba(60, 36, 99, 0.16);
  --app-home-glass-chrome-bg: rgba(18, 8, 34, 0.14);
  --app-home-glass-footer-bg: rgba(32, 20, 52, 0.14);
  --app-home-glass-footer-chip-bg: rgba(81, 48, 116, 0.16);
  --app-home-glass-action-bg: rgba(81, 48, 116, 0.16);
  background: transparent;
  isolation: isolate;
}

.app-home__shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.app-home__main {
  display: flex;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1rem, 2.2vh, 1.55rem) clamp(1rem, 4vw, 5.4rem) clamp(1rem, 2.2vh, 1.55rem);
  box-sizing: border-box;
}

.app-home__auth-banner {
  width: min(100%, 42rem);
  margin: 0 auto 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(255, 218, 68, 0.3);
  border-radius: 1rem;
  background: rgba(255, 218, 68, 0.1);
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.app-home__grid {
  display: grid;
  grid-template-columns: minmax(0, 671fr) minmax(0, 503fr);
  align-items: stretch;
  gap: clamp(0.78rem, 1.37vw, 1.24rem);
  width: min(86vw, 74.25rem);
  max-width: 100%;
  margin: 0 auto;
}

.app-home__feature-stack {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: clamp(0.45rem, 1.47vw, 0.72rem);
  min-width: 0;
  height: 100%;
  align-self: stretch;
}

.app-home__feature-stack > * {
  min-width: 0;
}

@media (max-width: 1200px) {
  .app-home {
    overflow-x: hidden;
    --app-home-card-border: 3px;
  }

  .app-home__main {
    padding: clamp(1rem, 2.2vh, 1.45rem) clamp(0.8rem, 2.6vw, 1.6rem);
  }

  .app-home__grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: min(calc(100vw - 2.5rem), 62rem);
    gap: 0.9rem;
  }

  .app-home__feature-stack {
    gap: clamp(0.75rem, 2vh, 1.1rem);
  }
}

@media (max-width: 1024px) {
  .app-home {
    overflow-y: auto;
    --app-home-card-border: 4px;
  }

  .app-home__main {
    justify-content: flex-start;
    padding: 1.45rem clamp(1rem, 4vw, 2rem) 2.4rem;
  }

  .app-home__grid {
    grid-template-columns: 1fr;
    width: min(100%, 56rem);
    gap: 1.4rem;
  }

  .app-home__feature-stack {
    grid-template-rows: auto;
    gap: 1.4rem;
  }
}

@media (max-width: 640px) {
  .app-home__main {
    padding: 1.15rem 0.75rem 1.5rem;
  }

  .app-home__grid {
    gap: 1rem;
  }

  .app-home__feature-stack {
    gap: 1rem;
  }
}
</style>
