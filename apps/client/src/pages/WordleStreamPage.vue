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

const TWITCH_CHANNEL_STORAGE_KEY = 'streamassist_wordle_twitch_channel'
const WORDLE_WORD_LEN_KEY = 'streamassist_wordle_word_len'
const WORDLE_LOCAL_STATS_KEY = 'streamassist_wordle_local_stats'
const DEMO_TWITCH_CHANNEL = STREAMER_NICK

type LocalWinStats = { won: number; lost: number }

function loadWordLength(): WordLength {
  try {
    const n = Number(localStorage.getItem(WORDLE_WORD_LEN_KEY))
    if (n === 5 || n === 6 || n === 7) {
      return n
    }
  } catch {
    /* ignore */
  }
  return 5
}

function persistWordLength(len: WordLength): void {
  try {
    localStorage.setItem(WORDLE_WORD_LEN_KEY, String(len))
  } catch {
    /* ignore */
  }
}

function loadLocalStats(): LocalWinStats {
  try {
    const raw = localStorage.getItem(WORDLE_LOCAL_STATS_KEY)
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

function persistLocalStats(s: LocalWinStats): void {
  try {
    localStorage.setItem(WORDLE_LOCAL_STATS_KEY, JSON.stringify(s))
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

function readStoredTwitchChannel(): string | null {
  try {
    return normalizeTwitchLogin(localStorage.getItem(TWITCH_CHANNEL_STORAGE_KEY))
  } catch {
    return null
  }
}

const route = useRoute()
const { t, locale } = useI18n()

const wordlePublicConfig = shallowRef<WordlePublicConfig | null>(null)

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

const { isAuthenticated, user, isAdmin } = useAuth()

const gameState = shallowRef<GameStatePayload | null>(null)
const leaderboard = ref<LeaderboardEntry[]>([])
const chatLines = ref<ChatLine[]>([])
const sessionUser = shallowRef<SessionUser | null>(null)
const guessInput = ref('')
const wsStatus = ref<'idle' | 'open' | 'closed' | 'error'>('idle')
const lastError = ref<string | null>(null)

let ws: WebSocket | null = null

/**
 * Priority: URL ?channel= → localStorage (viewer choice) → VITE_TWITCH_CHANNEL → demo fallback.
 * Custom chat panel shows IRC relay over WebSocket; server ingest must use TWITCH_CHANNEL (match for live guesses).
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

async function fetchWordlePublicConfig(): Promise<void> {
  try {
    const res = await fetch(apiUrl('/api/wordle/public-config'))
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

function wordleWsUrl(): string {
  const env = import.meta.env.VITE_WORDLE_WS_URL as string | undefined
  if (typeof env === 'string' && env.trim().length > 0) {
    return env.trim()
  }
  const prefix = sameOriginApiPrefix()
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
    const u = new URL('/wordle-ws', prefix.endsWith('/') ? prefix : `${prefix}/`)
    u.protocol = proto
    return u.toString()
  }
  const path = prefix ? `${prefix}/wordle-ws` : '/wordle-ws'
  return `${proto}//${location.host}${path}`
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

/** Локальна гра (український Wordle); співпадає з MAX_ATTEMPTS у wordleLogic. */
const WORDLE_MAX_ATTEMPTS = MAX_ATTEMPTS

/** Рядки клавіатури: усі 33 літери української абетки. */
const KBD_ROW1 = ['А', 'Б', 'В', 'Г', 'Ґ', 'Д', 'Е', 'Є', 'Ж', 'З', 'И'] as const
const KBD_ROW2 = ['І', 'Ї', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С'] as const
const KBD_ROW3 = ['Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ь', 'Ю', 'Я'] as const

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

const wordLength = ref<WordLength>(loadWordLength())
const secretWord = ref(randomWord(wordLength.value))
const localGuesses = ref<LocalGuessRow[]>([])
const gameStatus = ref<'playing' | 'won' | 'lost'>('playing')
const localRoundId = ref(0)
const localStats = ref<LocalWinStats>(loadLocalStats())
/** Для стріму: тимчасово показати загадане слово. */
const secretPeekVisible = ref(false)

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
  persistWordLength(len)
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
    persistLocalStats(s)
  } else if (next === 'lost') {
    const s = { ...localStats.value, lost: localStats.value.lost + 1 }
    localStats.value = s
    persistLocalStats(s)
  }
})

const globalLbTab = ref<'wins' | 'streak' | 'rating'>('wins')
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

async function loadGlobalLbWins(): Promise<void> {
  globalLbLoading.value = true
  globalLbError.value = null
  try {
    const res = await fetch(apiUrl('/api/leaderboard/wins'), { credentials: 'include' })
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
    const res = await fetch(apiUrl('/api/leaderboard/streak'), { credentials: 'include' })
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
    const res = await fetch(apiUrl('/api/leaderboard/rating'), { credentials: 'include' })
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
  persistQueryChannelToStorage()
  void fetchWordlePublicConfig()
  void loadGlobalLbActive()
  connectWs()
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  ws?.close()
  ws = null
})
</script>

<template>
  <div class="page-route">
    <AppContainer wide flush class="wordle-page" :class="`wordle-page--len${wordLength}`">
      <p v-if="lastError" class="wordle-page__banner">{{ lastError }}</p>

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

          <div class="wordle-page__len-bar" role="group" :aria-label="t('wordleUi.wordLengthGroupAria')">
            <div class="wordle-page__len-buttons">
              <AppButton
                v-for="n in WORD_LENGTH_OPTIONS"
                :key="n"
                type="button"
                :variant="wordLength === n ? 'primary' : 'ghost'"
                class="wordle-page__len-btn"
                @click="setWordLength(n)"
              >
                {{ n }}
              </AppButton>
            </div>
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
              <div class="wordle-page__kbd-row wordle-page__kbd-row--actions">
                <AppButton
                  type="button"
                  variant="secondary"
                  class="wordle-page__kbd-action"
                  :disabled="localBoardLocked || normalizeWord(guessInput).length !== wordLength"
                  @click="submitGuess"
                >
                  {{ t('wordleUi.enter') }}
                </AppButton>
                <AppButton
                  type="button"
                  variant="ghost"
                  class="wordle-page__kbd-action"
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

        <AppCard class="wordle-page__stack wordle-page__stack--side wordle-page__stack--chat">
          <div class="wordle-page__chat-shell">
            <header class="wordle-page__chat-head">
              <div class="wordle-page__chat-head-row">
                <h2 class="wordle-page__chat-title">{{ t('wordleUi.chatTitle') }}</h2>
                <span class="wordle-page__chat-ws-pill" :data-state="wsStatus">{{ wsStatusLabel }}</span>
              </div>
              <div class="wordle-page__chat-toolbar">
                <span class="wordle-page__chat-channel-pill">#{{ effectiveTwitchChannel }}</span>
                <span class="wordle-page__chat-feed-label">{{ t('wordleUi.chatFeedLabel') }}</span>
                <a
                  class="wordle-page__chat-external"
                  :href="twitchWatchUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t('wordleUi.chatOpenTwitch') }}
                </a>
              </div>
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

/* На вузьких/планшетних екранах не розтягуємо сторінку на всю висоту viewport. */
@media (max-width: 1100px) {
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

.wordle-page__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: var(--sa-space-4);
  align-items: stretch;
}

@media (min-width: 1101px) {
  .wordle-page {
    --wordle-gap: clamp(6px, 1vmin, 10px);
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
    grid-template-columns: minmax(9.5rem, 0.62fr) minmax(17rem, 1.08fr) minmax(9rem, 0.82fr);
  }

  @media (max-height: 820px) {
    .wordle-page__kbd {
      gap: var(--sa-space-1);
    }

    .wordle-page__kbd :deep(.wordle-page__kbd-key) {
      padding: clamp(0.05rem, 0.7cqw, 0.18rem) clamp(0.03rem, 0.45cqw, 0.12rem);
      font-size: 0.66rem;
      font-size: min(0.7rem, 6.5cqw, calc(100cqw / 15));
      max-width: 2.55rem;
      max-height: 2.55rem;
    }

    .wordle-page__kbd :deep(.wordle-page__kbd-action) {
      padding: 0.34rem 0.55rem;
      font-size: 0.68rem;
    }

    .wordle-page__game {
      gap: var(--sa-space-2);
    }
  }
}

@media (max-width: 1100px) {
  .wordle-page__grid {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: var(--sa-space-3);
    align-items: stretch;
  }

  /* Лідерборд / «ти» зверху, потім гра, внизу чат. */
  .wordle-page__stack--leader {
    order: -2;
  }

  .wordle-page__stack--game {
    order: -1;
  }

  .wordle-page__stack--chat {
    order: 0;
  }

  .wordle-page__game {
    justify-content: flex-start;
  }

  .wordle-page__grid :deep(.wordle-page__stack--chat) {
    flex: 0 1 auto;
    max-height: none;
  }

  .wordle-page__chat-feed {
    flex: 0 1 auto;
    min-height: max(280px, 16rem);
    max-height: min(56vh, 34rem);
    height: min(56vh, 34rem);
  }

  .wordle-page__leader-stack .wordle-page__leader {
    flex: 0 0 auto;
    max-height: none;
    overflow: visible;
  }

  .wordle-page__leader-stack {
    flex: 0 1 auto;
    min-height: 0;
  }

  .wordle-page__glb-scroll {
    max-height: min(42vh, 19rem);
  }

  .wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
    flex: 0 0 auto;
  }
}

@media (max-width: 960px) {
  .wordle-page {
    padding-block: var(--sa-space-2) var(--sa-space-4);
    padding-inline: var(--sa-space-3);
    --wordle-gap: 6px;
    --wordle-cell: min(
      3.35rem,
      calc(
        (
            100vw - 4.5rem - (var(--wordle-len-css, 5) - 1) * var(--wordle-gap)
          ) / var(--wordle-len-css, 5)
      )
    );
    overflow-x: clip;
  }

}

@media (max-width: 520px) {
  .wordle-page {
    padding-inline: var(--sa-space-2);
    --wordle-cell: min(
      2.75rem,
      calc(
        (
            100vw - 3.75rem - (var(--wordle-len-css, 5) - 1) * var(--wordle-gap)
          ) / var(--wordle-len-css, 5)
      )
    );
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-key) {
    padding: clamp(0.04rem, 0.65cqw, 0.16rem) clamp(0.02rem, 0.4cqw, 0.1rem);
    font-size: 0.58rem;
    font-size: min(0.62rem, 6.2cqw, calc(100cqw / 16));
    max-width: 2.2rem;
    max-height: 2.2rem;
  }

  .wordle-page__kbd-row--actions {
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    gap: 0.45rem;
    max-width: 100%;
    padding-inline: 0.25rem;
  }

  .wordle-page__kbd :deep(.wordle-page__kbd-action) {
    flex: 1 1 0;
    min-width: 0;
    max-width: 9.5rem;
    width: auto;
    padding: 0.3rem 0.45rem;
    font-size: 0.62rem;
  }

  .wordle-page__chat-feed {
    min-height: max(260px, 15rem);
    height: min(58vh, 32rem);
    max-height: min(58vh, 32rem);
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

@media (min-width: 1101px) {
  .wordle-page__grid :deep(.wordle-page__stack) {
    min-height: 0;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game) {
    overflow-x: clip;
    overflow-y: visible;
    min-height: 0;
  }

  .wordle-page__grid :deep(.wordle-page__stack--game > .wordle-page__game) {
    flex: 1 1 auto;
    min-height: 0;
    justify-content: center;
  }
}

.wordle-page__grid :deep(.wordle-page__stack--chat) {
  gap: var(--sa-space-2);
}

.wordle-page__stack--chat > .wordle-page__chat-shell {
  flex: 1 1 0;
  min-height: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__side-tools) {
  flex-shrink: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__len-bar) {
  flex-shrink: 0;
  margin-top: auto;
  margin-bottom: 0;
}

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__leader-stack) {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
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

.wordle-page__len-bar {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--sa-space-2);
  margin: 0 0 var(--sa-space-3);
}

.wordle-page__stack--leader > .wordle-page__len-bar {
  justify-content: center;
}

.wordle-page__stack--leader .wordle-page__len-buttons {
  display: flex;
  gap: var(--sa-space-2);
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.wordle-page__len-buttons {
  display: flex;
  gap: var(--sa-space-1);
  flex-wrap: wrap;
}

.wordle-page__len-btn {
  min-width: 2.5rem;
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
  max-height: 12rem;
  overflow-y: auto;
}

.wordle-page__global-lb {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Розділювач лише знизу рядка «ти» (.wordle-page__leader-row), без другого border-top — інакше дві лінії підряд. */
  padding-top: var(--sa-space-6);
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
  flex: 1 1 0;
  align-self: stretch;
  width: 100%;
  min-height: 0;
  overflow: auto;
  margin-top: var(--sa-space-1);
}

.wordle-page__glb-table {
  width: 100%;
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
  width: 100%;
  justify-content: center;
  min-height: 0;
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
  max-width: min(
    100%,
    calc(var(--wordle-len, 5) * var(--wordle-cell) + (var(--wordle-len, 5) - 1) * var(--wordle-gap) + 24px)
  );
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  align-items: center;
  min-width: 0;
}

.wordle-page__kbd-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 5px;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.wordle-page__kbd-row--mid {
  padding-inline: min(1.25rem, 3vw);
}

.wordle-page__kbd :deep(.wordle-page__kbd-key) {
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  max-width: 2.85rem;
  aspect-ratio: 1;
  max-height: 2.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: clamp(0.06rem, 0.8cqw, 0.22rem) clamp(0.04rem, 0.5cqw, 0.14rem);
  overflow: hidden;
  line-height: 1;
  font-size: 0.72rem;
  font-size: min(0.76rem, 7cqw, calc(100cqw / 14));
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
  flex-wrap: wrap;
  gap: var(--sa-space-2);
  padding-top: 2px;
}

.wordle-page__kbd :deep(.wordle-page__kbd-action) {
  flex: 0 0 auto;
  min-width: 4.25rem;
  max-width: 10rem;
  padding: 0.42rem 0.75rem;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
  min-height: 0;
}

.wordle-page__chat-head {
  flex-shrink: 0;
}

.wordle-page__chat-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sa-space-2);
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

.wordle-page__chat-feed-label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.62rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--sa-color-primary) 38%, var(--sa-color-text-muted));
  text-transform: uppercase;
  letter-spacing: 0.08em;
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

.wordle-page__chat-feed {
  flex: 1 1 0;
  width: 100%;
  min-height: 300px;
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
</style>
