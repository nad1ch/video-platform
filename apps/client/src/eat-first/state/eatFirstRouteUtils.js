/** @typedef {'join' | 'admin' | 'control' | 'overlay'} EatFirstView */

const VALID = new Set(['join', 'admin', 'control', 'overlay'])

/**
 * @param {unknown} raw
 * @returns {EatFirstView}
 */
export function normalizeEatView(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  return VALID.has(s) ? /** @type {EatFirstView} */ (s) : 'join'
}

/**
 * @param {{ query?: Record<string, unknown> }} route
 * @returns {EatFirstView}
 */
export function eatViewFromRoute(route) {
  return normalizeEatView(route.query?.view)
}

export const EAT_FIRST_ROUTE_NAME = 'eat'
