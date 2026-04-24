<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import AppEconomySection from '@/pages/app/components/AppEconomySection.vue'
import AppFooter from '@/pages/app/components/AppFooter.vue'
import AppGamesSection from '@/pages/app/components/AppGamesSection.vue'
import AppHeader from '@/pages/app/components/AppHeader.vue'
import AppVideoCallSection from '@/pages/app/components/AppVideoCallSection.vue'
import eatFirstImage from '@/assets/landing/eat-first.png'
import mafiaImage from '@/assets/landing/mafia.png'
import nadleImage from '@/assets/landing/nadle.png'
import nadrawImage from '@/assets/landing/nadraw-phone.png'
import spyImage from '@/assets/landing/spy.png'
import { useAuth } from '@/composables/useAuth'
import { useStreamAuthModal } from '@/composables/useStreamAuthModal'
import { BRAND_LOGO_LIGHT_SVG, STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { LOCALE_OPTIONS, persistLocale } from '@/eat-first/i18n'
import type { AuthMode } from '@/types/authMode'

type AppGameCard = {
  id: string
  title: string
  subtitle?: string
  to: RouteLocationRaw
  image: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
}

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuth()
const { openStreamAuthModal } = useStreamAuthModal()

const defaultNadleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

const callRoute = { name: 'call' } satisfies RouteLocationRaw
const mafiaRoute = { name: 'mafia' } satisfies RouteLocationRaw
const eatRoute = { name: 'eat', query: { view: 'join' } } satisfies RouteLocationRaw
const coinHubRoute = { name: 'coin-hub' } satisfies RouteLocationRaw
const feedbackHref = 'mailto:feedback@streamassist.net?subject=StreamAssist%20feedback'
const appHeaderBrand = 'Stream Assist'

const wordleRoute = computed<RouteLocationRaw>(() => ({
  name: 'nadle-streamer',
  params: { streamer: defaultNadleStreamer },
}))

const nadrawRoute = computed<RouteLocationRaw>(() => ({
  name: 'nadraw-show',
  params: { streamer: defaultNadleStreamer },
}))

const gameCards = computed<AppGameCard[]>(() => [
  {
    id: 'eat-first',
    title: 'Eat First',
    subtitle: 'Show game',
    to: eatRoute,
    image: eatFirstImage,
    ariaLabel: 'Open Eat First',
    tone: 'amber',
  },
  {
    id: 'mafia',
    title: 'Mafia',
    subtitle: 'Live roles',
    to: mafiaRoute,
    image: mafiaImage,
    ariaLabel: 'Open Mafia',
    tone: 'slate',
  },
  {
    id: 'wordle',
    title: 'Wordle',
    subtitle: 'Chat puzzle',
    to: wordleRoute.value,
    image: nadleImage,
    ariaLabel: 'Open Wordle',
    tone: 'green',
  },
  {
    id: 'nadraw',
    title: 'Nadraw',
    subtitle: 'Draw show',
    to: nadrawRoute.value,
    image: nadrawImage,
    ariaLabel: 'Open Nadraw',
    tone: 'violet',
  },
  {
    id: 'spy',
    title: 'Spy',
    subtitle: 'Party roles',
    to: mafiaRoute,
    image: spyImage,
    ariaLabel: 'Open Spy party roles',
    tone: 'slate',
  },
  {
    id: 'hot-seat',
    title: 'Hot Seat',
    subtitle: 'Show pick',
    to: eatRoute,
    image: eatFirstImage,
    ariaLabel: 'Open Hot Seat',
    tone: 'amber',
  },
])

const localeMenuOptions = LOCALE_OPTIONS.map((o) => ({ value: o.code, label: o.label }))
const needLoginBanner = computed(() => route.query.needLogin === '1')
const authRedirectTarget = computed(() => {
  const r = route.query.authRedirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app/call'
})

const authLoading = computed(() => !auth.loaded.value)
const userName = computed(() => auth.user.value?.displayName ?? '')
const userAvatar = computed(() => auth.user.value?.avatar ?? '')
const footerYear = new Date().getFullYear()

onMounted(() => {
  void auth.refresh()
})

function openAuth(mode: AuthMode) {
  openStreamAuthModal(route.fullPath || '/app', mode)
}

function onLocaleUpdate(nextLocale: string) {
  void persistLocale(nextLocale)
}

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
    <div class="app-home__glow app-home__glow--one" aria-hidden="true" />
    <div class="app-home__glow app-home__glow--two" aria-hidden="true" />

    <div class="app-home__shell">
      <AppHeader
        :auth-loading="authLoading"
        :brand-name="appHeaderBrand"
        :coin-hub-to="coinHubRoute"
        :is-authenticated="auth.isAuthenticated.value"
        :locale="locale"
        :locale-options="localeMenuOptions"
        :logo-src="BRAND_LOGO_LIGHT_SVG"
        :user-avatar="userAvatar"
        :user-name="userName"
        @login="openAuth('login')"
        @signup="openAuth('login')"
        @update:locale="onLocaleUpdate"
      />

      <main class="app-home__main">
        <p v-if="needLoginBanner" class="app-home__auth-banner" role="status">
          {{ t('app.authNeedLogin') }}
          {{ t('app.authNeedLoginHeaderHint') }}
        </p>

        <div class="app-home__grid">
          <div class="app-home__feature-stack">
            <AppVideoCallSection :to="callRoute" auth-hint="Open video call" />
            <AppEconomySection :to="coinHubRoute" />
          </div>

          <AppGamesSection :items="gameCards" />
        </div>
      </main>

      <AppFooter :brand-name="STREAMER_NICK" :feedback-href="feedbackHref" :year="footerYear" />
    </div>
  </div>
</template>

<style scoped>
.app-home {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  color: #fff;
  letter-spacing: 0;
  background:
    radial-gradient(circle at 18% 28%, rgba(255, 255, 255, 0.18) 0 1px, transparent 1.7px),
    radial-gradient(circle at 46% 62%, rgba(255, 255, 255, 0.16) 0 1px, transparent 1.7px),
    radial-gradient(circle at 78% 34%, rgba(255, 255, 255, 0.12) 0 1px, transparent 1.7px),
    linear-gradient(120deg, #0b0317 0%, rgba(74, 50, 116, 0.82) 100%);
  isolation: isolate;
}

.app-home::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(circle at 12% 88%, rgba(124, 77, 219, 0.2), transparent 36%),
    radial-gradient(circle at 72% 8%, rgba(255, 163, 108, 0.13), transparent 30%);
  content: '';
  pointer-events: none;
}

.app-home__glow {
  position: absolute;
  z-index: 0;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(70px);
}

.app-home__glow--one {
  left: -7rem;
  top: 18%;
  width: 22rem;
  height: 22rem;
  background: rgba(124, 77, 219, 0.22);
}

.app-home__glow--two {
  right: -9rem;
  bottom: 14%;
  width: 27rem;
  height: 27rem;
  background: rgba(102, 56, 143, 0.28);
}

.app-home__shell {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
}

.app-home__main {
  display: flex;
  width: 100%;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.8rem, 5vw, 4rem) clamp(1rem, 5vw, 5.4rem);
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
  grid-template-columns: minmax(0, 1.36fr) minmax(21rem, 0.96fr);
  align-items: stretch;
  gap: clamp(1.2rem, 3.2vw, 2rem);
  width: min(100%, 74rem);
  margin: 0 auto;
}

.app-home__feature-stack {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: clamp(1.2rem, 3.2vw, 3.6rem);
  min-width: 0;
}

@media (max-width: 1020px) {
  .app-home {
    overflow: visible;
  }

  .app-home__main {
    justify-content: flex-start;
  }

  .app-home__grid {
    grid-template-columns: 1fr;
  }

  .app-home__feature-stack {
    grid-template-rows: auto;
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
