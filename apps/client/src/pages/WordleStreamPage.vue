<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppContainer from '@/components/ui/AppContainer.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import {
  MAX_ATTEMPTS,
  WORD_LENGTH_OPTIONS,
  computeFeedback,
  isAllowedGuess,
  normalizeWord,
  randomWord,
  type Feedback,
  type LocalGuessRow,
  type WordLength,
} from '@/wordle/wordleLogic'
import { apiUrl, sameOriginApiPrefix } from '@/utils/apiUrl'
import { useAuth } from '@/composables/useAuth'
import { replyJsonPingIfNeeded } from 'call-core'

const WORDLE_WORD_LEN_KEY = 'streamassist_wordle_word_len'
const WORDLE_LOCAL_STATS_KEY = 'streamassist_wordle_local_stats'
const DEMO_TWITCH_CHANNEL = STREAMER_NICK

/** Ланцюг висоти як у `sa-call-route` — див. `style.css` (`html.sa-wordle-route`). */
const WORDLE_ROUTE_HTML_CLASS = 'sa-wordle-route'

type LocalWinStats = { won: number; lost: number }

type WordlePublicConfig = {
  ingestChannel: string | null
  chatGuessCooldownMs: number
}

function loadWordLength(scope: string): WordLength {
  try {
    const n = Number(localStorage.getItem(`${WORDLE_WORD_LEN_KEY}:${scope}`))
    if (n === 5 || n === 6 || n === 7) {
      return n
    }
  } catch {
    /* ignore */
  }
  return 5
}

function persistWordLength(scope: string, len: WordLength): void {
  try {
    localStorage.setItem(`${WORDLE_WORD_LEN_KEY}:${scope}`, String(len))
  } catch {
    /* ignore */
  }
}

function loadLocalStats(scope: string): LocalWinStats {
  try {
    const raw = localStorage.getItem(`${WORDLE_LOCAL_STATS_KEY}:${scope}`)
    if (!raw) {
      return { won: 0, lost: 0 }
    }
    const o = JSON.parse(raw) as { won?: unknown; lost?: unknown }
    return {
      won: typeof o.won === 'number' && Number.isFinite(o.won) ? o.won : 0,
      lost: typeof o.lost === 'number' && Number.isFinite(o.lost) ? o.lost : 0,
    }
  } catch {
    return { won: 0, lost: 0 }
  }
}

