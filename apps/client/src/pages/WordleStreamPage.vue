<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const TWITCH_CHANNEL_STORAGE_KEY = 'streamassist_wordle_twitch_channel'
const DEMO_TWITCH_CHANNEL = 'nad1ch'

function normalizeTwitchLogin(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') {
    return null
  }
  const t = raw.trim().replace(/^#/, '').toLowerCase()
  if (t.length < 2 || t.length > 25) {
    return null
  }
  if (!/^[a-z0-9_]+$/.test(t)) {
    return null
  }
  return t
}

function readStoredTwitchChannel(): string | null {
  try {
    return normalizeTwitchLogin(localStorage.getItem(TWITCH_CHANNEL_STORAGE_KEY))
  } catch {
    return null
  }
}

const route = useRoute()
const router = useRouter()

const wordlePublicConfig = shallowRef<WordlePublicConfig | null>(null)
const wordlePublicConfigStatus = ref<'idle' | 'ok' | 'error'>('idle')

function channelFromQuery(): string | null {
  const q = route.query.channel
  const raw = Array.isArray(q) ? q[0] : q
  return normalizeTwitchLogin(typeof raw === 'string' ? raw : undefined)
}

function persistQueryChannelToStorage(): void {
  const q = channelFromQuery()
  if (!q) {
    return
  }
  try {
    localStorage.setItem(TWITCH_CHANNEL_STORAGE_KEY, q)
  } catch {
    /* private mode / quota */
  }
}

type Feedback = 'correct' | 'present' | 'absent'

type GuessRow = { guess: string; feedback: Feedback[] }

type GamePlayer = {
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  rows: GuessRow[]
}

type GameStatePayload = {
  gameId: string
  wordLength: number
  startedAt: number
  players: GamePlayer[]
}

type LeaderboardEntry = {
  position: number
  userId: string
  displayName: string
  attempts: number
  guessed: boolean
  guessedAt?: number
}

type ChatLine = {
  userId: string
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
  cooldownMs?: number
  guessFeedback?: Feedback[]
}

type WordlePublicConfig = {
  ingestChannel: string | null
  chatGuessCooldownMs: number
}

/** Must match `apps/server/src/wordle/wsProtocol.ts` (WordleWs). */
const Ws = {
  state: 'wordle:state',
  leaderboard: 'wordle:leaderboard',
  userGuess: 'wordle:user-guess',
  newGame: 'wordle:new-game',
  twitchChat: 'wordle:twitch-chat',
  session: 'wordle:session',
  error: 'wordle:error',
  guessRejected: 'wordle:guess-rejected',
  clientGuess: 'wordle:guess',
  clientNextWord: 'wordle:next-word',
} as const

type SessionUser = {
  id: string
  display_name: string
  profile_image_url: string
}

const gameState = shallowRef<GameStatePayload | null>(null)
const leaderboard = ref<LeaderboardEntry[]>([])
const chatLines = ref<ChatLine[]>([])
const sessionUser = shallowRef<SessionUser | null>(null)
const isAdmin = ref(false)
const adminRouteConfigured = ref(false)
const guessInput = ref('')
const wsStatus = ref<'idle' | 'open' | 'closed' | 'error'>('idle')
const lastError = ref<string | null>(null)

let ws: WebSocket | null = null

const twitchClientId = import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined
const twitchOAuthRedirect = import.meta.env.VITE_TWITCH_OAUTH_REDIRECT_URI as string | undefined

/**
 * Priority: URL ?channel= → localStorage (viewer choice) → VITE_TWITCH_CHANNEL → demo fallback.
 * Chat embed follows this; server IRC must use TWITCH_CHANNEL (match for live guesses).
 */
const effectiveTwitchChannel = computed(() => {
  void route.query.channel
  const q = channelFromQuery()
  if (q) {
    return q
  }
  const saved = readStoredTwitchChannel()
  if (saved) {
    return saved
  }
  const env = normalizeTwitchLogin(import.meta.env.VITE_TWITCH_CHANNEL as string | undefined)
  if (env) {
    return env
  }
  return DEMO_TWITCH_CHANNEL
})

