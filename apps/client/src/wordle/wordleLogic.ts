import {
  WORDS_UK_5_ALLOWED,
  WORDS_UK_5_SECRET_POOL,
  WORDS_UK_6_ALLOWED,
  WORDS_UK_6_SECRET_POOL,
  WORDS_UK_7_ALLOWED,
  WORDS_UK_7_SECRET_POOL,
} from './words-uk-dictionary.generated'

export type WordLength = 5 | 6 | 7

export const WORD_LENGTH_OPTIONS: readonly WordLength[] = [5, 6, 7]

export const MAX_ATTEMPTS = 6

export type Feedback = 'correct' | 'present' | 'absent'

export type LocalGuessRow = { word: string; result: Feedback[] }

/** `allowed` — усі леми з Hunspell (прийнятні здогади). `secret` — ~1000 слів за частотою субтитрів ∩ Hunspell (+насіння). */
const PACK: Record<WordLength, { allowed: Set<string>; secret: readonly string[] }> = {
  5: { allowed: new Set(WORDS_UK_5_ALLOWED), secret: WORDS_UK_5_SECRET_POOL },
  6: { allowed: new Set(WORDS_UK_6_ALLOWED), secret: WORDS_UK_6_SECRET_POOL },
  7: { allowed: new Set(WORDS_UK_7_ALLOWED), secret: WORDS_UK_7_SECRET_POOL },
}

export function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase('uk-UA').normalize('NFC')
}

export function randomWord(length: WordLength): string {
  const pool = PACK[length].secret
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function isAllowedGuess(word: string, length: WordLength): boolean {
  const n = normalizeWord(word)
  if ([...n].length !== length) {
    return false
  }
  return PACK[length].allowed.has(n)
}

/**
 * Класичний Wordle: спочатку correct, потім present (жодна літера двічі не «зʼїдається»).
 */
export function computeFeedback(secret: string, guess: string): Feedback[] {
  const result: Feedback[] = Array.from({ length: guess.length }, () => 'absent')
  const secretArr: (string | null)[] = [...secret]
  const guessArr = [...guess]

  for (let i = 0; i < guessArr.length; i++) {
    if (guessArr[i] === secretArr[i]) {
      result[i] = 'correct'
      secretArr[i] = null
    }
  }

  for (let i = 0; i < guessArr.length; i++) {
    if (result[i] === 'correct') {
      continue
    }
    const ch = guessArr[i]!
    const idx = secretArr.indexOf(ch)
    if (idx !== -1) {
      result[i] = 'present'
      secretArr[idx] = null
    }
  }

  return result
}
