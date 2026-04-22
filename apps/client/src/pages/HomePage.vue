<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppContainer from '@/components/ui/AppContainer.vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { STREAM_APP_BRAND_NAME, STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { useAuth } from '@/composables/useAuth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isAuthenticated, refresh } = useAuth()

const defaultNadleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

const needLoginBanner = computed(() => route.query.needLogin === '1')
const authRedirectTarget = computed(() => {
  const r = route.query.authRedirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app/call'
})

onMounted(() => {
  void refresh()
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
  () => [route.query.needLogin, isAuthenticated.value, route.query.authRedirect] as const,
  ([need, authed, redir]) => {
    if (need === '1' && authed && typeof redir === 'string' && redir.startsWith('/')) {
      router.replace(redir)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-route">
    <AppContainer class="home">
      <header class="home__hero">
        <h1 class="home__title">{{ STREAM_APP_BRAND_NAME }}</h1>
        <p class="home__tag">{{ t('home.tagline') }}</p>
      </header>

      <p v-if="needLoginBanner" class="home__auth-banner" role="status">
        {{ t('app.authNeedLogin') }}
        {{ t('app.authNeedLoginHeaderHint') }}
      </p>

      <ul class="home__nav-pills" :aria-label="t('app.navAria')">
        <li class="home__nav-pills__item">
          <RouterLink :to="{ name: 'call' }" class="home__pill home__pill--primary">
            <span class="home__pill__title">{{ t('home.callTitle') }}</span>
            <span class="home__pill__desc">{{ t('home.callDesc') }}</span>
          </RouterLink>
        </li>
        <li class="home__nav-pills__item">
          <RouterLink :to="{ name: 'mafia' }" class="home__pill home__pill--ghost">
            <span class="home__pill__title">{{ t('home.mafiaTitle') }}</span>
            <span class="home__pill__desc">{{ t('home.mafiaDesc') }}</span>
          </RouterLink>
        </li>
        <li class="home__nav-pills__item">
          <RouterLink
            :to="{ name: 'nadle-streamer', params: { streamer: defaultNadleStreamer } }"
            class="home__pill home__pill--ghost"
          >
            <span class="home__pill__title">{{ t('home.nadleTitle') }}</span>
            <span class="home__pill__desc">{{ t('home.nadleDesc') }}</span>
          </RouterLink>
        </li>
        <li class="home__nav-pills__item">
          <RouterLink :to="{ name: 'eat', query: { view: 'join' } }" class="home__pill home__pill--ghost">
            <span class="home__pill__title">{{ t('home.eatTitle') }}</span>
            <span class="home__pill__desc">{{ t('home.eatDesc') }}</span>
          </RouterLink>
        </li>
      </ul>
    </AppContainer>
  </div>
</template>

<style scoped>
.page-route {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

.home {
  align-items: center;
  text-align: center;
  padding-bottom: var(--sa-space-10);
}

.home__hero {
  max-width: 36rem;
  margin-top: clamp(2.5rem, 10vh, 5rem);
}

.home__title {
  margin: 0;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: clamp(1.75rem, 4vw, 2.35rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-title, var(--sa-color-text-main));
}

.home__tag {
  margin: var(--sa-space-3) 0 0;
  font-size: 1rem;
  line-height: 1.45;
  color: var(--text-body, var(--sa-color-text-body));
}

.home__auth-banner {
  margin: var(--sa-space-4) 0 0;
  max-width: 36rem;
  padding: var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-primary-border);
  background: color-mix(in srgb, var(--sa-color-primary) 12%, var(--sa-color-surface));
  color: var(--sa-color-text-main);
  font-size: 0.92rem;
}

/* Ряд «як у Discord»: pill + primary blurple, інші — темні капсули з бордером */
.home__nav-pills {
  list-style: none;
  margin: var(--sa-space-8) 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.65rem 0.85rem;
  width: 100%;
  max-width: min(56rem, 100%);
  box-sizing: border-box;
}

.home__nav-pills__item {
  margin: 0;
  min-width: 0;
}

.home__pill {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  text-align: left;
  text-decoration: none;
  padding: 0.5rem 1.15rem 0.55rem;
  min-height: 2.65rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  max-width: min(100%, 19rem);
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.home__pill:focus-visible {
  outline: 2px solid var(--sa-color-primary);
  outline-offset: 3px;
}

.home__pill--primary {
  --home-pill-fg: #ffffff;
  background: var(--sa-color-primary, #5865f2);
  border-color: color-mix(in srgb, var(--sa-color-primary) 70%, #000 30%);
  color: var(--home-pill-fg);
  font-weight: 600;
  box-shadow: 0 1px 0 color-mix(in srgb, #000 35%, transparent);
}

.home__pill--primary:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.home__pill--ghost {
  background: color-mix(in srgb, var(--sa-color-surface, #2b2d31) 88%, transparent);
  border-color: color-mix(in srgb, var(--sa-color-text-main, #fff) 10%, transparent);
  color: var(--text-title, var(--sa-color-text-main));
  box-shadow: 0 1px 0 color-mix(in srgb, #000 25%, transparent);
}

.home__pill--ghost:hover {
  background: color-mix(in srgb, var(--sa-color-surface, #2b2d31) 72%, var(--sa-color-text-main, #fff) 6%);
  border-color: color-mix(in srgb, var(--sa-color-text-main, #fff) 16%, transparent);
  transform: translateY(-1px);
}

.home__pill__title {
  display: block;
  font-family: var(--font-body, var(--sa-font-main, system-ui, sans-serif));
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.25;
}

.home__pill__desc {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1.3;
  opacity: 0.88;
}

.home__pill--primary .home__pill__desc {
  color: color-mix(in srgb, var(--home-pill-fg) 88%, transparent);
}

.home__pill--ghost .home__pill__desc {
  color: var(--text-body, var(--sa-color-text-body));
  opacity: 0.9;
}

@media (max-width: 520px) {
  .home__nav-pills {
    flex-direction: column;
    align-items: stretch;
    max-width: 22rem;
    margin-inline: auto;
  }

  .home__pill {
    max-width: none;
    align-items: center;
    text-align: center;
  }
}
</style>