const twitchChannelSource = computed<'query' | 'saved' | 'env' | 'demo'>(() => {
  void route.query.channel
  if (channelFromQuery()) {
    return 'query'
  }
  if (readStoredTwitchChannel()) {
    return 'saved'
  }
  if (normalizeTwitchLogin(import.meta.env.VITE_TWITCH_CHANNEL as string | undefined)) {
    return 'env'
  }
  return 'demo'
})

const twitchChannelSourceLabel = computed(() => {
  switch (twitchChannelSource.value) {
    case 'query':
      return 'from link'
    case 'saved':
      return 'saved'
    case 'env':
      return 'from env'
    default:
      return 'demo default'
  }
})

const shareWordleUrl = computed(() => {
  const ch = effectiveTwitchChannel.value
  const u = new URL('/wordle', window.location.origin)
  u.searchParams.set('channel', ch)
  return u.toString()
})

const serverIngestChannel = computed(() => wordlePublicConfig.value?.ingestChannel ?? null)

const channelMismatch = computed(() => {
  const s = serverIngestChannel.value
  const e = effectiveTwitchChannel.value
  if (!s || wordlePublicConfigStatus.value !== 'ok') {
    return false
  }
  return s.toLowerCase() !== e.toLowerCase()
})

const serverIngestDisabled = computed(
  () => wordlePublicConfigStatus.value === 'ok' && serverIngestChannel.value === null,
)

const ircCooldownSecondsLabel = computed(() => {
  const ms = wordlePublicConfig.value?.chatGuessCooldownMs ?? 1500
  const s = ms / 1000
  return Number.isInteger(s) ? String(s) : s.toFixed(1)
})

function formatCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return `Too fast — wait ~${label}s between guess messages`
}

function feedbackToEmojis(fb: Feedback[]): string {
  return fb
    .map((f) => (f === 'correct' ? '🟩' : f === 'present' ? '🟨' : '⬛'))
    .join(' ')
}

async function fetchWordlePublicConfig(): Promise<void> {
  try {
    const res = await fetch('/api/wordle/public-config')
    if (!res.ok) {
      wordlePublicConfigStatus.value = 'error'
      return
    }
    const j = (await res.json()) as WordlePublicConfig
    if (typeof j.chatGuessCooldownMs !== 'number' || !Number.isFinite(j.chatGuessCooldownMs)) {
      wordlePublicConfigStatus.value = 'error'
      return
    }
    wordlePublicConfig.value = {
      ingestChannel: typeof j.ingestChannel === 'string' ? j.ingestChannel : null,
      chatGuessCooldownMs: j.chatGuessCooldownMs,
    }
    wordlePublicConfigStatus.value = 'ok'
  } catch {
    wordlePublicConfig.value = null
    wordlePublicConfigStatus.value = 'error'
  }
}

const channelEditorOpen = ref(false)
const channelDraft = ref('')

function openChannelEditor(): void {
  channelDraft.value = effectiveTwitchChannel.value
  channelEditorOpen.value = true
}

function closeChannelEditor(): void {
  channelEditorOpen.value = false
}

function applyTwitchChannel(): void {
  lastError.value = null
  const n = normalizeTwitchLogin(channelDraft.value)
  if (!n) {
    lastError.value = 'Invalid Twitch channel (2–25 chars: letters, numbers, underscore).'
    return
  }
  try {
    localStorage.setItem(TWITCH_CHANNEL_STORAGE_KEY, n)
  } catch {
    lastError.value = 'Could not save channel (browser storage blocked).'
    return
  }
  closeChannelEditor()
  void router.replace({ path: '/wordle', query: { channel: n } })
}

