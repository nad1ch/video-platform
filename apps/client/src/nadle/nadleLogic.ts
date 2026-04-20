import { computeFeedback, wordGraphemeCount } from 'nadle-core'
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

/**
 * Server is the canonical implementation — keep in sync with
 * `apps/server/src/nadle/nadleLogic.ts`. Contract: `packages/nadle-consistency` (`npm run test:nadle`).
 * `wordGraphemeCount` and `computeFeedback` are shared via `nadle-core`.
 */
export function normalizeWord(word: string): string {
  return word.trim().normalize('NFC').toLocaleLowerCase('uk-UA')
}

export function randomWord(length: WordLength): string {
  const pool = PACK[length].secret
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function isAllowedGuess(word: string, length: WordLength): boolean {
  const n = normalizeWord(word)
  if (wordGraphemeCount(n) !== length) {
    return false
  }
  return PACK[length].allowed.has(n)
}

export { computeFeedback, wordGraphemeCount }
