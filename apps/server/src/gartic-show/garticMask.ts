/** Unicode-aware code point iterator for mask / reveal. */
export function wordCodePoints(word: string): string[] {
  return [...word]
}

export function buildMaskedDisplay(word: string, revealed: boolean[]): string {
  const chars = wordCodePoints(word)
  return chars
    .map((ch, i) => {
      if (ch === ' ') {
        return ' '
      }
      if (revealed[i]) {
        return ch
      }
      return '_'
    })
    .join(' ')
}

export function initialRevealedMask(word: string): boolean[] {
  return wordCodePoints(word).map((ch) => ch === ' ')
}

/** Reveal one random still-hidden letter; returns false if nothing left. */
export function revealRandomLetter(revealed: boolean[], word: string): boolean {
  const chars = wordCodePoints(word)
  const hidden: number[] = []
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== ' ' && !revealed[i]) {
      hidden.push(i)
    }
  }
  if (hidden.length === 0) {
    return false
  }
  const pick = hidden[Math.floor(Math.random() * hidden.length)]
  revealed[pick] = true
  return true
}

export function countNonSpaceLetters(word: string): number {
  return wordCodePoints(word).filter((ch) => ch !== ' ').length
}

/** How many non-space letters are currently revealed. */
export function countRevealedLetters(revealed: boolean[], word: string): number {
  const chars = wordCodePoints(word)
  let n = 0
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== ' ' && revealed[i]) {
      n += 1
    }
  }
  return n
}

/**
 * At most one automatic hint letter per round (late-game), for words with 2+ letters.
 */
export function maxEndgameHintLetters(word: string): number {
  return countNonSpaceLetters(word) >= 2 ? 1 : 0
}
