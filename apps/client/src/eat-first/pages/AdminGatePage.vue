<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from '../config/access.js'
import { getPersistedGameId, setPersistedGameId } from '../utils/persistedGameId.js'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, loaded, isAuthenticated, ensureAuthLoaded, loginWithTwitch, loginWithGoogle } = useAuth()

const gameId = computed(() => {
  const g = String(route.query.game ?? '').trim()
  if (g) return g
  const p = getPersistedGameId()
  if (p) return p
  return 'test1'
})

const canHost = computed(() => {
  const r = user.value?.role
  return r === 'admin' || r === 'host'
})

watch(gameId, (g) => setPersistedGameId(g))

onMounted(() => {
  if (typeof window === 'undefined') return
  void ensureAuthLoaded()
  const g = route.query.game
  if (g != null && String(g).trim()) return
  const p = getPersistedGameId()
  if (p) router.replace({ name: 'eat', query: { view: 'admin', game: p } })
})

watch(
  [loaded, canHost, gameId],
  () => {
    if (!loaded.value || !canHost.value) return
    router.replace({
      name: 'eat',
      query: {
        view: 'control',
        game: gameId.value,
        [HOST_PANEL_QUERY_KEY]: HOST_PANEL_QUERY_VALUE,
      },
    })
  },
  { immediate: true },
)

function backJoin() {
  router.push({ name: 'eat', query: { view: 'join', game: gameId.value } })
}
</script>

<template>
  <div class="gate anim-fade-in">
    <p class="eyebrow">{{ t('admin.eyebrow') }}</p>
    <h1 class="title">{{ t('admin.title') }}</h1>
    <p class="hint">{{ t('admin.room') }} <strong>{{ gameId }}</strong></p>

    <template v-if="!loaded">
      <p class="status">{{ t('admin.loading') }}</p>
    </template>
    <template v-else-if="canHost">
      <p class="status">{{ t('admin.redirecting') }}</p>
    </template>
    <template v-else-if="isAuthenticated">
      <p class="err">{{ t('admin.needHostRole') }}</p>
    </template>
    <template v-else>
      <p class="sign-hint">{{ t('admin.signInHint') }}</p>
      <div class="login-row">
        <button type="button" class="btn btn--secondary" @click="loginWithTwitch(route.fullPath)">
          Twitch
        </button>
        <button type="button" class="btn btn--secondary" @click="loginWithGoogle(route.fullPath)">
          Google
        </button>
      </div>
    </template>

    <button type="button" class="link-back" @click="backJoin">{{ t('admin.back') }}</button>
  </div>
</template>

<style scoped>
.gate {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: clamp(1.5rem, 4vh, 2.5rem) 1.25rem;
  max-width: 22rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-family: var(--font-body);
  color: var(--text-body);
  background: transparent;
}

.eyebrow {
  margin: 0;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.title {
  margin: 0.4rem 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-title);
}

.hint {
  margin: 0 0 1.25rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.hint strong {
  color: var(--text-heading);
}

.status {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.sign-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.err {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--error-text);
}

.login-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn {
  padding: 0.65rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--accent);
  background: var(--accent-fill);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn--secondary {
  background: var(--bg-input);
  color: var(--text-body);
  border-color: var(--border-input);
}

.link-back {
  margin-top: 1.5rem;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.link-back:hover {
  color: var(--text-heading);
}
</style>
