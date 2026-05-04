

const VALID = new Set(['call', 'admin', 'control', 'overlay'])

export function normalizeEatView(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'join') {
    return 'call'
  }
  return VALID.has(s) ? s : 'call'
}





export function eatViewFromRoute(route) {
  return normalizeEatView(route.query?.view)
}

export const EAT_FIRST_ROUTE_NAME = 'eat'