function persistLocalStats(scope: string, s: LocalWinStats): void {
  try {
    localStorage.setItem(`${WORDLE_LOCAL_STATS_KEY}:${scope}`, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

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

const route = useRoute()
const { t, locale } = useI18n()
const { isAuthenticated, user, isAdmin, ensureAuthLoaded } = useAuth()

/**
 * URL `/wordle/:name` targets a streamer room; if the signed-in user has a linked `Streamer` row,
 * their own room (chat + `streamerId`) is always used.
 */
const effectiveWordleSlug = computed((): string | null => {
  const u = user.value
  const fromAccount =
    u && typeof u.wordleStreamerName === 'string' ? normalizeTwitchLogin(u.wordleStreamerName) : null
  if (fromAccount) {
    return fromAccount
  }
  return normalizeTwitchLogin(String(route.params.streamer || ''))
})

/** Per-streamer local prefs (effective slug). */
const wordleStorageScope = computed(() => effectiveWordleSlug.value || 'default')

const wordlePublicConfig = shallowRef<WordlePublicConfig | null>(null)

type StreamerCard = {
  id: string
  twitchId: string
  username: string
  isActive: boolean
}

const streamerProfile = shallowRef<StreamerCard | null>(null)
const streamerLoadError = ref<string | null>(null)

async function loadStreamerCard(): Promise<void> {
  streamerLoadError.value = null
  const slug = effectiveWordleSlug.value
  if (!slug) {
    streamerProfile.value = null
    streamerLoadError.value = 'Invalid streamer'
    return
  }
  try {
    const res = await fetch(apiUrl(`/api/streamer/${encodeURIComponent(slug)}`))
    if (!res.ok) {
      streamerProfile.value = null
      streamerLoadError.value = res.status === 404 ? 'Streamer not found' : 'Failed to load streamer'
      return
    }
    streamerProfile.value = (await res.json()) as StreamerCard
    streamerLoadError.value = null
  } catch {
    streamerProfile.value = null
    streamerLoadError.value = 'Network error'
  }
}

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
  /** Stable key for list rendering */
  _cid: number
  userId: string
  displayName: string
  text: string
  validGuess: boolean
  rateLimited?: boolean
  cooldownMs?: number
  guessFeedback?: Feedback[]
}

/** Must match `apps/server/src/wordle/wsProtocol.ts` (WordleWs). */
const Ws = {
  state: 'wordle:state',
  leaderboard: 'wordle:leaderboard',
  userGuess: 'wordle:user-guess',
  newGame: 'wordle:new-game',
  twitchChat: 'wordle:twitch-chat',
  ircStatus: 'wordle:irc-status',
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

type WordleGlobalWinsRow = {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  wins: number
}

type WordleGlobalStreakRow = {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  streak: number
}

type WordleGlobalRatingRow = {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  rating: number
  wins: number
  losses: number
}

const gameState = shallowRef<GameStatePayload | null>(null)
const leaderboard = ref<LeaderboardEntry[]>([])
const chatLines = ref<ChatLine[]>([])
const sessionUser = shallowRef<SessionUser | null>(null)
const guessInput = ref('')
const wsStatus = ref<'idle' | 'open' | 'closed' | 'error'>('idle')
/** Twitch IRC ingest on the server (independent of this browser WebSocket). */
const ircRelayStatus = ref<'idle' | 'connected' | 'disconnected' | 'reconnecting' | 'connecting' | 'error'>('idle')
const lastError = ref<string | null>(null)

let ws: WebSocket | null = null
let wordleWsDisposed = false
let wordleWsReconnectTimer: ReturnType<typeof setTimeout> | null = null

function clearWordleWsReconnect(): void {
  if (wordleWsReconnectTimer !== null) {
    clearTimeout(wordleWsReconnectTimer)
    wordleWsReconnectTimer = null
  }
}

function scheduleWordleWsReconnect(): void {
  clearWordleWsReconnect()
  if (wordleWsDisposed) {
    return
  }
  wordleWsReconnectTimer = setTimeout(() => {
    wordleWsReconnectTimer = null
    if (wordleWsDisposed) {
      return
    }
    console.warn('[WS] disconnected, reconnecting...')
    connectWs()
  }, 1000)
}

/** Twitch channel login for this streamer room (from API; URL slug while loading). */
const effectiveTwitchChannel = computed(() => {
  const fromApi = streamerProfile.value?.username
  if (typeof fromApi === 'string' && fromApi.length > 0) {
    return fromApi.toLowerCase()
  }
  return effectiveWordleSlug.value ?? DEMO_TWITCH_CHANNEL
})

function formatCooldownHint(ms: number): string {
  const s = ms / 1000
  const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
  return t('wordleUi.cooldownHint', { seconds: label })
}

function feedbackToEmojis(fb: Feedback[]): string {
  return fb
    .map((f) => (f === 'correct' ? '🟩' : f === 'present' ? '🟨' : '⬛'))
    .join(' ')
}

/** Unique per page load / tab — never from localStorage (avoids WS / UI collisions across tabs). */
const wordleTabPeerId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`

async function fetchWordlePublicConfig(): Promise<void> {
  const id = streamerProfile.value?.id
  if (!id) {
    wordlePublicConfig.value = null
    return
  }
  try {
    const res = await fetch(apiUrl(`/api/wordle/public-config?streamerId=${encodeURIComponent(id)}`))
    if (!res.ok) {
      return
    }
    const j = (await res.json()) as WordlePublicConfig
    if (typeof j.chatGuessCooldownMs !== 'number' || !Number.isFinite(j.chatGuessCooldownMs)) {
      return
    }
    wordlePublicConfig.value = {
      ingestChannel: typeof j.ingestChannel === 'string' ? j.ingestChannel : null,
      chatGuessCooldownMs: j.chatGuessCooldownMs,
    }
  } catch {
    wordlePublicConfig.value = null
  }
}

function wordleWsUrl(streamerId: string): string {
  const env = import.meta.env.VITE_WORDLE_WS_URL as string | undefined
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (typeof env === 'string' && env.trim().length > 0) {
    const u = new URL(env.trim())
    u.searchParams.set('streamerId', streamerId)
    u.searchParams.set('peerId', wordleTabPeerId)
    u.protocol = proto
    return u.toString()
  }
  const prefix = sameOriginApiPrefix()
  if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
    const u = new URL('/wordle-ws', prefix.endsWith('/') ? prefix : `${prefix}/`)
    u.protocol = proto
    u.searchParams.set('streamerId', streamerId)
    u.searchParams.set('peerId', wordleTabPeerId)
    return u.toString()
  }
  const path = prefix ? `${prefix}/wordle-ws` : '/wordle-ws'
  const q = new URLSearchParams({ streamerId, peerId: wordleTabPeerId }).toString()
  return `${proto}//${location.host}${path}?${q}`
}

const twitchWatchUrl = computed(
  () => `https://www.twitch.tv/${encodeURIComponent(effectiveTwitchChannel.value)}`,
)

let chatLineUid = 0
const chatFeedEl = ref<HTMLElement | null>(null)

function chatAvatarInitial(displayName: string): string {
  const s = displayName.trim()
  if (!s) {
    return '?'
  }
  const first = [...s][0]
  return first ? first.toUpperCase() : '?'
}

function scrollChatToBottom(): void {
  const el = chatFeedEl.value
  if (!el) {
    return
  }
  el.scrollTop = el.scrollHeight
}

const wsStatusLabel = computed(() => {
  void locale.value
  switch (wsStatus.value) {
    case 'open':
      return t('wordleUi.chatWsOpen')
    case 'closed':
      return t('wordleUi.chatWsClosed')
    case 'error':
      return t('wordleUi.chatWsError')
    default:
      return t('wordleUi.chatWsIdle')
  }
})

const ircRelayBanner = computed(() => {
  void locale.value
  switch (ircRelayStatus.value) {
    case 'reconnecting':
      return t('wordleUi.chatIrcReconnecting')
    case 'disconnected':
      return t('wordleUi.chatIrcDisconnected')
    case 'connecting':
      return t('wordleUi.chatIrcConnecting')
    case 'error':
      return t('wordleUi.chatIrcError')
    default:
      return ''
  }
})

watch(
  () => streamerProfile.value?.id,
  (id, prev) => {
    if (prev !== undefined && id !== prev) {
      chatLines.value = []
      ircRelayStatus.value = 'idle'
    }
  },
)

/** Локальна гра (український Wordle); співпадає з MAX_ATTEMPTS у wordleLogic. */
const WORDLE_MAX_ATTEMPTS = MAX_ATTEMPTS

/** Екранна клавіатура: стандартний український JCUKEN-порядок (Windows/PC). */
const KBD_ROW1 = ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ї'] as const
const KBD_ROW2 = ['Ф', 'І', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Є'] as const
const KBD_ROW3 = ['Ґ', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю'] as const

const CONFETTI_PIECES = 32

function confettiStyle(i: number): Record<string, string> {
  const seed = i * 1103
  const cx = `${((seed % 160) - 80).toFixed(0)}px`
  const dx = `${(((seed * 7) % 200) - 100).toFixed(0)}px`
  const hue = String((seed * 13) % 360)
  const delay = `${((i * 17) % 450) / 1000}s`
  const dur = `${1.4 + ((seed % 80) / 100)}s`
  return {
    '--cf-cx': cx,
    '--cf-dx': dx,
    '--cf-hue': hue,
    '--cf-delay': delay,
    '--cf-dur': dur,
  }
}

const guessFieldId = 'wordle-guess-sr'

const wordLength = ref<WordLength>(5)
const secretWord = ref(randomWord(5))
const localGuesses = ref<LocalGuessRow[]>([])
const gameStatus = ref<'playing' | 'won' | 'lost'>('playing')
const localRoundId = ref(0)
/** Уникає повторного POST /api/wins за один локальний раунд (скидання з `localRoundId`). */
const soloLbPosted = ref(false)
const localStats = ref<LocalWinStats>({ won: 0, lost: 0 })
/** Для стріму: тимчасово показати загадане слово. */
const secretPeekVisible = ref(false)

watch(localRoundId, () => {
  soloLbPosted.value = false
})

/** Довжина слова для підказки в чаті: з WS-стану раунду (як на сервері для Twitch), інакше локальна сітка. */
const chatTargetWordLength = computed(() => {
  const ws = gameState.value?.wordLength
  if (typeof ws === 'number' && Number.isFinite(ws) && ws > 0) {
    return Math.min(32, Math.max(1, Math.round(ws)))
  }
  return wordLength.value
})

watch(
  () => effectiveWordleSlug.value || 'default',
  async (scope) => {
    const len = loadWordLength(scope)
    wordLength.value = len
    secretWord.value = randomWord(len)
    localGuesses.value = []
    guessInput.value = ''
    gameStatus.value = 'playing'
    localStats.value = loadLocalStats(scope)
    localRoundId.value += 1
    await loadStreamerCard()
    void fetchWordlePublicConfig()
    connectWs()
  },
  { immediate: true },
)

const localBoardLocked = computed(
  () => gameStatus.value !== 'playing' || localGuesses.value.length >= MAX_ATTEMPTS,
)

/** Ім’я в блоці «ви»: спочатку з WS (сесія стріму), інакше з глобального auth — без зайвого GET /api/wordle/me. */
const leaderboardSelfName = computed(() => {
  void locale.value
  const wsUser = sessionUser.value
  if (wsUser?.display_name) {
    return wsUser.display_name
  }
  const u = user.value
  if (u?.displayName) {
    return u.displayName
  }
  return t('wordleUi.guest')
})

const leaderboardStatusLabel = computed(() => {
  void locale.value
  switch (gameStatus.value) {
    case 'won':
      return t('wordleUi.statusWon')
    case 'lost':
      return t('wordleUi.statusLost')
    default:
      return t('wordleUi.statusPlaying')
  }
})

type BoardCell = {
  letter: string
  feedback: Feedback | null
  /** Відправлений ряд — показуємо кольори фідбеку */
  locked: boolean
  rowIndex: number
  colIndex: number
}

const wordleGridRows = computed((): BoardCell[][] => {
  const len = wordLength.value
  const submitted = localGuesses.value
  const canType = gameStatus.value === 'playing' && submitted.length < MAX_ATTEMPTS
  const draftNorm = canType ? normalizeWord(guessInput.value) : ''
  const draftChars = [...draftNorm].slice(0, len)

  const rows: BoardCell[][] = []
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const cells: BoardCell[] = []
    if (r < submitted.length) {
      const row = submitted[r]!
      const letters = [...row.word]
      for (let c = 0; c < len; c++) {
        cells.push({
          letter: letters[c] ?? '',
          feedback: row.result[c] ?? null,
          locked: true,
          rowIndex: r,
          colIndex: c,
        })
      }
    } else if (r === submitted.length && canType) {
      for (let c = 0; c < len; c++) {
        cells.push({
          letter: draftChars[c] ?? '',
          feedback: null,
          locked: false,
          rowIndex: r,
          colIndex: c,
        })
      }
    } else {
      for (let c = 0; c < len; c++) {
        cells.push({ letter: '', feedback: null, locked: false, rowIndex: r, colIndex: c })
      }
    }
    rows.push(cells)
  }
  return rows
})

/** Найкращий фідбек по літері за раунд (correct > present > absent) — для підсвітки клавіатури. */
const FEEDBACK_RANK: Record<Feedback, number> = {
  absent: 0,
  present: 1,
  correct: 2,
}

const kbdLetterBestFeedback = computed(() => {
  const map = new Map<string, Feedback>()
  for (const row of localGuesses.value) {
    const chars = [...row.word]
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]!
      const fb = row.result[i]!
      const prev = map.get(ch)
      if (prev == null || FEEDBACK_RANK[fb] > FEEDBACK_RANK[prev]) {
        map.set(ch, fb)
      }
    }
  }
  return map
})

function kbdKeyFeedbackModifier(ch: string): string | undefined {
  const fb = kbdLetterBestFeedback.value.get(normalizeWord(ch))
  return fb ? `wordle-page__kbd-key--${fb}` : undefined
}

function connectWs(): void {
  const streamerId = streamerProfile.value?.id
  if (!streamerId || wordleWsDisposed) {
    return
  }
  clearWordleWsReconnect()
  const prev = ws
  if (prev) {
    prev.onopen = null
    prev.onmessage = null
    prev.onerror = null
    prev.onclose = null
    prev.close()
    ws = null
  }
  wsStatus.value = 'idle'
  const url = wordleWsUrl(streamerId)
  const socket = new WebSocket(url)
  ws = socket

  socket.onopen = () => {
    if (ws !== socket) {
      return
    }
    console.log('[WS] connected')
    wsStatus.value = 'open'
  }

  socket.onclose = () => {
    console.log('[WS] closed')
    if (ws === socket) {
      ws = null
      wsStatus.value = 'closed'
    }
    if (!wordleWsDisposed) {
      scheduleWordleWsReconnect()
    }
  }

  socket.onerror = () => {
    if (ws === socket) {
      wsStatus.value = 'error'
    }
  }

  socket.onmessage = (ev) => {
    let data: { type?: string; payload?: unknown }
    try {
      data = JSON.parse(String(ev.data))
    } catch {
      return
    }
    if (replyJsonPingIfNeeded(data, socket)) {
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
    } else if (t === Ws.newGame) {
      void loadGlobalLbActive()
    } else if (t === Ws.session && p && typeof p === 'object') {
      const o = p as { user?: SessionUser | null }
      sessionUser.value = o.user ?? null
    } else if (t === Ws.twitchChat && p && typeof p === 'object') {
      const raw = p as Omit<ChatLine, '_cid'> & { guessFeedback?: Feedback[] }
      const line: ChatLine = {
        ...raw,
        _cid: ++chatLineUid,
      }
      chatLines.value = [...chatLines.value.slice(-250), line]
      void nextTick(() => scrollChatToBottom())
    } else if (t === Ws.ircStatus && p && typeof p === 'object') {
      const st = (p as { status?: unknown }).status
      if (
        st === 'connected' ||
        st === 'disconnected' ||
        st === 'reconnecting' ||
        st === 'connecting' ||
        st === 'error'
      ) {
        ircRelayStatus.value = st
      }
    } else if (t === Ws.error && p && typeof p === 'object') {
      const msg = (p as { message?: string }).message
      lastError.value = typeof msg === 'string' ? msg : 'Error'
    } else if (t === Ws.guessRejected) {
      lastError.value = 'Guess not accepted (wrong length, solved, or max attempts)'
    }
  }
}

/** Після логіну/логауту в шапці — перепідключити WS; user для імені береться з useAuth (/api/auth/me в App). */
watch(isAuthenticated, (auth) => {
  if (!auth) {
    sessionUser.value = null
  }
  connectWs()
})

function kbdAppendLetter(ch: string): void {
  lastError.value = null
  if (localBoardLocked.value) {
    return
  }
  const cur = [...normalizeWord(guessInput.value)]
  if (cur.length >= wordLength.value) {
    return
  }
  guessInput.value = guessInput.value + ch
}

function kbdBackspace(): void {
  if (localBoardLocked.value) {
    return
  }
  const chars = [...guessInput.value]
  chars.pop()
  guessInput.value = chars.join('')
}

async function postSoloRoundToLeaderboard(result: 'win' | 'lose'): Promise<void> {
  if (!isAuthenticated.value || soloLbPosted.value) {
    return
  }
  const streamerId = streamerProfile.value?.id
  if (typeof streamerId !== 'string' || streamerId.length === 0) {
    return
  }
  const attempts = localGuesses.value.length
  if (result === 'win') {
    if (attempts < 1 || attempts > MAX_ATTEMPTS) {
      return
    }
  } else if (attempts !== MAX_ATTEMPTS) {
    return
  }
  soloLbPosted.value = true
  try {
    const res = await fetch(apiUrl('/api/wins'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamerId, result, attempts }),
    })
    if (!res.ok) {
      soloLbPosted.value = false
      return
    }
    void loadGlobalLbActive()
  } catch {
    soloLbPosted.value = false
  }
}

