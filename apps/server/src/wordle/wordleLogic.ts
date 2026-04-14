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
 * Classic Wordle letter scoring (handles duplicate letters).
 * `answer` and `guess` must be same length; caller normalizes casing.
 */
export function computeFeedback(answer: string, guess: string): GuessFeedback[] {
  const a = [...answer]
  const g = [...guess]
  const out: GuessFeedback[] = g.map(() => 'absent')
  const avail = new Map<string, number>()

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) {
      out[i] = 'correct'
    } else {
      const ch = a[i]!
      avail.set(ch, (avail.get(ch) ?? 0) + 1)
    }
  }

  for (let i = 0; i < g.length; i++) {
    if (out[i] === 'correct') {
      continue
    }
    const ch = g[i]!
    const left = avail.get(ch) ?? 0
    if (left > 0) {
      out[i] = 'present'
      avail.set(ch, left - 1)
    }
  }

  return out
}
