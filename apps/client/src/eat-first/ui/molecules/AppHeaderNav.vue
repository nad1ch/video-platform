<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getPersistedGameId } from '../../utils/persistedGameId.js'
import { eatViewFromRoute } from '../../eatFirstRouteUtils.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

/** На лобі кнопка «Назад» ховається — інакше можна випасти з додатку в порожню історію. */
const showBack = computed(() => eatViewFromRoute(route) !== 'join')

function gameQueryFromRoute() {
  const g = route.query?.game
  if (g != null && String(g).trim()) return { query: { game: String(g).trim() } }
  const p = getPersistedGameId()
  if (p) return { query: { game: p } }
  return {}
}

function goHome() {
  const extra = gameQueryFromRoute()
  router.push({ name: 'eat', query: { view: 'join', ...(extra.query || {}) } }).then(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  })
}

function goBack() {
  if (!showBack.value) return
  router.back()
}
</script>

<template>
  <nav class="app-header-nav" :aria-label="t('app.navAria')">
    <button
      type="button"
      class="app-header-nav__btn"
      :aria-label="t('app.navHome')"
      :title="t('app.navHome')"
      @click="goHome"
    >
      <!-- Heroicons outline Home (MIT) -->
      <svg
        class="app-header-nav__svg"
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
    </button>
    <button
      v-if="showBack"
      type="button"
      class="app-header-nav__btn"
      :aria-label="t('app.navBack')"
      :title="t('app.navBack')"
      @click="goBack"
    >
      <!-- Heroicons outline ArrowLeft (MIT) -->
      <svg
        class="app-header-nav__svg"
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
  </nav>
</template>

<style scoped>
.app-header-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;
}

.app-header-nav__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border-radius: var(--ui-radius-md, 8px);
  border: 1px solid var(--border-subtle);
  background: var(--bg-muted);
  color: var(--text-heading);
  cursor: pointer;
  line-height: 1;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.app-header-nav__btn:hover {
  border-color: var(--border-strong);
  background: var(--bg-muted-strong);
  color: var(--text-title);
}

.app-header-nav__btn:focus-visible {
  outline: 2px solid var(--border-cyan-strong);
  outline-offset: 2px;
}

.app-header-nav__svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  display: block;
  pointer-events: none;
}
</style>
