<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { eatViewFromRoute } from '@/eat-first'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { useAuth } from '@/composables/useAuth'

const defaultNadleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isAdmin } = useAuth()

/** На головній дублювати «дім» не потрібно; на інших сторінках — швидкий перехід на лобі. */
const showHomeLink = computed(() => route.name !== 'home')

/** У Eat на підвидах (не join) показуємо «Назад». */
const showEatBack = computed(
  () => route.path.startsWith('/app/eat') && eatViewFromRoute(route) !== 'join',
)

function goEatBack() {
  if (!showEatBack.value) return
  router.back()
}
</script>

<template>
  <nav class="stream-nav" :aria-label="t('app.navAria')">
    <div class="stream-nav__leading">
      <RouterLink
        v-if="showHomeLink"
        class="stream-nav__icon"
        :to="{ name: 'home' }"
        :aria-label="t('app.navHome')"
        :title="t('app.navHome')"
      >
        <svg
          class="stream-nav__svg"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.75"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      </RouterLink>
      <button
        v-if="showEatBack"
        type="button"
        class="stream-nav__icon stream-nav__icon--btn"
        :aria-label="t('app.navBack')"
        :title="t('app.navBack')"
        @click="goEatBack"
      >
        <svg
          class="stream-nav__svg"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.75"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
      </button>
    </div>
    <div class="stream-nav__links">
      <RouterLink
        class="stream-nav__link"
        :to="{ name: 'nadle-streamer', params: { streamer: defaultNadleStreamer } }"
      >
        {{ t('app.navNadle') }}
      </RouterLink>
      <RouterLink
        class="stream-nav__link"
        :to="{ name: 'nadraw-show', params: { streamer: defaultNadleStreamer } }"
        :title="t('routes.nadrawShow')"
        :aria-label="t('routes.nadrawShow')"
      >
        {{ t('app.navNadrawShow') }}
      </RouterLink>
      <RouterLink
        class="stream-nav__link"
        :to="{ name: 'eat', query: { view: 'join' } }"
        :title="t('game.title')"
        :aria-label="t('game.title')"
      >
        {{ t('app.navEat') }}
      </RouterLink>
      <RouterLink
        class="stream-nav__link"
        :to="{ name: 'call' }"
        :title="t('app.navCallTitle')"
        :aria-label="t('app.navCallTitle')"
      >
        {{ t('app.navCall') }}
      </RouterLink>
      <RouterLink
        class="stream-nav__link"
        :to="{ name: 'mafia' }"
        :title="t('routes.mafia')"
        :aria-label="t('routes.mafia')"
      >
        {{ t('app.navMafia') }}
      </RouterLink>
      <RouterLink
        v-if="isAdmin"
        class="stream-nav__link"
        :class="{ 'router-link-active stream-nav__link--active': route.path.startsWith('/app/admin') }"
        :to="{ name: 'admin-users' }"
        :title="t('routes.admin')"
        :aria-label="t('routes.admin')"
      >
        {{ t('routes.admin') }}
      </RouterLink>
    </div>
    <div class="stream-nav__trailing" aria-hidden="true">
      <span v-if="showHomeLink || showEatBack" class="stream-nav__trailing-spacer" />
    </div>
  </nav>
</template>

<style scoped>
.stream-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  min-width: 0;
}

.stream-nav__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: var(--ui-radius-md, 8px);
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--bg-muted, color-mix(in srgb, var(--sa-color-surface-raised) 75%, transparent));
  color: var(--text-heading, var(--sa-color-text-main));
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.stream-nav__icon:hover,
.stream-nav__icon.router-link-active {
  border-color: var(--border-strong, var(--sa-color-primary-border));
  background: var(--bg-muted-strong, color-mix(in srgb, var(--sa-color-surface) 88%, transparent));
  color: var(--text-title, var(--sa-color-primary));
}

.stream-nav__icon:focus-visible {
  outline: 2px solid var(--border-cyan-strong, var(--sa-color-primary));
  outline-offset: 2px;
}

.stream-nav__icon--btn {
  cursor: pointer;
  font: inherit;
}

.stream-nav__svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  display: block;
  pointer-events: none;
}

.stream-nav__leading,
.stream-nav__trailing {
  display: flex;
  align-items: center;
  min-width: 0;
}

.stream-nav__trailing {
  justify-content: flex-end;
}

.stream-nav__trailing-spacer {
  display: none;
  flex-shrink: 0;
  pointer-events: none;
}

.stream-nav__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.35rem;
}

.stream-nav__link {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--bg-card-soft, color-mix(in srgb, var(--sa-color-surface) 80%, transparent));
  color: var(--text-secondary, var(--sa-color-text-muted));
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.stream-nav__link:hover,
.stream-nav__link.router-link-active,
.stream-nav__link.stream-nav__link--active {
  border-color: var(--border-strong, var(--sa-color-primary-border));
  color: var(--text-title, var(--sa-color-primary));
}

.stream-nav__link:focus-visible {
  outline: 2px solid var(--border-cyan-strong, var(--sa-color-primary));
  outline-offset: 2px;
}

.stream-nav__link--btn {
  cursor: pointer;
  font: inherit;
}

/* Телефон / вузький планшет: як у другому рядку шапки — ліворуч іконка, по центру посилання, справа баланс */
@media (max-width: 640px) {
  .stream-nav {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    column-gap: 0.35rem;
    width: 100%;
    max-width: 100%;
  }

  .stream-nav__leading {
    justify-content: flex-start;
  }

  .stream-nav__links {
    flex-wrap: nowrap;
    justify-content: center;
    gap: 0.2rem 0.28rem;
  }

  .stream-nav__trailing-spacer {
    display: block;
    width: 1.75rem;
    height: 1.75rem;
    visibility: hidden;
  }

  .stream-nav__icon,
  .stream-nav__icon--btn {
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
  }

  .stream-nav__svg {
    width: 1rem;
    height: 1rem;
  }

  .stream-nav__link {
    font-size: 0.62rem;
    padding: 0.14rem 0.32rem;
    letter-spacing: 0.04em;
  }
}

</style>
