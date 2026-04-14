<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppCard from '@/components/ui/AppCard.vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { STREAM_APP_BRAND_NAME } from '@/eat-first/constants/brand.js'
import { useAuth } from '@/composables/useAuth'
import { useStreamAuthModal } from '@/composables/useStreamAuthModal'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isAuthenticated, refresh } = useAuth()
const { openStreamAuthModal } = useStreamAuthModal()

const needLoginBanner = computed(() => route.query.needLogin === '1')
const authRedirectTarget = computed(() => {
  const r = route.query.authRedirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/call'
})

onMounted(() => {
  void refresh()
})

watch(
  () => route.query.needLogin,
  (need) => {
    if (need === '1') {
      openStreamAuthModal(authRedirectTarget.value)
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

      <ul class="home__cards">
        <li class="home__cards-item">
          <RouterLink :to="{ name: 'call' }" class="home__card-link">
            <AppCard interactive>
              <h2 class="home__card-title">{{ t('home.callTitle') }}</h2>
              <p class="home__card-text">{{ t('home.callDesc') }}</p>
            </AppCard>
          </RouterLink>
        </li>
        <li class="home__cards-item">
          <RouterLink :to="{ name: 'wordle' }" class="home__card-link">
            <AppCard interactive>
              <h2 class="home__card-title">{{ t('home.wordleTitle') }}</h2>
              <p class="home__card-text">{{ t('home.wordleDesc') }}</p>
            </AppCard>
          </RouterLink>
        </li>
        <li class="home__cards-item home__cards-item--eat">
          <RouterLink :to="{ name: 'eat', query: { view: 'join' } }" class="home__card-link">
            <AppCard interactive>
              <h2 class="home__card-title">{{ t('home.eatTitle') }}</h2>
              <p class="home__card-text">{{ t('home.eatDesc') }}</p>
            </AppCard>
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

.home__cards {
  list-style: none;
  margin: var(--sa-space-8) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 260px));
  justify-content: center;
  align-items: stretch;
  gap: var(--sa-space-5);
  width: 100%;
  max-width: 36rem;
  box-sizing: border-box;
}

.home__cards-item {
  margin: 0;
  min-width: 0;
}

.home__card-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.home__card-link:focus-visible {
  outline: 2px solid var(--sa-color-primary);
  outline-offset: 3px;
  border-radius: var(--sa-radius-lg);
}

@media (max-width: 600px) {
  .home__cards {
    grid-template-columns: 1fr;
  }
}

.home__cards-item--eat {
  grid-column: 1 / -1;
  justify-self: center;
  width: min(100%, 260px);
}

.home__card-title {
  margin: 0 0 var(--sa-space-2);
  font-family: var(--font-body, var(--sa-font-main));
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-title, var(--sa-color-text-main));
}

.home__card-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--text-body, var(--sa-color-text-body));
}
</style>
