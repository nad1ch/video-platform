<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
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

const { isAuthenticated } = useAuth()

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

const leaderboardSelfName = computed(() => {
  void locale.value
  return sessionUser.value?.display_name ?? t('wordleUi.guest')
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
      const o = p as { user?: SessionUser | null }
      sessionUser.value = o.user ?? null
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
    const res = await fetch(apiUrl('/api/wordle/me'), { credentials: 'include' })
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

/** Sync Wordle session display with global shell auth (single logout/login in header). */
watch(isAuthenticated, async (auth) => {
  if (auth) {
    await refreshMe()
  } else {
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
    if (el.closest('iframe')) {
      return
    }
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

onMounted(() => {
  persistQueryChannelToStorage()
  void fetchWordlePublicConfig()
  void refreshMe()
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
          <h2 class="wordle-page__card-title">{{ t('wordleUi.cardYou') }}</h2>
          <p class="wordle-page__session-meta" aria-live="polite">
            <span class="wordle-page__pill">{{
              t('wordleUi.roundPill', { n: localRoundId + 1, len: wordLength })
            }}</span>
          </p>
          <div class="wordle-page__stats-block" :aria-label="t('wordleUi.statsAria')">
            <p class="wordle-page__stats-line">
              {{ t('wordleUi.wonStat') }} <strong>{{ localStats.won }}</strong>
            </p>
            <p class="wordle-page__stats-line">
              {{ t('wordleUi.lostStat') }} <strong>{{ localStats.lost }}</strong>
            </p>
          </div>
          <div class="wordle-page__len-bar" role="group" :aria-label="t('wordleUi.wordLengthGroupAria')">
            <span class="wordle-page__len-label">{{ t('wordleUi.lettersLabel') }}</span>
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

          <div
            v-if="gameStatus === 'playing'"
            class="wordle-page__side-tools"
            :aria-label="t('wordleUi.streamToolsAria')"
          >
            <AppButton type="button" variant="ghost" class="wordle-page__peek-btn wordle-page__peek-btn--block" @click="toggleSecretPeek">
              {{ secretPeekVisible ? t('wordleUi.hideWord') : t('wordleUi.showWord') }}
            </AppButton>
            <AppButton type="button" variant="ghost" class="wordle-page__side-new-secret" @click="newRoundSameLength">
              {{ t('wordleUi.newSecretWord') }}
            </AppButton>
            <p v-if="secretPeekVisible" class="wordle-page__peek-word wordle-page__peek-word--side" aria-live="polite">
              {{ secretWord }}
            </p>
          </div>

          <ol class="wordle-page__leader">
            <li class="wordle-page__leader-row wordle-page__leader-row--solo">
              <span class="wordle-page__who">{{ leaderboardSelfName }}</span>
              <span class="wordle-page__stat">{{
                t('wordleUi.attemptsLine', { cur: localGuesses.length, max: WORDLE_MAX_ATTEMPTS })
              }}</span>
              <span class="wordle-page__status-pill">{{ leaderboardStatusLabel }}</span>
            </li>
          </ol>
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
          <h2 class="wordle-page__card-title wordle-page__card-title--chat">{{ t('wordleUi.chatTitle') }}</h2>
          <div class="wordle-page__iframe-wrap">
            <iframe
              :key="effectiveTwitchChannel"
              :src="chatIframeSrc"
              :title="t('wordleUi.chatIframeTitle')"
              class="wordle-page__iframe"
            />
          </div>
          <ul class="wordle-page__relay" :aria-label="t('wordleUi.chatRelayAria')">
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

.wordle-page__pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 85%, transparent);
  color: var(--sa-color-text-main);
  font-variant-numeric: tabular-nums;
}

.wordle-page__pill--dim {
  color: var(--sa-color-text-muted);
  font-weight: 500;
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
      padding: 0.28rem 0.18rem;
      font-size: 0.72rem;
      max-width: 2.55rem;
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

  .wordle-page__iframe-wrap {
    flex: 0 1 auto;
    min-height: max(300px, 18rem);
    max-height: min(60vh, 38rem);
    height: min(60vh, 38rem);
  }

  .wordle-page__relay {
    max-height: min(34vh, 16rem);
  }

  .wordle-page__leader {
    flex: 0 0 auto;
    max-height: none;
    overflow: visible;
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
  .wordle-page__pill {
    font-size: 0.62rem;
    padding: 0.12rem 0.38rem;
  }

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
    font-size: 0.65rem;
    padding: 0.28rem 0.15rem;
    max-width: 2.2rem;
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

  .wordle-page__iframe-wrap {
    min-height: max(300px, 19rem);
    height: min(62vh, 36rem);
    max-height: min(62vh, 36rem);
  }

  .wordle-page__relay {
    max-height: min(38vh, 14rem);
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

.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__card-title),
.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__session-meta),
.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__stats-block),
.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__len-bar),
.wordle-page__grid :deep(.wordle-page__stack--leader > .wordle-page__side-tools) {
  flex-shrink: 0;
}

.wordle-page__session-meta {
  margin: calc(-1 * var(--sa-space-1)) 0 var(--sa-space-2);
  font-size: 0.78rem;
  color: var(--sa-color-text-body);
}

.wordle-page__card-title {
  margin: 0 0 var(--sa-space-2);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sa-color-text-main);
}

.wordle-page__card-title--chat {
  margin-bottom: var(--sa-space-2);
  flex-shrink: 0;
}

.wordle-page__stats-block {
  margin: 0 0 var(--sa-space-3);
  padding: var(--sa-space-2) var(--sa-space-2);
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 55%, transparent);
  font-size: 0.8rem;
  color: var(--sa-color-text-body);
}

.wordle-page__stats-line {
  margin: 0.15rem 0;
  font-variant-numeric: tabular-nums;
}

.wordle-page__stats-line strong {
  color: var(--sa-color-text-main);
  font-weight: 800;
}

.wordle-page__len-bar {
  display: flex;
  flex-direction: column;
  gap: var(--sa-space-2);
  margin: 0 0 var(--sa-space-3);
}

.wordle-page__len-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--sa-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sa-space-2);
  margin: 0 0 var(--sa-space-3);
  padding: var(--sa-space-2);
  border-radius: var(--sa-radius-sm);
  border: 1px solid var(--sa-color-border);
  background: color-mix(in srgb, var(--sa-color-surface-raised) 45%, transparent);
}

