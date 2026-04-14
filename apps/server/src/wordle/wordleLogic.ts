import type { GuessFeedback } from './types'

/** MVP pool; includes ґ / є-style letters — matching uses NFC + uk-UA lowercase. */
const WORDS = ['слово', 'кава', 'вікно', 'книга', 'ґрунт', 'єнот']

export function generateWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!
}

/**
 * NFC keeps ї / є / і / ґ stable vs decomposed sequences; uk-UA lowercases correctly.
 */
export function normalizeWord(s: string): string {
  return s.trim().normalize('NFC').toLocaleLowerCase('uk-UA')
}

/** Grapheme length matches secret; only Unicode letters. */
export function isValidGuessShape(guess: string, wordLength: number): boolean {
  const g = normalizeWord(guess)
  const chars = [...g]
  if (chars.length !== wordLength) {
    return false
  }
  return /^[\p{L}]+$/u.test(g)
}

/**
 * Wordle scoring (Unicode graphemes). Duplicate letters: each secret occurrence
 * can satisfy at most one green, then yellows consume remaining pool (e.g. secret
 * "мамаа" vs guess "aaaaa" → only three cells are correct; other two absent).
 */
export function computeFeedback(answer: string, guess: string): GuessFeedback[] {
  const secretArr = [...answer]
  const guessArr = [...guess]
  const n = secretArr.length
  if (guessArr.length !== n) {
    throw new Error('computeFeedback: length mismatch')
  }

  const result: GuessFeedback[] = Array.from({ length: n }, () => 'absent')
  const letterCount = new Map<string, number>()
  for (const ch of secretArr) {
    letterCount.set(ch, (letterCount.get(ch) ?? 0) + 1)
  }

  for (let i = 0; i < n; i++) {
    if (guessArr[i] === secretArr[i]) {
      result[i] = 'correct'
      const ch = guessArr[i]!
      letterCount.set(ch, (letterCount.get(ch) ?? 0) - 1)
    }
  }

  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct') {
      continue
    }
    const ch = guessArr[i]!
    const left = letterCount.get(ch) ?? 0
    if (left > 0) {
      result[i] = 'present'
      letterCount.set(ch, left - 1)
    }
  }

  return result
}