function submitGuess(): void {
  lastError.value = null
  if (gameStatus.value !== 'playing') {
    return
  }
  const guess = normalizeWord(guessInput.value)
  const len = wordLength.value
  if (guess.length !== len) {
    return
  }
  if (!isAllowedGuess(guess, len)) {
    lastError.value = 'Слова немає в словнику.'
    return
  }
  const feedback = computeFeedback(secretWord.value, guess)
  localGuesses.value = [...localGuesses.value, { word: guess, result: feedback }]
  if (guess === secretWord.value) {
    gameStatus.value = 'won'
    secretPeekVisible.value = false
  } else if (localGuesses.value.length >= MAX_ATTEMPTS) {
    gameStatus.value = 'lost'
    secretPeekVisible.value = false
  }
  guessInput.value = ''
}

/** Нове загадане слово тієї ж довжини (після раунду або з кнопки). */
function newRoundSameLength(): void {
  lastError.value = null
  secretPeekVisible.value = false
  secretWord.value = randomWord(wordLength.value)
  localGuesses.value = []
  guessInput.value = ''
  gameStatus.value = 'playing'
  localRoundId.value += 1
}

function setWordLength(len: WordLength): void {
  if (wordLength.value === len) {
    return
  }
  lastError.value = null
  secretPeekVisible.value = false
  wordLength.value = len
  persistWordLength(wordleStorageScope.value, len)
  secretWord.value = randomWord(len)
  localGuesses.value = []
  guessInput.value = ''
  gameStatus.value = 'playing'
  localRoundId.value += 1
}

function toggleSecretPeek(): void {
  secretPeekVisible.value = !secretPeekVisible.value
}

function onWindowKeydown(e: KeyboardEvent): void {
  if (localBoardLocked.value) {
    return
  }
  const el = e.target
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) {
      return
    }
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return
    }
    if (tag === 'A') {
      return
    }
    if (tag === 'BUTTON' && !el.closest('.wordle-page__kbd')) {
      return
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return
  }
  if (e.key === 'Backspace') {
    e.preventDefault()
    kbdBackspace()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    submitGuess()
    return
  }
  if (e.key.length === 1 && /\p{Script=Cyrillic}/u.test(e.key)) {
    e.preventDefault()
    kbdAppendLetter(normalizeWord(e.key))
    return
  }
}

/** WS оновлює стан сервера для майбутнього мультиплеєра; локальна гра їх не читає. */
watch(
  [gameState, leaderboard],
  ([gs, lb]) => {
    void gs
    void lb
  },
  { deep: true },
)

watch(gameStatus, (next, prev) => {
  if (prev !== 'playing') {
    return
  }
  if (next === 'won') {
    const s = { ...localStats.value, won: localStats.value.won + 1 }
    localStats.value = s
    persistLocalStats(wordleStorageScope.value, s)
    void postSoloRoundToLeaderboard('win')
  } else if (next === 'lost') {
    const s = { ...localStats.value, lost: localStats.value.lost + 1 }
    localStats.value = s
    persistLocalStats(wordleStorageScope.value, s)
    void postSoloRoundToLeaderboard('lose')
  }
})

const WORDLE_STREAM_CHAT_ANCHOR_ID = 'wordle-stream-chat-anchor'

