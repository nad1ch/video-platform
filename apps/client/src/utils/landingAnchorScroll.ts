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

const LANDING_CANVAS_DESIGN_WIDTH_PX = 2560

export function normalizeRouteHash(hash: string | undefined | null): string {
  if (hash == null || hash === '') return ''
  return hash.startsWith('#') ? hash : `#${hash}`
}

export function getLandingScrollTopForHash(hash: string | undefined | null): number {
  const key = normalizeRouteHash(hash)
  if (key === '') return 0
  const designTop = LANDING_HASH_SCROLL_TOP_PX[key] ?? 0
  if (typeof window === 'undefined') return designTop

  const canvasWidth =
    document.querySelector<HTMLElement>('.landing__canvas')?.getBoundingClientRect().width ??
    Math.min(window.innerWidth, LANDING_CANVAS_DESIGN_WIDTH_PX)

  const scale =
    canvasWidth > 0 ? Math.min(canvasWidth / LANDING_CANVAS_DESIGN_WIDTH_PX, 1) : 1

  return designTop * scale
}