.wordle-page__peek-btn--block {
  flex: 1 1 9rem;
  min-width: 0;
  width: auto;
  justify-content: center;
  font-size: 0.76rem;
}

.wordle-page__side-new-secret {
  flex: 1 1 9rem;
  min-width: 0;
  width: auto;
  justify-content: center;
  font-size: 0.76rem;
}

.wordle-page__peek-word--side {
  flex: 1 0 100%;
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
  overflow: auto;
  flex: 1 1 0;
  min-height: 0;
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
  font-size: clamp(1.35rem, 3.8vw, 2rem);
  font-weight: 700;
  border-radius: 2px;
  border: 2px solid var(--sa-color-border);
  background: transparent;
  color: var(--sa-color-text-main);
  box-sizing: border-box;
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
  padding: 0.38rem 0.28rem;
  font-size: 0.78rem;
  font-weight: 700;
  flex: 1 1 0;
  max-width: 2.85rem;
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
  margin-left: var(--sa-space-1);
  letter-spacing: 0.08em;
  font-size: 0.8rem;
}

/* Мін. ~300px висоти вбудованого чату (зручно на планшеті/телефоні; 3000px — занадто для в’юпорта). */
.wordle-page__iframe-wrap {
  flex: 1 1 0;
  width: 100%;
  min-height: 300px;
  border-radius: var(--sa-radius-sm);
  overflow: hidden;
  border: 1px solid var(--sa-color-border);
}

.wordle-page__iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.wordle-page__relay {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 0 0 auto;
  max-height: min(22vh, 200px);
  overflow: auto;
  font-size: 0.68rem;
  min-height: 0;
  border-top: 1px solid var(--sa-color-border);
  padding-top: var(--sa-space-2);
}

.wordle-page__relay-line {
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--sa-color-border);
  color: var(--sa-color-text-body);
}

.wordle-page__relay-line[data-h='true'] {
  background: var(--sa-color-primary-soft);
  color: var(--sa-color-text-main);
  margin: 0 calc(-1 * var(--sa-space-2));
  padding-left: var(--sa-space-2);
  padding-right: var(--sa-space-2);
}

.wordle-page__relay-line[data-rl='true'] {
  opacity: 0.75;
}

.wordle-page__relay-tag {
  margin-left: var(--sa-space-1);
  font-size: 0.65rem;
  text-transform: uppercase;
  color: var(--sa-color-text-muted);
}

.wordle-page__admin-hint {
  font-size: 0.75rem;
  color: var(--sa-color-text-body);
  margin: var(--sa-space-2) 0 0;
}
</style>