function scrollWordleChatIntoView(): void {
  if (typeof document === 'undefined') {
    return
  }
  document.getElementById(WORDLE_STREAM_CHAT_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const globalLbTab = ref<'wins' | 'streak' | 'rating'>('rating')
const globalLbWinsRows = ref<WordleGlobalWinsRow[]>([])
const globalLbStreakRows = ref<WordleGlobalStreakRow[]>([])
const globalLbRatingRows = ref<WordleGlobalRatingRow[]>([])
const globalLbLoading = ref(false)
const globalLbError = ref<string | null>(null)

function globalLbIsSelfRow(entry: { userId: string }): boolean {
  const u = user.value
  if (!u) {
    return false
  }
  if (entry.userId === u.id) {
    return true
  }
  if (u.twitchId && entry.userId === u.twitchId) {
    return true
  }
  return false
}

function globalLbInitials(name: string): string {
  const s = String(name ?? '').trim()
  if (!s) {
    return '?'
  }
  return s[0]!.toUpperCase()
}

function globalLeaderboardQuery(): string {
  const id = streamerProfile.value?.id
  if (typeof id === 'string' && id.length > 0) {
    return `?streamerId=${encodeURIComponent(id)}`
  }
  const slug = effectiveWordleSlug.value
  if (slug) {
    return `?streamer=${encodeURIComponent(slug)}`
  }
  return ''
}

async function loadGlobalLbWins(): Promise<void> {
  globalLbLoading.value = true
  globalLbError.value = null
  try {
    const res = await fetch(apiUrl(`/api/leaderboard/wins${globalLeaderboardQuery()}`), { credentials: 'include' })
    const j = (await res.json()) as { entries?: unknown }
    const list = Array.isArray(j.entries) ? j.entries : []
    globalLbWinsRows.value = list
      .map((raw, i) => {
        const o = raw as Record<string, unknown>
        const rank = typeof o.rank === 'number' ? o.rank : i + 1
        const userId = typeof o.userId === 'string' ? o.userId : ''
        const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—'
        const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null
        const wins = typeof o.wins === 'number' && Number.isFinite(o.wins) ? o.wins : 0
        return { rank, userId, displayName, avatarUrl, wins }
      })
      .filter((r) => r.userId.length > 0)
  } catch {
    globalLbError.value = t('wordleLeaderboard.loadError')
    globalLbWinsRows.value = []
  } finally {
    globalLbLoading.value = false
  }
}

async function loadGlobalLbStreak(): Promise<void> {
  globalLbLoading.value = true
  globalLbError.value = null
  try {
    const res = await fetch(apiUrl(`/api/leaderboard/streak${globalLeaderboardQuery()}`), { credentials: 'include' })
    const j = (await res.json()) as { entries?: unknown }
    const list = Array.isArray(j.entries) ? j.entries : []
    globalLbStreakRows.value = list
      .map((raw, i) => {
        const o = raw as Record<string, unknown>
        const rank = typeof o.rank === 'number' ? o.rank : i + 1
        const userId = typeof o.userId === 'string' ? o.userId : ''
        const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—'
        const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null
        const streak = typeof o.streak === 'number' && Number.isFinite(o.streak) ? o.streak : 0
        return { rank, userId, displayName, avatarUrl, streak }
      })
      .filter((r) => r.userId.length > 0)
  } catch {
    globalLbError.value = t('wordleLeaderboard.loadError')
    globalLbStreakRows.value = []
  } finally {
    globalLbLoading.value = false
  }
}

async function loadGlobalLbRating(): Promise<void> {
  globalLbLoading.value = true
  globalLbError.value = null
  try {
    const res = await fetch(apiUrl(`/api/leaderboard/rating${globalLeaderboardQuery()}`), { credentials: 'include' })
    const j = (await res.json()) as { entries?: unknown }
    const list = Array.isArray(j.entries) ? j.entries : []
    globalLbRatingRows.value = list
      .map((raw, i) => {
        const o = raw as Record<string, unknown>
        const rank = typeof o.rank === 'number' ? o.rank : i + 1
        const userId = typeof o.userId === 'string' ? o.userId : ''
        const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—'
        const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null
        const rating = typeof o.rating === 'number' && Number.isFinite(o.rating) ? o.rating : 0
        const wins = typeof o.wins === 'number' && Number.isFinite(o.wins) ? o.wins : 0
        const losses = typeof o.losses === 'number' && Number.isFinite(o.losses) ? o.losses : 0
        return { rank, userId, displayName, avatarUrl, rating, wins, losses }
      })
      .filter((r) => r.userId.length > 0)
  } catch {
    globalLbError.value = t('wordleLeaderboard.loadError')
    globalLbRatingRows.value = []
  } finally {
    globalLbLoading.value = false
  }
}

async function loadGlobalLbActive(): Promise<void> {
  if (globalLbTab.value === 'wins') {
    await loadGlobalLbWins()
  } else if (globalLbTab.value === 'streak') {
    await loadGlobalLbStreak()
  } else {
    await loadGlobalLbRating()
  }
}

watch(globalLbTab, () => {
  void loadGlobalLbActive()
})

watch(
  () => streamerProfile.value?.id,
  () => {
    void loadGlobalLbActive()
  },
)

const globalLbDisplayRows = computed(
  (): readonly (WordleGlobalWinsRow | WordleGlobalStreakRow | WordleGlobalRatingRow)[] => {
    if (globalLbTab.value === 'wins') {
      return globalLbWinsRows.value
    }
    if (globalLbTab.value === 'streak') {
      return globalLbStreakRows.value
    }
    return globalLbRatingRows.value
  },
)

const globalLbScoreLabel = computed(() => {
  if (globalLbTab.value === 'wins') {
    return t('wordleLeaderboard.scoreWins')
  }
  if (globalLbTab.value === 'streak') {
    return t('wordleLeaderboard.scoreStreak')
  }
  return t('wordleLeaderboard.scoreRating')
})

function globalLbScoreFor(row: WordleGlobalWinsRow | WordleGlobalStreakRow | WordleGlobalRatingRow): number {
  if (globalLbTab.value === 'wins') {
    return (row as WordleGlobalWinsRow).wins
  }
  if (globalLbTab.value === 'streak') {
    return (row as WordleGlobalStreakRow).streak
  }
  return (row as WordleGlobalRatingRow).rating
}

onMounted(() => {
  wordleWsDisposed = false
  document.documentElement.classList.add(WORDLE_ROUTE_HTML_CLASS)
  void ensureAuthLoaded()
  void loadGlobalLbActive()
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  wordleWsDisposed = true
  clearWordleWsReconnect()
  document.documentElement.classList.remove(WORDLE_ROUTE_HTML_CLASS)
  window.removeEventListener('keydown', onWindowKeydown)
  const s = ws
  if (s) {
    s.onopen = null
    s.onmessage = null
    s.onerror = null
    s.onclose = null
    s.close()
  }
  ws = null
})
</script>

<template>
  <div class="page-route">
    <AppContainer
      wide
      flush
      :class="['wordle-page', `wordle-page--len${wordLength}`]"
    >
      <p v-if="streamerLoadError" class="wordle-page__banner wordle-page__banner--error">{{ streamerLoadError }}</p>
      <p v-else-if="lastError" class="wordle-page__banner">{{ lastError }}</p>

      <div class="wordle-page__grid">
        <AppCard class="wordle-page__stack wordle-page__stack--side wordle-page__stack--leader">
          <div class="wordle-page__leader-stack">
            <ol class="wordle-page__leader">
              <li class="wordle-page__leader-row wordle-page__leader-row--solo">
                <span class="wordle-page__who">{{ leaderboardSelfName }}</span>
                <span class="wordle-page__stat">{{
                  t('wordleUi.attemptsLine', { cur: localGuesses.length, max: WORDLE_MAX_ATTEMPTS })
                }}</span>
                <span class="wordle-page__status-pill">{{ leaderboardStatusLabel }}</span>
              </li>
            </ol>

            <section
              class="wordle-page__global-lb"
              :aria-label="t('wordleUi.globalLeaderboard')"
            >
              <h3 class="wordle-page__glb-title">{{ t('wordleUi.globalLeaderboard') }}</h3>
              <div class="wordle-page__glb-tabs" role="tablist" :aria-label="t('wordleLeaderboard.tabsAria')">
                <button
                  type="button"
                  role="tab"
                  class="wordle-page__glb-tab"
                  :class="{ 'wordle-page__glb-tab--active': globalLbTab === 'wins' }"
                  :aria-selected="globalLbTab === 'wins'"
                  @click="globalLbTab = 'wins'"
                >
                  {{ t('wordleLeaderboard.tabWins') }}
                </button>
                <button
                  type="button"
                  role="tab"
                  class="wordle-page__glb-tab"
                  :class="{ 'wordle-page__glb-tab--active': globalLbTab === 'streak' }"
                  :aria-selected="globalLbTab === 'streak'"
                  @click="globalLbTab = 'streak'"
                >
                  {{ t('wordleLeaderboard.tabStreak') }}
                </button>
                <button
                  type="button"
                  role="tab"
                  class="wordle-page__glb-tab"
                  :class="{ 'wordle-page__glb-tab--active': globalLbTab === 'rating' }"
                  :aria-selected="globalLbTab === 'rating'"
                  @click="globalLbTab = 'rating'"
                >
                  {{ t('wordleLeaderboard.tabRating') }}
                </button>
              </div>

              <p v-if="globalLbError" class="wordle-page__glb-banner" role="alert">{{ globalLbError }}</p>
              <p v-else-if="globalLbLoading" class="wordle-page__glb-muted">{{ t('wordleLeaderboard.loading') }}</p>
              <div v-else-if="globalLbDisplayRows.length === 0" class="wordle-page__glb-empty">
                <div class="wordle-page__glb-podium" aria-hidden="true">
                  <span class="wordle-page__glb-podium-step">1</span>
                  <span class="wordle-page__glb-podium-step">2</span>
                  <span class="wordle-page__glb-podium-step">3</span>
                </div>
                <p class="wordle-page__glb-muted wordle-page__glb-muted--empty">{{ t('wordleLeaderboard.empty') }}</p>
              </div>
              <div v-else class="wordle-page__glb-scroll">
                <table class="wordle-page__glb-table" :aria-label="globalLbScoreLabel">
                  <thead>
                    <tr>
                      <th scope="col" class="wordle-page__glb-th wordle-page__glb-th--rank">{{
                        t('wordleLeaderboard.colRank')
                      }}</th>
                      <th scope="col" class="wordle-page__glb-th">{{ t('wordleLeaderboard.colPlayer') }}</th>
                      <th scope="col" class="wordle-page__glb-th wordle-page__glb-th--score">{{
                        globalLbScoreLabel
                      }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in globalLbDisplayRows"
                      :key="`${globalLbTab}-${row.userId}-${row.rank}`"
                      class="wordle-page__glb-tr"
                      :class="{ 'wordle-page__glb-tr--self': globalLbIsSelfRow(row) }"
                    >
                      <td class="wordle-page__glb-td wordle-page__glb-td--rank">{{ row.rank }}</td>
                      <td class="wordle-page__glb-td wordle-page__glb-td--player">
                        <span class="wordle-page__glb-player">
                          <img
                            v-if="row.avatarUrl"
                            class="wordle-page__glb-avatar"
                            :src="row.avatarUrl"
                            alt=""
                            width="28"
                            height="28"
                            referrerpolicy="no-referrer"
                          />
                          <span
                            v-else
                            class="wordle-page__glb-avatar wordle-page__glb-avatar--ph"
                            aria-hidden="true"
                            >{{ globalLbInitials(row.displayName) }}</span
                          >
                          <span class="wordle-page__glb-name">{{ row.displayName }}</span>
                          <span v-if="globalLbIsSelfRow(row)" class="wordle-page__glb-you">{{
                            t('wordleLeaderboard.you')
                          }}</span>
                        </span>
                      </td>
                      <td class="wordle-page__glb-td wordle-page__glb-td--score">{{
                        globalLbScoreFor(row)
                      }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div
            v-if="gameStatus === 'playing' && isAdmin"
            class="wordle-page__side-tools"
            :aria-label="t('wordleUi.streamToolsAria')"
          >
            <div class="wordle-page__side-tools-row">
              <AppButton type="button" variant="ghost" class="wordle-page__peek-btn wordle-page__side-tool-btn" @click="toggleSecretPeek">
                {{ secretPeekVisible ? t('wordleUi.hideWord') : t('wordleUi.showWord') }}
              </AppButton>
            </div>
            <p v-if="secretPeekVisible" class="wordle-page__peek-word wordle-page__peek-word--side" aria-live="polite">
              {{ secretWord }}
            </p>
          </div>

        </AppCard>

        <AppCard class="wordle-page__stack wordle-page__stack--game">
          <div class="wordle-page__game" :style="{ '--wordle-len': String(wordLength) }">
            <div
              class="wordle-page__wordle-board"
              :style="{ '--wordle-len': String(wordLength) }"
              role="grid"
              :aria-rowcount="WORDLE_MAX_ATTEMPTS"
              :aria-colcount="wordLength"
            >
              <div
                v-for="(row, ri) in wordleGridRows"
                :key="`local-${localRoundId}-r-${ri}`"
                class="wordle-page__row wordle-page__row--tile"
                role="row"
              >
                <span
                  v-for="cell in row"
                  :key="`tile-${localRoundId}-${cell.rowIndex}-${cell.colIndex}`"
                  class="wordle-page__cell wordle-page__cell--tile"
                  :class="{
                    'wordle-page__cell--empty': !cell.locked && !cell.letter,
                    'wordle-page__cell--draft': !cell.locked && Boolean(cell.letter),
                  }"
                  :data-f="cell.feedback ?? undefined"
                  role="gridcell"
                >
                  {{ cell.letter }}
                </span>
              </div>
            </div>

            <div
              v-if="gameStatus === 'won'"
              :key="`win-${localRoundId}`"
              class="wordle-page__game-panel-width wordle-page__celebrate"
              aria-live="polite"
            >
              <div class="wordle-page__confetti" aria-hidden="true">
                <span
                  v-for="n in CONFETTI_PIECES"
                  :key="`cf-${localRoundId}-${n}`"
                  class="wordle-page__confetti-bit"
                  :style="confettiStyle(n)"
                />
              </div>
              <p class="wordle-page__celebrate-title">{{ t('wordleUi.celebrateTitle') }}</p>
              <AppButton variant="primary" type="button" class="wordle-page__celebrate-btn" @click="newRoundSameLength">
                {{ t('wordleUi.newWord') }}
              </AppButton>
            </div>

            <div
              v-else-if="gameStatus === 'lost'"
              class="wordle-page__game-panel-width wordle-page__end-panel wordle-page__end-panel--lost"
            >
              <p class="wordle-page__end-panel-text">
                {{ t('wordleUi.lostWasWord') }} <strong class="wordle-page__secret">{{ secretWord }}</strong>
              </p>
              <AppButton variant="primary" type="button" @click="newRoundSameLength">{{
                t('wordleUi.newWord')
              }}</AppButton>
            </div>

            <div
              v-if="gameStatus === 'playing'"
              class="wordle-page__kbd"
              :style="{ '--wordle-len': String(wordLength) }"
              :aria-label="t('wordleUi.screenKeyboardAria')"
            >
              <div class="wordle-page__kbd-inner">
                <div class="wordle-page__kbd-main">
                  <div class="wordle-page__kbd-row">
                    <AppButton
                      v-for="ch in KBD_ROW1"
                      :key="ch"
                      type="button"
                      variant="ghost"
                      class="wordle-page__kbd-key"
                      :class="kbdKeyFeedbackModifier(ch)"
                      :disabled="localBoardLocked"
                      @click="kbdAppendLetter(ch)"
                    >
                      {{ ch }}
                    </AppButton>
                  </div>
                  <div class="wordle-page__kbd-row wordle-page__kbd-row--mid">
                    <AppButton
                      v-for="ch in KBD_ROW2"
                      :key="ch"
                      type="button"
                      variant="ghost"
                      class="wordle-page__kbd-key"
                      :class="kbdKeyFeedbackModifier(ch)"
                      :disabled="localBoardLocked"
                      @click="kbdAppendLetter(ch)"
                    >
                      {{ ch }}
                    </AppButton>
                  </div>
                  <div class="wordle-page__kbd-row">
                    <AppButton
                      v-for="ch in KBD_ROW3"
                      :key="ch"
                      type="button"
                      variant="ghost"
                      class="wordle-page__kbd-key"
                      :class="kbdKeyFeedbackModifier(ch)"
                      :disabled="localBoardLocked"
                      @click="kbdAppendLetter(ch)"
                    >
                      {{ ch }}
                    </AppButton>
                  </div>
                </div>
              </div>
              <div
                class="wordle-page__kbd-row wordle-page__kbd-row--actions"
                role="group"
                :aria-label="t('wordleUi.kbdToolbarAria')"
              >
                <AppButton
                  type="button"
                  variant="secondary"
                  class="wordle-page__kbd-action wordle-page__kbd-side-action"
                  :disabled="localBoardLocked || normalizeWord(guessInput).length !== wordLength"
                  @click="submitGuess"
                >
                  {{ t('wordleUi.enter') }}
                </AppButton>
                <AppButton
                  v-for="n in WORD_LENGTH_OPTIONS"
                  :key="n"
                  type="button"
                  :variant="wordLength === n ? 'primary' : 'ghost'"
                  class="wordle-page__len-btn wordle-page__len-btn--kbd"
                  @click="setWordLength(n)"
                >
                  {{ n }}
                </AppButton>
                <AppButton
                  type="button"
                  variant="ghost"
                  class="wordle-page__kbd-action wordle-page__kbd-side-action"
                  :disabled="localBoardLocked"
                  @click="kbdBackspace"
                >
                  ⌫
                </AppButton>
              </div>
            </div>

            <form class="wordle-page__sr-form" @submit.prevent="submitGuess">
              <label class="wordle-page__sr-only" :for="guessFieldId">{{ t('wordleUi.guessLabel') }}</label>
              <input
                :id="guessFieldId"
                v-model="guessInput"
                class="wordle-page__sr-only"
                type="text"
                inputmode="text"
                autocapitalize="off"
                spellcheck="false"
                :maxlength="wordLength"
                :disabled="localBoardLocked"
                autocomplete="off"
                lang="uk"
              />
            </form>

          </div>
        </AppCard>

        <div class="wordle-page__chat-mobile-trigger">
          <AppButton type="button" variant="secondary" @click="scrollWordleChatIntoView">
            {{ t('wordleUi.chatMobileOpen') }}
          </AppButton>
        </div>

        <AppCard
          :id="WORDLE_STREAM_CHAT_ANCHOR_ID"
          class="wordle-page__stack wordle-page__stack--side wordle-page__stack--chat"
        >
          <div class="wordle-page__chat-shell">
            <header class="wordle-page__chat-head">
              <div class="wordle-page__chat-head-row">
                <h2 class="wordle-page__chat-title">{{ t('wordleUi.chatTitle') }}</h2>
                <span class="wordle-page__chat-ws-pill" :data-state="wsStatus">{{ wsStatusLabel }}</span>
              </div>
              <p class="wordle-page__chat-len-hint" role="note">
                {{ t('wordleUi.chatGuessLenHint', { n: chatTargetWordLength }) }}
              </p>
              <div class="wordle-page__chat-toolbar">
                <span class="wordle-page__chat-channel-pill">#{{ effectiveTwitchChannel }}</span>
                <a
                  class="wordle-page__chat-external"
                  :href="twitchWatchUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t('wordleUi.chatOpenTwitch') }}
                </a>
              </div>
              <p v-if="ircRelayBanner" class="wordle-page__chat-irc-banner" role="status">{{ ircRelayBanner }}</p>
            </header>
            <div
              ref="chatFeedEl"
              class="wordle-page__chat-feed"
              role="log"
              aria-relevant="additions"
              :aria-label="t('wordleUi.chatRelayAria')"
            >
              <p v-if="chatLines.length === 0" class="wordle-page__chat-empty">
                {{ t('wordleUi.chatEmpty', { channel: effectiveTwitchChannel }) }}
              </p>
              <ul v-else class="wordle-page__chat-lines">
                <li
                  v-for="c in chatLines"
                  :key="c._cid"
                  class="wordle-page__chat-line"
                  :class="{
                    'wordle-page__chat-line--guess': c.validGuess,
                    'wordle-page__chat-line--slow': c.rateLimited === true,
                  }"
                >
                  <span class="wordle-page__chat-avatar" aria-hidden="true">{{ chatAvatarInitial(c.displayName) }}</span>
                  <div class="wordle-page__chat-line-body">
                    <div class="wordle-page__chat-line-meta">
                      <span class="wordle-page__chat-name">{{ c.displayName }}</span>
                      <span v-if="c.validGuess" class="wordle-page__chat-badge">{{ t('wordleUi.chatGuessBadge') }}</span>
                    </div>
                    <p class="wordle-page__chat-text">
                      <span class="wordle-page__chat-text-inner">{{ c.text }}</span>
                      <span
                        v-if="c.validGuess && c.guessFeedback?.length"
                        class="wordle-page__relay-emojis"
                        aria-hidden="true"
                        >{{ feedbackToEmojis(c.guessFeedback) }}</span
                      >
                    </p>
                    <p v-if="c.rateLimited" class="wordle-page__chat-cooldown">
                      {{
                        formatCooldownHint(c.cooldownMs ?? wordlePublicConfig?.chatGuessCooldownMs ?? 1500)
                      }}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </AppCard>
      </div>

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

/* Десктоп-сітка з `min-width: 1201px`; нижче — планшет/мобільна колонка. */
@media (max-width: 1200px) {
  .page-route {
    flex: 0 1 auto;
  }
}

.wordle-page {
  --wordle-cell: 78px;
  --wordle-gap: 10px;
  --wordle-len-css: 5;
  flex: 1 1 auto;
  padding-block: var(--sa-space-2) var(--sa-space-5);
  /* AppContainer `flush` прибирає зовнішній padding — відступи лише тут */
  padding-inline: var(--sa-space-4);
  font-family: var(--sa-font-main);
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: var(--sa-space-2);
  width: 100%;
  max-width: min(56.25rem, 100%);
  margin-inline: auto;
  box-sizing: border-box;
}

.wordle-page--len6 {
  --wordle-cell: 66px;
  --wordle-len-css: 6;
}

.wordle-page--len7 {
  --wordle-cell: 56px;
  --wordle-len-css: 7;
}

.wordle-page__hint {
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
}

.wordle-page__banner {
  margin: 0;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: var(--sa-radius-sm);
  background: var(--sa-color-primary-soft);
  border: 1px solid var(--sa-color-primary-border);
  color: var(--sa-color-text-main);
  font-size: 0.85rem;
}

.wordle-page__banner--warn {
  background: color-mix(in srgb, var(--sa-color-warning) 14%, var(--sa-color-surface));
  border-color: color-mix(in srgb, var(--sa-color-warning) 45%, var(--sa-color-border));
}

.wordle-page__setup {
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.wordle-page__setup summary {
  cursor: pointer;
  color: var(--sa-color-text-main);
  font-weight: 600;
  padding: var(--sa-space-1) 0;
}

.wordle-page__demo-pill {
  display: inline-block;
  margin-right: var(--sa-space-2);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--sa-color-primary-soft);
  border: 1px solid var(--sa-color-primary-border);
  color: var(--sa-color-text-main);
  vertical-align: middle;
}

.wordle-page__channels-sync {
  margin: var(--sa-space-2) 0 0;
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sa-space-1) var(--sa-space-2);
}

.wordle-page__channels-sync-sep {
  color: var(--sa-color-border);
}

.wordle-page__sync-ok {
  margin-left: var(--sa-space-1);
  font-size: 0.7rem;
  color: var(--sa-color-success);
  font-weight: 600;
}

.wordle-page__cooldown-hint {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
}

.wordle-page__channel-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
  margin: var(--sa-space-2) 0;
  padding: var(--sa-space-2) var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-bg-card) 88%, transparent);
}

