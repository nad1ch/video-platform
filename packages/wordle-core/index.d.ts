export type WordleFeedback = 'correct' | 'present' | 'absent'

/**
 * Length in Unicode code points (string iterator / `[...s].length`), not `String.length` UTF-16 units.
 * Single implementation for client + server — keep in sync with `packages/wordle-consistency` tests.
 */
export declare function wordGraphemeCount(s: string): number

/**
 * Wordle scoring (Unicode code points). Duplicate letters: pool per letter (server-canonical).
 * Throws if `guess` and `answer` code-point lengths differ.
 */
export declare function computeFeedback(answer: string, guess: string): WordleFeedback[]