function clearSavedTwitchChannel(): void {
  try {
    localStorage.removeItem(TWITCH_CHANNEL_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  void router.replace({ path: '/wordle', query: {} })
}

function wordleWsUrl(): string {
  const env = import.meta.env.VITE_WORDLE_WS_URL as string | undefined
  if (typeof env === 'string' && env.trim().length > 0) {
    return env.trim()
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/wordle-ws`
}

const twitchAuthUrl = computed(() => {
  if (!twitchClientId || !twitchOAuthRedirect) {
    return null
  }
  const p = new URLSearchParams({
    client_id: twitchClientId,
    redirect_uri: twitchOAuthRedirect,
    response_type: 'code',
    scope: '',
  })
  return `https://id.twitch.tv/oauth2/authorize?${p.toString()}`
})

const chatIframeSrc = computed(() => {
  const ch = effectiveTwitchChannel.value
  const parent = location.hostname
  return `https://www.twitch.tv/embed/${encodeURIComponent(ch)}/chat?parent=${encodeURIComponent(parent)}&darkpopout`
})

watch(
  () => route.query.channel,
  () => {
    persistQueryChannelToStorage()
  },
)

watch(
  effectiveTwitchChannel,
  (ch, prev) => {
    if (prev !== undefined && ch !== prev) {
      chatLines.value = []
    }
  },
)

const chatEmbedParentHost = computed(() => location.hostname)

const sortedPlayers = computed(() => {
  const list = gameState.value?.players ?? []
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName))
})

function connectWs(): void {
  ws?.close()
  wsStatus.value = 'idle'
  const url = wordleWsUrl()
  const socket = new WebSocket(url)
  ws = socket

  socket.onopen = () => {
    wsStatus.value = 'open'
  }

  socket.onclose = () => {
    wsStatus.value = 'closed'
  }

  socket.onerror = () => {
    wsStatus.value = 'error'
  }

  socket.onmessage = (ev) => {
    let data: { type?: string; payload?: unknown }
    try {
      data = JSON.parse(String(ev.data))
    } catch {
      return
    }
    const t = data.type
    const p = data.payload
    if (t === Ws.state && p && typeof p === 'object') {
      gameState.value = p as GameStatePayload
    } else if (t === Ws.leaderboard && p && typeof p === 'object') {
      const entries = (p as { entries?: LeaderboardEntry[] }).entries
      if (Array.isArray(entries)) {
        leaderboard.value = entries
      }
    } else if (t === Ws.session && p && typeof p === 'object') {
      const o = p as { user?: SessionUser | null; isAdmin?: boolean; adminRouteConfigured?: boolean }
      sessionUser.value = o.user ?? null
      isAdmin.value = Boolean(o.isAdmin)
      adminRouteConfigured.value = Boolean(o.adminRouteConfigured)
    } else if (t === Ws.twitchChat && p && typeof p === 'object') {
      const line = p as ChatLine & { guessFeedback?: Feedback[] }
      chatLines.value = [...chatLines.value.slice(-120), line]
    } else if (t === Ws.error && p && typeof p === 'object') {
      const msg = (p as { message?: string }).message
      lastError.value = typeof msg === 'string' ? msg : 'Error'
    } else if (t === Ws.guessRejected) {
      lastError.value = 'Guess not accepted (wrong length, solved, or max attempts)'
    }
  }
}

async function refreshMe(): Promise<void> {
  try {
    const res = await fetch('/api/wordle/me', { credentials: 'include' })
    if (res.ok) {
      const j = (await res.json()) as SessionUser
      sessionUser.value = j
    } else {
      sessionUser.value = null
    }
  } catch {
    sessionUser.value = null
  }
}

function submitGuess(): void {
  lastError.value = null
  const g = gameState.value
  if (!g || !ws || ws.readyState !== WebSocket.OPEN) {
    return
  }
  const word = guessInput.value.trim()
  if (!word) {
    return
  }
  ws.send(JSON.stringify({ type: Ws.clientGuess, word, gameId: g.gameId }))
  guessInput.value = ''
}

