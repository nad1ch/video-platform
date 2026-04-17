import { computeFeedback, wordGraphemeCount } from 'wordle-core'

/**
 * Canonical Wordle string rules for this repo. Keep client in sync:
 * `apps/client/src/wordle/wordleLogic.ts` (normalizeWord, wordGraphemeCount, computeFeedback contract).
 * `wordGraphemeCount` and `computeFeedback` are shared via `wordle-core`.
 * Contract tests: `packages/wordle-consistency` (`npm run test:wordle`).
 */

export { wordGraphemeCount, computeFeedback }

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
  if (wordGraphemeCount(g) !== wordLength) {
    return false
  }
  return /^[\p{L}]+$/u.test(g)
}
