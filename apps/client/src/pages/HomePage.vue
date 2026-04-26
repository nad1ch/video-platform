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
import { useAuth } from '@/composables/useAuth'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { loadEatFirstPage, loadMafiaPage, loadNadleStreamPage } from '@/routerRouteLoaders'
import { prefetchRoute } from '@/utils/routePrefetch'

type AppGameCard = {
  id: string
  title: string
  subtitle?: string
  to: RouteLocationRaw
  image: string
  imageWebp?: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
  prefetch?: () => void
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
const eatRoute = { name: 'eat', query: { view: 'join' } } satisfies RouteLocationRaw
const coinHubRoute = { name: 'coin-hub' } satisfies RouteLocationRaw

const nadleRoute = computed<RouteLocationRaw>(() => ({
  name: 'nadle-streamer',
  params: { streamer: defaultNadleStreamer },
}))

const nadrawRoute = computed<RouteLocationRaw>(() => ({
  name: 'nadraw-show',
  params: { streamer: defaultNadleStreamer },
}))

const prefetchEat = () => prefetchRoute(loadEatFirstPage)
const prefetchMafia = () => prefetchRoute(loadMafiaPage)
const prefetchNadle = () => prefetchRoute(loadNadleStreamPage)

const gameCards = computed<AppGameCard[]>(() => [
  {
    id: 'eat-first',
    title: t('home.gameEatFirst'),
    to: eatRoute,
    image: eatFirstImage,
    imageWebp: eatFirstImageWebp,
    ariaLabel: t('home.openEatFirst'),
    tone: 'amber',
    prefetch: prefetchEat,
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
    to: mafiaRoute,
    image: spyImage,
    imageWebp: spyImageWebp,
    ariaLabel: t('home.openSpy'),
    tone: 'slate',
    prefetch: prefetchMafia,
  },
  {
    id: 'hot-seat',
    title: t('home.gameMic'),
    to: eatRoute,
    image: eatFirstImage,
    imageWebp: eatFirstImageWebp,
    ariaLabel: t('home.openHotSeat'),
    tone: 'amber',
    prefetch: prefetchEat,
  },
])

const needLoginBanner = computed(() => route.query.needLogin === '1')
const authRedirectTarget = computed(() => {
  const r = route.query.authRedirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app/call'
})

const authLoading = computed(() => !auth.loaded.value)

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
            <AppEconomySection :to="coinHubRoute" />
          </div>

          <AppGamesSection :items="gameCards" />
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
  gap: 1.25rem;
  width: min(86vw, 74.25rem);
  max-width: 100%;
  margin: 0 auto;
}

.app-home__feature-stack {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 0.92fr);
  gap: clamp(1rem, 3vh, 1.8rem);
  min-width: 0;
  align-self: stretch;
}

.app-home__feature-stack > * {
  min-width: 0;
}

@media (max-width: 1200px) {
  .app-home {
    overflow-x: hidden;
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
    gap: clamp(1.1rem, 3.4vh, 2rem);
  }
}

@media (max-width: 900px) {
  .app-home {
    overflow-y: auto;
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
