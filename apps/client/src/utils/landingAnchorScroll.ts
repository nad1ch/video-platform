/**
 * Fixed-layout landing: section elements only contain absolutely positioned children, so their
 * in-flow height is ~0 and native hash scrolling lands at the wrong Y. These values are canvas
 * document Y (px) with --u = 1px, aligned to section headings / footer (see LandingPage.vue).
 */
export const LANDING_HASH_SCROLL_TOP_PX: Readonly<Record<string, number>> = {
  '#videocall': 721,
  '#games': 1139,
  '#economy': 1735,
  '#footer': 2204,
} as const

export function normalizeRouteHash(hash: string | undefined | null): string {
  if (hash == null || hash === '') return ''
  return hash.startsWith('#') ? hash : `#${hash}`
}

export function getLandingScrollTopForHash(hash: string | undefined | null): number {
  const key = normalizeRouteHash(hash)
  if (key === '') return 0
  return LANDING_HASH_SCROLL_TOP_PX[key] ?? 0
}