function nextWord(): void {
  lastError.value = null
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return
  }
  ws.send(JSON.stringify({ type: Ws.clientNextWord }))
}

async function logout(): Promise<void> {
  await fetch('/api/wordle/logout', { method: 'POST', credentials: 'include' })
  sessionUser.value = null
  isAdmin.value = false
  adminRouteConfigured.value = false
  connectWs()
}

function login(): void {
  const u = twitchAuthUrl.value
  if (u) {
    window.location.href = u
  }
}

onMounted(() => {
  persistQueryChannelToStorage()
  void fetchWordlePublicConfig()
  void refreshMe()
  connectWs()
})

onUnmounted(() => {
  ws?.close()
  ws = null
})
</script>

<template>
  <div class="wordle-page">
    <header class="wordle-page__header">
      <div class="wordle-page__brand">
        <h1 class="wordle-page__title">Stream Wordle</h1>
        <p class="wordle-page__sub">Guess in Twitch chat — this page is the live board.</p>
      </div>
      <div class="wordle-page__auth">
        <RouterLink to="/" class="wordle-page__link">← Home</RouterLink>
        <RouterLink to="/call" class="wordle-page__link">Call</RouterLink>
        <template v-if="sessionUser">
          <img
            class="wordle-page__avatar"
            :src="sessionUser.profile_image_url"
            :alt="sessionUser.display_name"
            width="32"
            height="32"
          />
          <span class="wordle-page__name">{{ sessionUser.display_name }}</span>
          <button type="button" class="wordle-page__btn wordle-page__btn--ghost" @click="logout">Log out</button>
        </template>
        <button
          v-else-if="twitchAuthUrl"
          type="button"
          class="wordle-page__btn wordle-page__btn--accent"
          @click="login"
        >
          Login with Twitch
        </button>
        <span v-else class="wordle-page__hint">Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_OAUTH_REDIRECT_URI</span>
      </div>
    </header>

    <p v-if="lastError" class="wordle-page__banner">{{ lastError }}</p>
    <p v-if="channelMismatch" class="wordle-page__banner wordle-page__banner--warn">
      Chat embed ({{ effectiveTwitchChannel }}) ≠ server IRC ({{ serverIngestChannel }}). Only messages on the
      <strong>server</strong> channel count as guesses.
    </p>
    <p v-else-if="serverIngestDisabled" class="wordle-page__banner wordle-page__banner--warn">
      Server is not ingesting Twitch chat (set <code class="wordle-page__code">TWITCH_CHANNEL</code> in
      production). The embed is visual only until IRC is enabled.
    </p>
    <p class="wordle-page__meta">
      WS: {{ wsStatus }} · Round #{{ gameState?.gameId?.slice(0, 8) ?? '…' }}
    </p>
    <div class="wordle-page__channel-bar">
      <p class="wordle-page__channel-line">
        <span v-if="twitchChannelSource === 'demo'" class="wordle-page__demo-pill">Demo mode</span>
        Embed chat:
        <strong>{{ effectiveTwitchChannel }}</strong>
        <span class="wordle-page__channel-tag">({{ twitchChannelSourceLabel }})</span>
      </p>
      <div class="wordle-page__channel-actions">
        <button type="button" class="wordle-page__btn wordle-page__btn--ghost" @click="openChannelEditor">
          Change
        </button>
        <button
          v-if="twitchChannelSource === 'saved'"
          type="button"
          class="wordle-page__btn wordle-page__btn--ghost"
          @click="clearSavedTwitchChannel"
        >
          Clear saved
        </button>
      </div>
    </div>
    <div v-if="channelEditorOpen" class="wordle-page__channel-form">
      <label class="wordle-page__channel-label" for="wordle-ch-input">Twitch channel</label>
      <div class="wordle-page__channel-fields">
        <input
          id="wordle-ch-input"
          v-model="channelDraft"
          class="wordle-page__input wordle-page__input--channel"
          type="text"
          maxlength="25"
          autocomplete="off"
          placeholder="channel_login"
          @keydown.enter.prevent="applyTwitchChannel"
        />
        <button type="button" class="wordle-page__btn wordle-page__btn--accent" @click="applyTwitchChannel">
          Connect
        </button>
        <button type="button" class="wordle-page__btn wordle-page__btn--ghost" @click="closeChannelEditor">
          Cancel
        </button>
      </div>
      <p class="wordle-page__hint wordle-page__hint--channel">
        Share:
        <code class="wordle-page__code">{{ shareWordleUrl }}</code>
      </p>
    </div>
    <p v-if="wordlePublicConfigStatus === 'ok' && serverIngestChannel" class="wordle-page__channels-sync">
      <span>Chat embed: <strong>{{ effectiveTwitchChannel }}</strong></span>
      <span class="wordle-page__channels-sync-sep">·</span>
      <span>
        Server IRC:
        <strong>{{ serverIngestChannel }}</strong>
        <span v-if="!channelMismatch" class="wordle-page__sync-ok">match</span>
      </span>
    </p>
    <p v-else-if="wordlePublicConfigStatus === 'error'" class="wordle-page__hint wordle-page__hint--irc">
      Could not load server channel config — check API <code class="wordle-page__code">/api/wordle/public-config</code>.
    </p>
    <p v-if="wsStatus === 'closed' || wsStatus === 'error'" class="wordle-page__hint wordle-page__hint--ws">
      If WebSocket stays closed: run the client with Vite dev (proxy /wordle-ws → API) or set
      VITE_WORDLE_WS_URL in production.
    </p>

    <div class="wordle-page__grid">
      <aside class="wordle-page__panel wordle-page__panel--leader">
        <h2>Leaderboard</h2>
        <ol class="wordle-page__leader">
          <li v-for="e in leaderboard" :key="e.userId" class="wordle-page__leader-row">
            <span class="wordle-page__pos">{{ e.position }}</span>
            <span class="wordle-page__who">{{ e.displayName }}</span>
            <span class="wordle-page__stat">{{ e.attempts }} tries</span>
            <span v-if="e.guessed" class="wordle-page__badge">✓</span>
          </li>
        </ol>
      </aside>

      <main class="wordle-page__panel wordle-page__panel--board">
        <div class="wordle-page__board-head">
          <h2>Board</h2>
          <span v-if="gameState">Word length: {{ gameState.wordLength }}</span>
          <button
            v-if="adminRouteConfigured"
            type="button"
            class="wordle-page__btn wordle-page__btn--accent"
            :disabled="!isAdmin"
            :title="isAdmin ? '' : 'Sign in with the Twitch account matching TWITCH_ADMIN_USER_ID'"
            @click="nextWord"
          >
            Next word
          </button>
          <span v-else class="wordle-page__admin-hint">Next word: set TWITCH_ADMIN_USER_ID on the server.</span>
        </div>

        <div v-if="!gameState" class="wordle-page__empty">Connecting…</div>
        <div v-else class="wordle-page__players">
          <section v-for="pl in sortedPlayers" :key="pl.userId" class="wordle-page__player">
            <header class="wordle-page__player-head">
              <strong>{{ pl.displayName }}</strong>
              <span>{{ pl.attempts }} / 6 · {{ pl.guessed ? 'Solved' : 'Playing' }}</span>
            </header>
            <div class="wordle-page__rows">
              <div
                v-for="(row, ri) in pl.rows"
                :key="`${gameState?.gameId}-${pl.userId}-${ri}-${row.guess}`"
                class="wordle-page__row"
              >
                <span
                  v-for="(ch, ci) in [...row.guess]"
                  :key="ci"
                  class="wordle-page__cell wordle-page__cell--reveal"
                  :data-f="row.feedback[ci]"
                  :style="{ animationDelay: `${ci * 0.18}s` }"
                >
                  {{ ch }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <form class="wordle-page__form" @submit.prevent="submitGuess">
          <input
            v-model="guessInput"
            class="wordle-page__input"
            type="text"
            :maxlength="gameState?.wordLength ?? 32"
            :placeholder="sessionUser ? 'Type guess + Enter (optional)' : 'Log in to guess from web'"
            :disabled="!sessionUser || !gameState"
            autocomplete="off"
          />
          <button
            type="submit"
            class="wordle-page__btn"
            :disabled="!sessionUser || !gameState || !guessInput.trim()"
          >
            Send
          </button>
        </form>
      </main>

      <aside class="wordle-page__panel wordle-page__panel--chat">
        <h2 class="wordle-page__chat-title">Twitch</h2>
        <p class="wordle-page__cooldown-hint">
          IRC guess cooldown: <strong>{{ ircCooldownSecondsLabel }}s</strong> per chatter
        </p>
        <div class="wordle-page__iframe-wrap">
          <iframe
            :key="effectiveTwitchChannel"
            :src="chatIframeSrc"
            title="Twitch chat"
            class="wordle-page__iframe"
          />
        </div>
        <p class="wordle-page__hint wordle-page__hint--embed">
          Twitch embed must allow parent: {{ chatEmbedParentHost }}
        </p>
        <h3 class="wordle-page__h3">Guess highlights</h3>
        <ul class="wordle-page__relay">
          <li
            v-for="(c, i) in chatLines.slice(-40)"
            :key="i"
            class="wordle-page__relay-line"
            :data-h="c.validGuess"
            :data-rl="c.rateLimited === true"
          >
            <strong>{{ c.displayName }}:</strong> {{ c.text }}
            <span v-if="c.validGuess && c.guessFeedback?.length" class="wordle-page__relay-emojis">{{
              feedbackToEmojis(c.guessFeedback)
            }}</span>
            <span v-if="c.rateLimited" class="wordle-page__relay-tag">{{
              formatCooldownHint(c.cooldownMs ?? wordlePublicConfig?.chatGuessCooldownMs ?? 1500)
            }}</span>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.wordle-page {
  min-height: 100vh;
  padding: 1rem 1.25rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.wordle-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.wordle-page__title {
  margin: 0;
  font-size: 1.35rem;
  color: var(--text-h);
}

.wordle-page__sub {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text);
}

.wordle-page__auth {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.wordle-page__link {
  color: var(--accent);
  text-decoration: none;
  margin-right: 0.5rem;
}

.wordle-page__avatar {
  border-radius: 50%;
  vertical-align: middle;
}

.wordle-page__name {
  font-size: 0.95rem;
  color: var(--text-h);
}

.wordle-page__btn {
  font: inherit;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text-h);
  cursor: pointer;
}

.wordle-page__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wordle-page__btn--accent {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--text-h);
}