.wordle-page__channel-line {
  margin: 0;
  font-size: 0.85rem;
  color: var(--sa-color-text-main);
}

.wordle-page__channel-tag {
  margin-left: var(--sa-space-1);
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  font-weight: normal;
}

.wordle-page__channel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-1);
}

.wordle-page__channel-form {
  margin: 0 0 var(--sa-space-3);
  padding: var(--sa-space-3);
  border-radius: var(--sa-radius-md);
  border: 1px solid var(--sa-color-primary-border);
  background: var(--sa-color-primary-soft);
}

.wordle-page__channel-label {
  display: block;
  margin-bottom: var(--sa-space-1);
  font-size: 0.8rem;
  color: var(--sa-color-text-main);
}

.wordle-page__channel-fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sa-space-2);
  align-items: center;
}

.wordle-page__input--channel {
  min-width: 10rem;
  max-width: 16rem;
  font: inherit;
  padding: 0.4rem 0.55rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 90%, transparent);
  color: var(--sa-color-text-main);
}

.wordle-page__hint--channel {
  margin: var(--sa-space-2) 0 0;
  word-break: break-all;
}

.wordle-page__hint--irc,
.wordle-page__hint--ws {
  margin: var(--sa-space-1) 0 0;
  font-size: 0.72rem;
}

.wordle-page__hint--embed {
  margin-top: var(--sa-space-1);
  font-size: 0.7rem;
}

.wordle-page__code {
  font-family: var(--sa-font-mono);
  font-size: 0.72rem;
  color: var(--sa-color-text-main);
}

.wordle-page__chat-mobile-trigger {
  display: none;
  justify-content: center;
  padding: var(--sa-space-1) 0;
  min-width: 0;
}

@media (max-width: 767px) {
  /* Кнопка прокрутки до чату в потоці документа; сам чат більше не fixed-оверлей (не наїжджає на поле/клавіатуру). */
  .wordle-page__chat-mobile-trigger {
    display: flex;
  }
}

.wordle-page__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sa-space-4);
  align-items: stretch;
  /* `minmax(min-content, max-content)` ламав flow на одній колонці (планшет). */
  grid-auto-rows: auto;
}

