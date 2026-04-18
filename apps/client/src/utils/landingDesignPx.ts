/** Memoized design-token strings (`calc(var(--u) * n)`) for landing-scale layout data. */
const pxCache = new Map<number, string>()

export function landingDesignPx(value: number): string {
  let s = pxCache.get(value)
  if (s === undefined) {
    s = `calc(var(--u) * ${value})`
    pxCache.set(value, s)
  }
  return s
}
