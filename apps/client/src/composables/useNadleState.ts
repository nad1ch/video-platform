import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { NadleLocalBoardCell } from '@/components/nadle/NadleLocalBoardGrid.vue'
import {
  MAX_ATTEMPTS,
  WORD_LENGTH_OPTIONS,
  computeFeedback,
  isAllowedGuess,
  normalizeWord,
  randomWord,
  wordGraphemeCount,
  type Feedback,
  type LocalGuessRow,
  type WordLength,
} from '@/nadle/nadleLogic'
import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'

const NADLE_WORD_LEN_KEY = 'streamassist_nadle_word_len'
const NADLE_LOCAL_STATS_KEY = 'streamassist_nadle_local_stats'

export const NADLE_DICTIONARY_ERROR_TEXT = 'Слова немає в словнику.'

type LocalWinStats = { won: number; lost: number }

function loadWordLength(scope: string): WordLength {
  try {
    const n = Number(localStorage.getItem(`${NADLE_WORD_LEN_KEY}:${scope}`))
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
    localStorage.setItem(`${NADLE_WORD_LEN_KEY}:${scope}`, String(len))
  } catch {
    /* ignore */
  }
}

function loadLocalStats(scope: string): LocalWinStats {
  const o = readStorageJson(
    typeof localStorage !== 'undefined' ? localStorage : null,
    `${NADLE_LOCAL_STATS_KEY}:${scope}`,
    null,
  ) as { won?: unknown; lost?: unknown } | null
  if (!o || typeof o !== 'object') {
    return { won: 0, lost: 0 }
  }
  return {
    won: typeof o.won === 'number' && Number.isFinite(o.won) ? o.won : 0,
    lost: typeof o.lost === 'number' && Number.isFinite(o.lost) ? o.lost : 0,
  }
}

function persistLocalStats(scope: string, s: LocalWinStats): void {
  writeStorageJson(
    typeof localStorage !== 'undefined' ? localStorage : null,
    `${NADLE_LOCAL_STATS_KEY}:${scope}`,
    s,
  )
}

export type UseNadleStateOptions = {
  storageScope: ComputedRef<string>
  lastError: Ref<string | null>
}

export function useNadleState(options: UseNadleStateOptions) {
  const { storageScope, lastError } = options

  const NADLE_MAX_ATTEMPTS = MAX_ATTEMPTS
  const KBD_ROW1 = ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ї'] as const
  const KBD_ROW2 = ['Ф', 'І', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Є'] as const
  const KBD_ROW3 = ['Ґ', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю'] as const

  const wordLength = ref<WordLength>(5)
  const secretWord = ref(randomWord(5))
  const localGuesses = ref<LocalGuessRow[]>([])
  const gameStatus = ref<'playing' | 'won' | 'lost'>('playing')
  const localRoundId = ref(0)
  const soloLbPosted = ref(false)
  const localStats = ref<LocalWinStats>({ won: 0, lost: 0 })
  const secretPeekVisible = ref(false)
  const guessInput = ref('')

  watch(localRoundId, () => {
    soloLbPosted.value = false
  })

  function hydrateScope(scope: string): void {
    const len = loadWordLength(scope)
    wordLength.value = len
    secretWord.value = randomWord(len)
    localGuesses.value = []
    guessInput.value = ''
    gameStatus.value = 'playing'
    localStats.value = loadLocalStats(scope)
    localRoundId.value += 1
  }

  const localBoardLocked = computed(
    () => gameStatus.value !== 'playing' || localGuesses.value.length >= MAX_ATTEMPTS,
  )

  const nadleGridRows = computed((): NadleLocalBoardCell[][] => {
    const len = wordLength.value
    const submitted = localGuesses.value
    const canType = gameStatus.value === 'playing' && submitted.length < MAX_ATTEMPTS
    const draftNorm = canType ? normalizeWord(guessInput.value) : ''
    const draftChars = [...draftNorm].slice(0, len)

    const rows: NadleLocalBoardCell[][] = []
    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const cells: NadleLocalBoardCell[] = []
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
    return fb ? `nadle-page__kbd-key--${fb}` : undefined
  }

  function kbdAppendLetter(ch: string): void {
    lastError.value = null
    if (localBoardLocked.value) {
      return
    }
    const draft = normalizeWord(guessInput.value)
    if (wordGraphemeCount(draft) >= wordLength.value) {
      return
    }
    guessInput.value = guessInput.value + ch
  }

  function clampGuessSrInput(): void {
    if (localBoardLocked.value) {
      return
    }
    const n = normalizeWord(guessInput.value)
    if (wordGraphemeCount(n) <= wordLength.value) {
      return
    }
    guessInput.value = [...n].slice(0, wordLength.value).join('')
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
    if (wordGraphemeCount(guess) !== len) {
      return
    }
    if (!isAllowedGuess(guess, len)) {
      lastError.value = NADLE_DICTIONARY_ERROR_TEXT
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
    persistWordLength(storageScope.value, len)
    secretWord.value = randomWord(len)
    localGuesses.value = []
    guessInput.value = ''
    gameStatus.value = 'playing'
    localRoundId.value += 1
  }

  function toggleSecretPeek(): void {
    secretPeekVisible.value = !secretPeekVisible.value
  }

  function persistCurrentLocalStats(s: LocalWinStats): void {
    persistLocalStats(storageScope.value, s)
  }

  return {
    NADLE_MAX_ATTEMPTS,
    WORD_LENGTH_OPTIONS,
    KBD_ROW1,
    KBD_ROW2,
    KBD_ROW3,
    wordLength,
    secretWord,
    localGuesses,
    gameStatus,
    localRoundId,
    soloLbPosted,
    localStats,
    secretPeekVisible,
    guessInput,
    localBoardLocked,
    nadleGridRows,
    kbdLetterBestFeedback,
    kbdKeyFeedbackModifier,
    kbdAppendLetter,
    clampGuessSrInput,
    kbdBackspace,
    submitGuess,
    newRoundSameLength,
    setWordLength,
    toggleSecretPeek,
    hydrateScope,
    persistCurrentLocalStats,
    normalizeWord,
    wordGraphemeCount,
  }
}
