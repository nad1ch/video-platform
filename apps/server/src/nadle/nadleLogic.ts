import { computeFeedback, wordGraphemeCount } from 'nadle-core'
import {
  WORDS_UK_5_ALLOWED,
  WORDS_UK_5_SECRET_POOL,
  WORDS_UK_6_ALLOWED,
  WORDS_UK_6_SECRET_POOL,
  WORDS_UK_7_ALLOWED,
  WORDS_UK_7_SECRET_POOL,
} from 'nadle-core/dictionary'

/**
 * Canonical nadle string rules for this repo. Keep client in sync:
 * `apps/client/src/nadle/nadleLogic.ts` (normalizeWord, wordGraphemeCount, computeFeedback contract).
 * `wordGraphemeCount` and `computeFeedback` are shared via `nadle-core`.
 * Contract tests: `packages/nadle-consistency` (`npm run test:nadle`).
 */

export { wordGraphemeCount, computeFeedback }

export type NadleWordLength = 5 | 6 | 7

const PACK: Record<NadleWordLength, { allowed: Set<string>; secret: readonly string[] }> = {
  5: { allowed: new Set(WORDS_UK_5_ALLOWED), secret: WORDS_UK_5_SECRET_POOL },
  6: { allowed: new Set(WORDS_UK_6_ALLOWED), secret: WORDS_UK_6_SECRET_POOL },
  7: { allowed: new Set(WORDS_UK_7_ALLOWED), secret: WORDS_UK_7_SECRET_POOL },
}

export function normalizeWordLength(raw: unknown): NadleWordLength {
  return raw === 6 || raw === 7 ? raw : 5
}

export function generateWord(length: NadleWordLength = 5): string {
  const pool = PACK[length].secret
  return pool[Math.floor(Math.random() * pool.length)]!
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

export function isAllowedGuess(word: string, length: NadleWordLength): boolean {
  const n = normalizeWord(word)
  if (wordGraphemeCount(n) !== length) {
    return false
  }
  return PACK[length].allowed.has(n)
}