.wordle-page__btn--ghost {
  background: transparent;
}

.wordle-page__hint {
  font-size: 0.85rem;
  color: var(--text);
}

.wordle-page__hint--ws {
  margin: -0.5rem 0 1rem;
}

.wordle-page__hint--irc {
  margin: 0 0 1rem;
  font-size: 0.78rem;
}

.wordle-page__hint--embed {
  margin-top: 0.35rem;
  font-size: 0.75rem;
}

.wordle-page__banner {
  margin: 0 0 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--text-h);
  font-size: 0.9rem;
}

.wordle-page__banner--warn {
  background: rgba(234, 179, 8, 0.12);
  border-color: rgba(202, 138, 4, 0.45);
}

.wordle-page__demo-pill {
  display: inline-block;
  margin-right: 0.45rem;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--text-h);
  vertical-align: middle;
}

.wordle-page__channels-sync {
  margin: 0 0 0.65rem;
  font-size: 0.85rem;
  color: var(--text);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}

.wordle-page__channels-sync-sep {
  color: var(--border);
}

.wordle-page__sync-ok {
  margin-left: 0.35rem;
  font-size: 0.75rem;
  color: #22c55e;
  font-weight: 600;
}

.wordle-page__chat-title {
  margin: 0 0 0.25rem;
}

