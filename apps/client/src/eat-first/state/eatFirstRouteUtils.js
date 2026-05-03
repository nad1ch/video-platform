

const VALID = new Set(['join', 'admin', 'control', 'overlay'])





export function normalizeEatView(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  return VALID.has(s) ?  (s) : 'join'
}





export function eatViewFromRoute(route) {
  return normalizeEatView(route.query?.view)
}

export const EAT_FIRST_ROUTE_NAME = 'eat'
