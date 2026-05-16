import { computeFeedback, wordGraphemeCount } from 'nadle-core';
import { WORDS_UK_5_ALLOWED, WORDS_UK_5_SECRET_POOL, WORDS_UK_6_ALLOWED, WORDS_UK_6_SECRET_POOL, WORDS_UK_7_ALLOWED, WORDS_UK_7_SECRET_POOL, } from 'nadle-core/dictionary';
export const WORD_LENGTH_OPTIONS = [5, 6, 7];
export const MAX_ATTEMPTS = 6;
const PACK = {
    5: { allowed: new Set(WORDS_UK_5_ALLOWED), secret: WORDS_UK_5_SECRET_POOL },
    6: { allowed: new Set(WORDS_UK_6_ALLOWED), secret: WORDS_UK_6_SECRET_POOL },
    7: { allowed: new Set(WORDS_UK_7_ALLOWED), secret: WORDS_UK_7_SECRET_POOL },
};
/**
 * Server is the canonical implementation — keep in sync with
 * `apps/server/src/nadle/nadleLogic.ts`. Contract: `packages/nadle-consistency` (`npm run test:nadle`).
 * `wordGraphemeCount` and `computeFeedback` are shared via `nadle-core`.
 */
export function normalizeWord(word) {
    return word.trim().normalize('NFC').toLocaleLowerCase('uk-UA');
}
export function randomWord(length) {
    const pool = PACK[length].secret;
    return pool[Math.floor(Math.random() * pool.length)];
}
export function isAllowedGuess(word, length) {
    const n = normalizeWord(word);
    if (wordGraphemeCount(n) !== length) {
        return false;
    }
    return PACK[length].allowed.has(n);
}
export { computeFeedback, wordGraphemeCount };