.wordle-page__cooldown-hint {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: var(--text);
}

.wordle-page__meta {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--text);
  font-family: var(--mono);
}

.wordle-page__channel-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin: 0 0 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--social-bg);
}

.wordle-page__channel-line {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-h);
}

.wordle-page__channel-tag {
  margin-left: 0.25rem;
  font-size: 0.8rem;
  color: var(--text);
  font-weight: normal;
}

.wordle-page__channel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.wordle-page__channel-form {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
}

.wordle-page__channel-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-h);
}

.wordle-page__channel-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.wordle-page__input--channel {
  min-width: 10rem;
  max-width: 16rem;
}

.wordle-page__hint--channel {
  margin: 0.5rem 0 0;
  word-break: break-all;
}

.wordle-page__code {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--text-h);
}

.wordle-page__grid {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(280px, 2fr) minmax(220px, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (max-width: 960px) {
  .wordle-page__grid {
    grid-template-columns: 1fr;
  }
}

.wordle-page__panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: var(--social-bg);
}

.wordle-page__panel h2 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--text-h);
}

.wordle-page__leader {
  list-style: none;
  margin: 0;
  padding: 0;
}

.wordle-page__leader-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 0.35rem 0.5rem;
  align-items: center;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.wordle-page__pos {
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.wordle-page__who {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-h);
}