/* Триколонка: лідерборд/чат не розтягуються ширше за клітинку grid, горизонтальний вміст не «протікає». */
.wordle-page__grid :deep(.wordle-page__stack--leader),
.wordle-page__grid :deep(.wordle-page__stack--chat) {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.wordle-page__grid :deep(.wordle-page__stack--leader) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (min-width: 1201px) {
  /* Одна висота колонок, скрол лише всередині (чат / таблиця), без скролу body. */
  .page-route {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    min-height: 0;
  }

  .wordle-page {
    --wordle-gap: clamp(6px, 1vmin, 10px);
    max-width: min(87.5rem, 100%);
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .wordle-page--len5 {
    --wordle-cell: clamp(40px, min(7.2vmin, 7dvh), 78px);
  }

  .wordle-page--len6 {
    --wordle-cell: clamp(34px, min(6.2vmin, 6.2dvh), 66px);
  }

  .wordle-page--len7 {
    --wordle-cell: clamp(30px, min(5.4vmin, 5.5dvh), 56px);
  }

  .wordle-page__grid {
    align-items: stretch;
    justify-content: center;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    /* Було: боки min 260px + центр minmax(0,720px) — усе стискання «їло» лише центр.
       Співвідношення ~ як колишні max: 300 : 720 : 320 → 15fr : 36fr : 16fr. */
    grid-template-columns:
      minmax(10.25rem, 15fr)
      minmax(18.5rem, 36fr)
      minmax(10.25rem, 16fr);
  }

  .wordle-page__kbd {
    min-width: 0;
  }

  @media (max-height: 820px) {
    .wordle-page__kbd {
      gap: var(--sa-space-1);
    }

    .wordle-page__kbd :deep(.wordle-page__kbd-key) {
      height: 42px;
      min-width: 34px;
      font-size: 14px;
      padding: 0 0.2rem;
    }

    .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
      min-width: 48px;
      max-width: 4rem;
      height: 40px;
      padding: 0 0.22rem;
      font-size: 0.6rem;
    }

    .wordle-page__kbd-row--actions .wordle-page__len-btn--kbd {
      height: 40px;
      min-width: 1.85rem;
      max-width: 2.5rem;
      font-size: 0.78rem;
    }

    .wordle-page__game {
      gap: var(--sa-space-2);
    }
  }
}

/* Мобільний / планшетний стек: одна колонка, скрол сторінки; порядок блоків фіксований. */
@media (max-width: 1200px) {
  .page-route {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .wordle-page {
    flex: 0 1 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    overflow: visible;
    padding-block: var(--sa-space-2) max(var(--sa-space-7), calc(var(--sa-space-5) + env(safe-area-inset-bottom, 0px)));
    max-width: min(68rem, 100%);
  }

  .wordle-page__grid {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    gap: 16px;
  }

  .wordle-page__grid > .wordle-page__stack,
  .wordle-page__grid > .wordle-page__chat-mobile-trigger {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    max-height: none;
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
    overflow-y: visible;
  }

  .wordle-page__grid > .wordle-page__stack--leader {
    order: 1;
  }

  .wordle-page__grid > .wordle-page__stack--game {
    order: 2;
  }

  .wordle-page__grid > .wordle-page__chat-mobile-trigger {
    order: 3;
    display: none;
  }

  .wordle-page__grid > .wordle-page__stack--chat {
    order: 4;
  }

  .wordle-page__grid > .wordle-page__stack--leader {
    flex: 0 0 auto;
    align-self: stretch;
    overflow: visible;
  }

  .wordle-page__game {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    justify-content: flex-start;
    max-width: 100%;
    overflow: visible;
  }

  .wordle-page__stack--leader > .wordle-page__leader-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sa-space-3);
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__stack--chat > .wordle-page__chat-shell {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__grid :deep(.wordle-page__stack) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    flex: 0 0 auto;
    max-height: none;
    scroll-margin-top: var(--sa-space-4);
  }

  .wordle-page__leader-stack .wordle-page__leader {
    flex: 0 0 auto;
    max-height: none;
    overflow: visible;
  }

  .wordle-page__leader-stack {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
    gap: var(--sa-space-3);
  }

  .wordle-page__global-lb {
    flex: 0 0 auto;
    align-items: stretch;
    padding-top: 0;
  }

  .wordle-page__glb-scroll {
    flex: 0 0 auto;
    min-height: auto;
    max-height: none;
    overflow-y: auto;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
    flex: 0 0 auto;
    min-height: auto;
    height: auto;
  }

  .wordle-page__stack--leader > .wordle-page__side-tools {
    flex: 0 0 auto;
    margin: 0;
  }

  .wordle-page__glb-tabs {
    margin-inline: auto;
  }

  .wordle-page__chat-feed {
    flex: 0 0 auto;
    min-height: 12rem;
    height: auto;
  }
}

@media (max-width: 1200px) {
  .wordle-page {
    padding-block: var(--sa-space-2) var(--sa-space-4);
    padding-inline: clamp(0.65rem, 2.8vw, var(--sa-space-3));
    --wordle-gap: clamp(4px, 1.2vw, 8px);
    overflow-x: clip;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game) {
    max-width: 100%;
    overflow: visible;
  }
}

@supports (width: 1cqi) {
  @media (max-width: 1200px) {
    /* Один плавний режим для всіх <=1200px, без окремого "перелому" на 960px. */
    .wordle-page--len5 .wordle-page__game {
      --wordle-cell: min(
        clamp(3rem, 6.6vw, 4.75rem),
        calc((100cqi - (var(--wordle-len-css, 5) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 5))
      );
    }

    .wordle-page--len6 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.5rem, 5.5vw, 4rem),
        calc((100cqi - (var(--wordle-len-css, 6) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 6))
      );
    }

    .wordle-page--len7 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.1rem, 4.7vw, 3.4rem),
        calc((100cqi - (var(--wordle-len-css, 7) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 7))
      );
    }
  }
}

@supports not (width: 1cqi) {
  @media (max-width: 1200px) {
    .wordle-page--len5 .wordle-page__game {
      --wordle-cell: min(
        clamp(3rem, 6.6vw, 4.75rem),
        calc((100% - (var(--wordle-len-css, 5) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 5))
      );
    }

    .wordle-page--len6 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.5rem, 5.5vw, 4rem),
        calc((100% - (var(--wordle-len-css, 6) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 6))
      );
    }

    .wordle-page--len7 .wordle-page__game {
      --wordle-cell: min(
        clamp(2.1rem, 4.7vw, 3.4rem),
        calc((100% - (var(--wordle-len-css, 7) - 1) * var(--wordle-gap)) / var(--wordle-len-css, 7))
      );
    }
  }
}

@media (max-width: 520px) {
  .wordle-page {
    padding-inline: var(--sa-space-2);
  }

  .wordle-page__kbd-row--actions {
    gap: 0.45rem;
    padding-inline: 0.25rem;
    margin-top: 4px;
  }

  .wordle-page__len-btn--kbd {
    flex: 0 1 auto;
    min-width: 0;
    max-width: none;
    padding-inline: 0.35rem;
    font-size: 0.72rem;
  }

  .wordle-page__chat-feed {
    min-height: 10rem;
    max-height: none;
    height: auto;
  }
}

.wordle-page__stack {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.wordle-page__stack--game {
  justify-content: flex-start;
}

.wordle-page__grid :deep(.wordle-page__stack--game > p) {
  flex-shrink: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
  min-height: 0;
}

.wordle-page__grid :deep(.wordle-page__stack) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 1201px) {
  .wordle-page__grid :deep(.wordle-page__stack--leader),
  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    flex: 0 0 auto;
    width: 100%;
  }

  .wordle-page__grid :deep(.wordle-page__stack) {
    min-height: 0;
    height: 100%;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game) {
    max-width: 100%;
    overflow: visible;
    min-height: 0;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
    flex: 1 1 auto;
    min-height: 0;
    justify-content: center;
  }

  .wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__leader-stack) {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--leader .wordle-page__global-lb {
    flex: 1 1 auto;
    min-height: 0;
  }

  .wordle-page__stack--leader .wordle-page__glb-scroll {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Триколонка: колонка чату тягнеться по висоті рядка; шапка fixed, повідомлення — scroll. */
  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--chat > .wordle-page__chat-shell {
    flex: 1 1 0;
    min-height: 0;
    height: 100%;
  }

  .wordle-page__chat-feed {
    flex: 1 1 0;
    min-height: min(12rem, 42dvh);
    overflow-y: auto;
  }
}

.wordle-page__grid :deep(.wordle-page__stack--chat) {
  gap: var(--sa-space-2);
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__side-tools) {
  flex-shrink: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__leader-stack) {
  /* `flex` лише в медіа: ≤1024 — за контентом; ≥1025 — тягнеться в колонці сітки (не перезаписувати пізнішим правилом). */
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
}

.wordle-page__card-title {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.wordle-page__len-btn {
  min-width: 2.5rem;
}

.wordle-page__len-btn--kbd {
  flex: 0 1 auto;
  max-width: 3.25rem;
}

.wordle-page__side-tools {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--sa-space-2);
  margin: 0 0 var(--sa-space-2);
  padding: var(--sa-space-2);
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 45%, transparent);
}

.wordle-page__side-tools-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: var(--sa-space-2);
  width: 100%;
  min-width: 0;
}

.wordle-page__side-tool-btn {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  justify-content: center;
  font-size: 0.72rem;
  padding-inline: 0.35rem;
}

.wordle-page__peek-word--side {
  margin: 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--sa-color-warning);
  word-break: break-word;
}

.wordle-page__leader {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 0 0 auto;
  max-height: none;
  overflow-y: visible;
}

.wordle-page__global-lb {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Розділювач лише знизу рядка «ти» (.wordle-page__leader-row), без другого border-top — інакше дві лінії підряд. */
  padding-top: var(--sa-space-6);
  overflow-x: clip;
}

.wordle-page__glb-title {
  margin: 0 0 var(--sa-space-4);
  text-align: center;
  font-size: clamp(1.02rem, 3.4vw, 1.28rem);
  font-weight: 800;
  color: var(--sa-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.wordle-page__glb-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sa-space-2);
  margin-bottom: var(--sa-space-2);
  width: min(100%, 18rem);
}

.wordle-page__glb-tab {
  width: 100%;
  min-width: 0;
  text-align: center;
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 70%, transparent);
  color: var(--sa-color-text-main);
  font: inherit;
  font-weight: 600;
  font-size: 0.68rem;
  padding: 0.35rem 0.4rem;
  border-radius: var(--sa-radius-sm);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.wordle-page__glb-tab:hover {
  border-color: var(--sa-color-primary-border);
}

.wordle-page__glb-tab--active {
  background: color-mix(in srgb, var(--sa-color-primary) 22%, var(--sa-color-surface-raised));
  border-color: var(--sa-color-primary-border);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
}

.wordle-page__glb-banner {
  align-self: stretch;
  margin: 0;
  padding: var(--sa-space-1) var(--sa-space-2);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-warning) 14%, var(--sa-color-surface));
  border: 1px solid var(--sa-color-border);
  color: var(--sa-color-text-main);
  font-size: 0.72rem;
  text-align: center;
}

.wordle-page__glb-muted {
  margin: 0;
  font-size: 0.75rem;
  color: var(--sa-color-text-muted);
}

.wordle-page__global-lb > .wordle-page__glb-muted {
  align-self: stretch;
  text-align: center;
}

.wordle-page__glb-muted--empty {
  text-align: center;
  line-height: 1.4;
}

.wordle-page__glb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-2);
  padding: var(--sa-space-2) 0 var(--sa-space-1);
}

.wordle-page__glb-podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
}

