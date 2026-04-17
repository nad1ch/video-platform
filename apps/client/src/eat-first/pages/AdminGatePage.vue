<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ADMIN_KEY, HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from '../config/access.js'
import { getPersistedGameId, setPersistedGameId } from '../utils/persistedGameId.js'
import { saveHostAccessSession, clearHostAccessSession } from '../utils/persistedHostSession.js'
import { callableApiEnabled } from '../api/callableApi.js'
import { ensureAnonymousAuth } from '../services/authBootstrap.js'
import { callPromoteToHost } from '../api/callableClient.js'
import { auth } from '../firebase.js'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

const keyInput = ref('')
const err = ref('')

const gameId = computed(() => {
  const g = String(route.query.game ?? '').trim()
  if (g) return g
  const p = getPersistedGameId()
  if (p) return p
  return 'test1'
})

watch(gameId, (g) => setPersistedGameId(g))

onMounted(() => {
  if (typeof window === 'undefined') return
  const g = route.query.game
  if (g != null && String(g).trim()) return
  const p = getPersistedGameId()
  if (p) router.replace({ name: 'eat', query: { view: 'admin', game: p } })
})

watch(
  () => route.query.game,
  () => {
    err.value = ''
  },
)

async function submit() {
  err.value = ''
  const key = String(keyInput.value).trim()

  if (callableApiEnabled()) {
    try {
      await ensureAnonymousAuth()
      await callPromoteToHost(key)
      await auth?.currentUser?.getIdToken(true)
      saveHostAccessSession(key)
      router.replace({
        name: 'eat',
        query: {
          view: 'control',
          game: gameId.value,
          [HOST_PANEL_QUERY_KEY]: HOST_PANEL_QUERY_VALUE,
        },
      })
    } catch {
      err.value = t('admin.wrongKey')
    }
    return
  }

  if (key !== ADMIN_KEY) {
    err.value = t('admin.wrongKey')
    return
  }
  saveHostAccessSession(ADMIN_KEY)
  router.replace({
    name: 'eat',
    query: {
      view: 'control',
      game: gameId.value,
      [HOST_PANEL_QUERY_KEY]: HOST_PANEL_QUERY_VALUE,
    },
  })
}

function forgetSavedHost() {
  clearHostAccessSession()
  keyInput.value = ''
  err.value = ''
}

function backJoin() {
  router.push({ name: 'eat', query: { view: 'join', game: gameId.value } })
}
</script>

<template>
  <div class="gate anim-fade-in">
    <p class="eyebrow">{{ t('admin.eyebrow') }}</p>
    <h1 class="title">{{ t('admin.title') }}</h1>
    <p class="hint">{{ t('admin.room') }} <strong>{{ gameId }}</strong></p>

    <form class="form" @submit.prevent="submit">
      <label class="lbl" for="k">{{ t('admin.key') }}</label>
      <input id="k" v-model="keyInput" type="password" class="inp" autocomplete="off" />
      <p v-if="err" class="err">{{ err }}</p>
      <button type="submit" class="btn">{{ t('admin.submit') }}</button>
    </form>

    <button type="button" class="link-back" @click="backJoin">{{ t('admin.back') }}</button>
    <button type="button" class="link-forget" @click="forgetSavedHost">{{ t('admin.forgetSaved') }}</button>
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

.form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lbl {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.inp {
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  color: var(--text-body);
  font-size: 0.95rem;
}

.err {
  margin: 0;
  font-size: 0.8rem;
  color: var(--error-text);
}

.btn {
  margin-top: 0.35rem;
  padding: 0.7rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--accent);
  background: var(--accent-fill);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
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

.link-forget {
  margin-top: 0.65rem;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.72rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  opacity: 0.85;
}

.link-forget:hover {
  color: var(--error-text);
}
</style>