.wordle-page__stat {
  font-size: 0.8rem;
  color: var(--text);
}

.wordle-page__badge {
  color: #22c55e;
}

.wordle-page__board-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.wordle-page__board-head h2 {
  margin: 0;
}

.wordle-page__empty {
  padding: 2rem;
  text-align: center;
  color: var(--text);
}

.wordle-page__players {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.wordle-page__player-head {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
  color: var(--text);
}

.wordle-page__rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.wordle-page__row {
  display: flex;
  gap: 0.25rem;
  perspective: 420px;
}

.wordle-page__cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.wordle-page__cell--reveal {
  opacity: 0;
  transform: rotateX(-90deg);
  animation: wordle-tile-reveal 0.42s ease forwards;
  animation-fill-mode: backwards;
}

@keyframes wordle-tile-reveal {
  from {
    opacity: 0.35;
    transform: rotateX(-90deg);
  }
  to {
    opacity: 1;
    transform: rotateX(0);
  }
}

.wordle-page__cell[data-f='correct'] {
  background: #22c55e;
  border-color: #16a34a;
  color: #fff;
}

.wordle-page__cell[data-f='present'] {
  background: #eab308;
  border-color: #ca8a04;
  color: #1a1a1a;
}

.wordle-page__cell[data-f='absent'] {
  background: #374151;
  border-color: #1f2937;
  color: #f9fafb;
}

.wordle-page__relay-emojis {
  margin-left: 0.35rem;
  letter-spacing: 0.08em;
  font-size: 0.85rem;
}

@media (prefers-reduced-motion: reduce) {
  .wordle-page__cell--reveal {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

.wordle-page__form {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.wordle-page__input {
  flex: 1;
  font: inherit;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
}

.wordle-page__iframe-wrap {
  height: 420px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  margin-bottom: 0.75rem;
}

.wordle-page__iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.wordle-page__h3 {
  margin: 0.5rem 0 0.35rem;
  font-size: 0.85rem;
  color: var(--text-h);
}

.wordle-page__relay {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow: auto;
  font-size: 0.8rem;
}

.wordle-page__relay-line {
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.wordle-page__relay-line[data-h='true'] {
  background: var(--accent-bg);
  color: var(--text-h);
  margin: 0 -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.wordle-page__relay-line[data-rl='true'] {
  opacity: 0.75;
}

.wordle-page__relay-tag {
  margin-left: 0.35rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--text);
}

.wordle-page__admin-hint {
  font-size: 0.85rem;
  color: var(--text);
  max-width: 14rem;
}
</style>