.wordle-page__glb-podium-step {
  flex: 1 1 0;
  max-width: 3.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--sa-radius-sm);
  border: 1px dashed var(--sa-color-border);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--sa-color-text-muted);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 55%, transparent);
  opacity: 0.75;
}

.wordle-page__glb-podium-step:nth-child(1) {
  min-height: 2.6rem;
}

.wordle-page__glb-podium-step:nth-child(2) {
  min-height: 2.15rem;
}

.wordle-page__glb-podium-step:nth-child(3) {
  min-height: 1.85rem;
}

.wordle-page__glb-scroll {
  flex: 0 1 auto;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  /* Лише вертикальний скрол: таблиця інколи на 1–2px ширша за контейнер і дає зайвий горизонтальний скрол. */
  overflow-x: hidden;
  overflow-y: auto;
  margin-top: var(--sa-space-1);
}

.wordle-page__glb-table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.wordle-page__glb-th {
  text-align: left;
  padding: 0.28rem 0.35rem;
  border-bottom: 1px solid var(--sa-color-border);
  color: var(--sa-color-text-muted);
  font-weight: 700;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wordle-page__glb-th--rank {
  width: 2rem;
  text-align: center;
}

.wordle-page__glb-th--score {
  text-align: right;
  width: 3.25rem;
}

.wordle-page__glb-td {
  padding: 0.35rem 0.35rem;
  border-bottom: 1px solid color-mix(in srgb, var(--sa-color-border) 85%, transparent);
  vertical-align: middle;
}

.wordle-page__glb-td--rank {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--sa-color-text-muted);
}

.wordle-page__glb-td--player {
  min-width: 0;
}

.wordle-page__glb-td--score {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--sa-color-text-main);
}

.wordle-page__glb-tr--self .wordle-page__glb-td {
  background: color-mix(in srgb, var(--sa-color-primary) 10%, transparent);
}

.wordle-page__glb-tr--self .wordle-page__glb-td:first-child {
  border-radius: 6px 0 0 6px;
}

.wordle-page__glb-tr--self .wordle-page__glb-td:last-child {
  border-radius: 0 6px 6px 0;
}

.wordle-page__glb-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.wordle-page__glb-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--sa-color-border);
}

.wordle-page__glb-avatar--ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--sa-color-primary) 18%, var(--sa-color-surface));
  color: var(--sa-color-text-main);
  font-size: 0.72rem;
  font-weight: 700;
}

.wordle-page__glb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--sa-color-text-main);
  min-width: 0;
}

.wordle-page__glb-you {
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.08rem 0.3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sa-color-primary) 35%, transparent);
  color: var(--sa-color-text-strong);
  border: 1px solid var(--sa-color-primary-border);
}

.wordle-page__leader-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: var(--sa-space-1) var(--sa-space-2);
  align-items: center;
  padding: var(--sa-space-2) 0;
  border-bottom: 1px solid var(--sa-color-border);
  font-size: 0.82rem;
}

.wordle-page__leader-row--solo {
  grid-template-columns: 1fr auto auto;
  gap: var(--sa-space-2);
}

.wordle-page__status-pill {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 75%, transparent);
  color: var(--sa-color-text-body);
  white-space: nowrap;
}

.wordle-page__pos {
  font-weight: 700;
  color: var(--sa-color-primary);
  font-variant-numeric: tabular-nums;
}

.wordle-page__who {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sa-color-text-main);
}

.wordle-page__stat {
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  font-variant-numeric: tabular-nums;
}

.wordle-page__badge {
  color: var(--sa-color-success);
  font-weight: 700;
}

.wordle-page__secret {
  letter-spacing: 0.06em;
  font-weight: 800;
  color: var(--sa-color-text-main);
}

.wordle-page__play-hint {
  margin: 0 0 var(--sa-space-3);
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
  text-align: center;
}

.wordle-page__empty {
  padding: var(--sa-space-8);
  text-align: center;
  color: var(--sa-color-text-body);
}

.wordle-page__game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sa-space-3);
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: wordle-game;
}

.wordle-page__wordle-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--wordle-gap);
  width: 100%;
  max-width: calc(
    var(--wordle-len, 5) * var(--wordle-cell) + (var(--wordle-len, 5) - 1) * var(--wordle-gap)
  );
  margin-inline: auto;
}

.wordle-page__row {
  display: flex;
  gap: var(--wordle-gap);
}

.wordle-page__row--tile {
  justify-content: center;
  width: 100%;
}

.wordle-page__cell--tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--wordle-cell);
  height: var(--wordle-cell);
  box-sizing: border-box;
  overflow: hidden;
  padding: clamp(1px, 0.12em, 3px);
  line-height: 1;
  font-size: min(
    clamp(1rem, 3.2vw, 1.9rem),
    calc(var(--wordle-cell) * 0.5)
  );
  font-weight: 700;
  border-radius: 2px;
  border: 2px solid var(--sa-color-border);
  background: transparent;
  color: var(--sa-color-text-main);
}

.wordle-page__cell--empty {
  border-color: var(--sa-color-border);
  background: transparent;
}

.wordle-page__cell--draft {
  border-color: color-mix(in srgb, var(--sa-color-border) 70%, var(--sa-color-text-muted));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 40%, transparent);
}

.wordle-page__cell[data-f='correct'] {
  background: var(--sa-color-success);
  border-color: color-mix(in srgb, var(--sa-color-success) 65%, var(--sa-color-bg-deep));
  color: var(--sa-color-text-strong);
}

.wordle-page__cell[data-f='present'] {
  background: var(--sa-color-warning);
  border-color: color-mix(in srgb, var(--sa-color-warning) 55%, var(--sa-color-bg-deep));
  color: var(--sa-color-bg-deep);
}

.wordle-page__cell[data-f='absent'] {
  background: var(--sa-color-border);
  border-color: color-mix(in srgb, var(--sa-color-border) 85%, var(--sa-color-text-muted));
  color: var(--sa-color-text-strong);
}

.wordle-page__game-panel-width {
  width: 100%;
  max-width: calc(
    var(--wordle-len, 5) * var(--wordle-cell) + (var(--wordle-len, 5) - 1) * var(--wordle-gap)
  );
  margin-inline: auto;
}

.wordle-page__celebrate {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sa-space-2);
  min-height: 7.5rem;
  padding: var(--sa-space-3) var(--sa-space-2);
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--sa-color-success) 35%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-success) 12%, var(--sa-color-surface-raised));
}

.wordle-page__confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.wordle-page__confetti-bit {
  position: absolute;
  left: calc(50% + var(--cf-cx, 0px));
  top: -14px;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  background: hsl(var(--cf-hue, 200) 82% 58%);
  opacity: 0.95;
  animation: wordle-confetti-fall var(--cf-dur, 1.6s) ease-out var(--cf-delay, 0s) forwards;
  will-change: transform, opacity;
}

@keyframes wordle-confetti-fall {
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate3d(var(--cf-dx, 0px), 150px, 0) rotate(620deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wordle-page__confetti-bit {
    animation: none;
    opacity: 0;
  }
}

.wordle-page__celebrate-title {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--sa-color-success);
  text-align: center;
}

.wordle-page__celebrate-btn {
  position: relative;
  z-index: 1;
}

.wordle-page__end-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sa-space-2);
  padding: var(--sa-space-3) var(--sa-space-2);
  border-radius: 10px;
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 88%, transparent);
}

.wordle-page__end-panel-text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--sa-color-text-body);
  text-align: center;
}

.wordle-page__peek-btn {
  font-size: 0.78rem;
  padding: 0.3rem 0.65rem;
}

.wordle-page__kbd {
  container-type: inline-size;
  container-name: wordle-kbd;
  width: 100%;
  /* Ширина поля слова < мінімуму рядка клавіатури (11 літер) — не обмежувати клавіатуру сіткою, інакше flex + min-width ріжуть краї. */
  max-width: 100%;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
  min-height: 160px;
  overflow: visible;
}

.wordle-page__kbd-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.wordle-page__kbd-main {
  flex: 0 1 auto;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  align-items: center;
}

.wordle-page__kbd-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.wordle-page__kbd-row--mid {
  padding-inline: min(1rem, 2.5vw);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key) {
  box-sizing: border-box;
  flex: 1 1 0;
  width: 0;
  min-width: 40px;
  height: 48px;
  max-height: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  overflow: hidden;
  line-height: 1;
  font-size: 16px;
  font-weight: 700;
  text-transform: none;
}

.wordle-page__kbd :deep(.wordle-page__kbd-key--absent) {
  opacity: 0.38;
  color: var(--sa-color-text-muted);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key--present) {
  border-color: color-mix(in srgb, var(--sa-color-warning) 55%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-warning) 18%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-main);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key--correct) {
  border-color: color-mix(in srgb, var(--sa-color-success) 55%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-success) 22%, var(--sa-color-surface-raised));
  color: var(--sa-color-text-strong);
}

.wordle-page__kbd-row--actions {
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 2px;
  max-width: 100%;
}

.wordle-page__kbd-row--actions .wordle-page__len-btn--kbd {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-width: 2.25rem;
  max-width: 3.25rem;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
  box-sizing: border-box;
  flex: 0 0 auto;
  min-width: 56px;
  max-width: 5rem;
  width: auto;
  height: 48px;
  min-height: 0;
  max-height: none;
  padding: 0 0.35rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
}

@media (min-width: 1201px) {
  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    height: 42px;
    min-width: 30px;
    font-size: 14px;
    padding: 0 0.1rem;
  }

  .wordle-page__kbd-row--actions .wordle-page__len-btn--kbd {
    height: 42px;
    min-width: 2.05rem;
    max-width: 2.85rem;
    font-size: 0.82rem;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
    height: 42px;
    min-width: 52px;
    max-width: 4.75rem;
    font-size: 0.62rem;
    padding: 0 0.28rem;
  }
}

