export type GuessHeat = 'cold' | 'warm' | 'hot'

/**
 * Normalize chat / guess text for comparison:
 * trim, lowercase, strip diacritics, drop punctuation, collapse spaces.
 */
export function normalizeGarticText(raw: string): string {
  const s = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  return s
}

/** Alias for prompt dedupe keys (same rules as guess normalization). */
export function normalizeGarticPromptKey(raw: string): string {
  return normalizeGarticText(raw)
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  if (a.length === 0) {
    return b.length
  }
  if (b.length === 0) {
    return a.length
  }
  const v0 = new Array<number>(b.length + 1)
  const v1 = new Array<number>(b.length + 1)
  for (let i = 0; i <= b.length; i += 1) {
    v0[i] = i
  }
  for (let i = 0; i < a.length; i += 1) {
    v1[0] = i + 1
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
    }
    for (let j = 0; j <= b.length; j += 1) {
      v0[j] = v1[j]
    }
  }
  return v1[b.length]
}

/**
 * Similarity heat after normalization, or `exact`.
 * Short words avoid aggressive "hot"; uses prefix / length hints before Levenshtein.
 */
export function classifyGuessHeat(guess: string, target: string): GuessHeat | 'exact' {
  const g = normalizeGarticText(guess)
  const t = normalizeGarticText(target)
  if (g.length === 0 || t.length === 0) {
    return 'cold'
  }
  if (g === t) {
    return 'exact'
  }

  const minLen = Math.min(g.length, t.length)
  const maxLen = Math.max(g.length, t.length)
  const lenRatio = minLen / maxLen

  if (minLen >= 2 && (t.startsWith(g) || g.startsWith(t))) {
    if (maxLen <= 4) {
      return 'warm'
    }
    return 'hot'
  }

  if (maxLen <= 3) {
    if (lenRatio >= 0.66) {
      return 'warm'
    }
    return 'cold'
  }

  const dist = levenshtein(g, t)
  const ratio = 1 - dist / maxLen
  if (ratio >= 0.82) {
    return 'hot'
  }
  if (ratio >= 0.48) {
    return 'warm'
  }
  return 'cold'
}
