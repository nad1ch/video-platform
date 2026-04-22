/**
 * Fisher–Yates shuffle. Returns a new array; does not mutate the input.
 */
export function fisherYatesShuffle<T>(source: ReadonlyArray<T>): T[] {
  const a = source.slice() as T[]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
  return a
}