@media (max-width: 1200px) {
  .wordle-page__kbd {
    gap: clamp(0.35rem, 0.8vw, var(--sa-space-2));
  }

  .wordle-page__kbd-inner {
    gap: clamp(4px, 0.65vw, 6px);
  }

  .wordle-page__kbd-row {
    gap: clamp(3px, 0.6vw, 6px);
  }

  .wordle-page__kbd-row--mid {
    padding-inline: clamp(0.2rem, 1vw, 0.7rem);
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    height: clamp(34px, 3.4vw, 42px);
    min-width: clamp(24px, 2.8vw, 34px);
    font-size: clamp(11px, 1.1vw, 14px);
    padding: 0 clamp(0.08rem, 0.28vw, 0.2rem);
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
    min-width: clamp(36px, 4.3vw, 48px);
    max-width: clamp(3rem, 5.5vw, 4.25rem);
    height: clamp(34px, 3.4vw, 42px);
    font-size: clamp(0.54rem, 0.8vw, 0.62rem);
    padding: 0 clamp(0.14rem, 0.35vw, 0.28rem);
  }

  .wordle-page__kbd-row--actions .wordle-page__len-btn--kbd {
    height: clamp(34px, 3.4vw, 42px);
    min-width: clamp(1.5rem, 2vw, 2rem);
    max-width: clamp(2rem, 3vw, 2.75rem);
    font-size: clamp(0.68rem, 0.95vw, 0.78rem);
  }
}

@media (max-width: 520px) {
  .wordle-page__kbd-row {
    gap: 4px;
  }

  .wordle-page__kbd-row--mid {
    padding-inline: 0;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    min-width: 22px;
    font-size: 10.5px;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-side-action) {
    min-width: 36px;
  }

  .wordle-page__kbd-row--actions .wordle-page__len-btn--kbd {
    min-width: 1.5rem;
    max-width: 2rem;
  }
}

.wordle-page__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.wordle-page__sr-form {
  margin: 0;
  padding: 0;
  height: 0;
  overflow: hidden;
}

.wordle-page__others {
  width: 100%;
  max-width: 24rem;
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.wordle-page__others summary {
  cursor: pointer;
  color: var(--sa-color-text-main);
  font-weight: 600;
}

.wordle-page__others-count {
  font-weight: 500;
  color: var(--sa-color-text-body);
}

.wordle-page__others-list {
  list-style: none;
  margin: var(--sa-space-2) 0 0;
  padding: 0;
}

.wordle-page__others-item {
  display: flex;
  justify-content: space-between;
  gap: var(--sa-space-2);
  padding: var(--sa-space-1) 0;
  border-bottom: 1px solid var(--sa-color-border);
  font-size: 0.75rem;
}

.wordle-page__others-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sa-color-text-main);
}

.wordle-page__others-stat {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--sa-color-text-body);
}

.wordle-page__relay-emojis {
  margin-left: var(--sa-space-2);
  letter-spacing: 0.1em;
  font-size: 0.88rem;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.4));
}

.wordle-page__chat-shell {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
}

.wordle-page__chat-head {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.wordle-page__chat-irc-banner {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--sa-color-text-muted) 55%, #f59e0b 45%);
}

.wordle-page__chat-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
}

.wordle-page__chat-len-hint {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.78rem;
  line-height: 1.45;
  color: color-mix(in srgb, var(--sa-color-text-body) 88%, var(--sa-color-primary) 12%);
}

.wordle-page__chat-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.wordle-page__chat-ws-pill {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 18%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 78%, var(--sa-color-primary-soft) 22%);
  color: color-mix(in srgb, var(--sa-color-text-muted) 75%, var(--sa-color-primary) 25%);
}

.wordle-page__chat-ws-pill[data-state='open'] {
  border-color: color-mix(in srgb, var(--sa-color-primary) 45%, transparent);
  color: var(--sa-color-primary);
  background: color-mix(in srgb, var(--sa-color-primary-soft) 75%, transparent);
}

.wordle-page__chat-ws-pill[data-state='error'] {
  border-color: color-mix(in srgb, #f87171 45%, transparent);
  color: #fecaca;
}

.wordle-page__chat-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sa-space-2);
  margin-top: 0.15rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.wordle-page__chat-channel-pill {
  font-family: var(--sa-font-mono);
  font-size: 0.68rem;
  padding: 0.12rem 0.48rem;
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-primary-soft) 42%, var(--sa-color-surface-raised) 58%);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 32%, var(--sa-color-border));
  color: var(--sa-color-text-main);
}

.wordle-page__chat-external {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--sa-color-primary);
  text-decoration: none;
  padding: 0.18rem 0.5rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 38%, transparent);
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.wordle-page__chat-external:hover {
  background: color-mix(in srgb, var(--sa-color-primary-soft) 85%, transparent);
  color: var(--sa-color-text-main);
}

@media (max-width: 640px) {
  .wordle-page__chat-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .wordle-page__chat-external {
    margin-left: 0;
  }

  .wordle-page__side-tools-row {
    flex-direction: column;
  }
}

.wordle-page__chat-feed {
  /* У колонці ≤1024 не тягнути висоту через `flex:1` + dvh — це перебивало правила вище й давало накладання на ігровий блок. */
  flex: 0 1 auto;
  width: 100%;
  min-height: 8rem;
  overflow: auto;
  border-radius: var(--sa-radius-md);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 24%, var(--sa-color-border));
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--sa-color-surface-raised) 62%, var(--sa-color-primary) 14%) 0%,
    color-mix(in srgb, var(--sa-color-bg-deep, #0a0610) 82%, var(--sa-color-primary) 12%) 55%,
    color-mix(in srgb, var(--sa-color-bg-deep, #08050c) 90%, var(--sa-color-primary) 6%) 100%
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 8%, transparent);
}

.wordle-page__chat-empty {
  margin: 0;
  margin-inline: auto;
  padding: var(--sa-space-5) var(--sa-space-4);
  max-width: 18rem;
  font-size: 0.84rem;
  line-height: 1.55;
  text-align: center;
  white-space: pre-line;
  color: color-mix(in srgb, var(--sa-color-text-body) 88%, var(--sa-color-primary) 12%);
}

.wordle-page__chat-lines {
  list-style: none;
  margin: 0;
  padding: var(--sa-space-3) var(--sa-space-3) var(--sa-space-4);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wordle-page__chat-line {
  display: flex;
  align-items: flex-start;
  gap: 0.62rem;
  padding: 0.55rem 0.7rem 0.55rem 0.62rem;
  border-radius: var(--sa-radius-md);
  border: 1px solid color-mix(in srgb, var(--sa-color-border) 55%, var(--sa-color-primary) 28%);
  border-left: 3px solid color-mix(in srgb, var(--sa-color-primary) 72%, var(--sa-color-border));
  background: color-mix(in srgb, var(--sa-color-surface-raised) 58%, rgb(12 10 22));
  box-shadow:
    0 2px 10px rgb(0 0 0 / 0.28),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.wordle-page__chat-line:nth-child(even) {
  background: color-mix(in srgb, var(--sa-color-surface-raised) 48%, rgb(10 8 18));
}

.wordle-page__chat-line:hover {
  border-color: color-mix(in srgb, var(--sa-color-primary) 45%, var(--sa-color-border));
  box-shadow:
    0 4px 14px rgb(0 0 0 / 0.32),
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 22%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.wordle-page__chat-line--guess {
  border-color: color-mix(in srgb, var(--sa-color-primary) 48%, transparent);
  border-left-color: var(--sa-color-primary, #a78bfa);
  background: linear-gradient(
    118deg,
    color-mix(in srgb, var(--sa-color-primary-soft) 52%, rgb(18 14 32)),
    color-mix(in srgb, rgb(15 12 28) 88%, var(--sa-color-primary) 12%)
  );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--sa-color-primary) 25%, transparent),
    0 3px 14px color-mix(in srgb, var(--sa-color-primary) 18%, rgb(0 0 0 / 0.5));
}

.wordle-page__chat-line--slow {
  opacity: 0.9;
}

.wordle-page__chat-avatar {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  font-weight: 800;
  color: #faf5ff;
  background: linear-gradient(
    150deg,
    color-mix(in srgb, var(--sa-color-primary) 55%, #2e1065),
    #0f0a1a
  );
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 55%, rgb(40 35 60));
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.35),
    0 2px 8px color-mix(in srgb, var(--sa-color-primary) 25%, transparent);
}

.wordle-page__chat-line-body {
  min-width: 0;
  flex: 1 1 auto;
}

.wordle-page__chat-line-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.wordle-page__chat-name {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--sa-color-text-main) 94%, var(--sa-color-primary) 6%);
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
}

.wordle-page__chat-badge {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  color: var(--sa-color-primary);
  border: 1px solid color-mix(in srgb, var(--sa-color-primary) 42%, transparent);
  background: color-mix(in srgb, var(--sa-color-primary-soft) 55%, transparent);
}

.wordle-page__chat-text {
  margin: 0.28rem 0 0;
  font-size: 0.8rem;
  line-height: 1.48;
  color: color-mix(in srgb, #f0ecf8 82%, var(--sa-color-text-body) 18%);
  word-break: break-word;
}

.wordle-page__chat-text-inner {
  white-space: pre-wrap;
}

.wordle-page__chat-cooldown {
  margin: 0.28rem 0 0;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sa-color-text-muted);
}

.wordle-page__admin-hint {
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  margin: var(--sa-space-2) 0 0;
}

@media (max-width: 1200px) {
  .wordle-page__stack--leader > .wordle-page__leader-stack {
    display: block;
    flex: none;
    min-height: auto;
    height: auto;
  }

  .wordle-page__stack--leader > .wordle-page__leader-stack > .wordle-page__global-lb {
    display: flex;
    flex: none;
    align-items: stretch;
    padding-top: var(--sa-space-3);
    margin-top: 0;
    min-height: auto;
  }

  .wordle-page__stack--leader > .wordle-page__leader-stack > .wordle-page__global-lb > .wordle-page__glb-scroll {
    flex: none;
    min-height: auto;
    max-height: none;
  }

  .wordle-page__stack--leader > .wordle-page__side-tools {
    margin-top: var(--sa-space-3);
  }

  .wordle-page__stack--game > .wordle-page__game,
  .wordle-page__stack--chat > .wordle-page__chat-shell,
  .wordle-page__stack--chat .wordle-page__chat-feed {
    flex: none;
    min-height: auto;
    height: auto;
    max-height: none;
  }
}

@media (min-width: 1201px) {
  .wordle-page__stack--chat {
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--chat > .wordle-page__chat-shell {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }

  .wordle-page__stack--chat .wordle-page__chat-feed {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
    max-height: none;
    overflow-y: auto;
  }
}
</style>
