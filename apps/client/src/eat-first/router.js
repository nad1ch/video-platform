import { ref } from 'vue'
import { HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from './config/access.js'
import { getPersistedGameId } from './utils/persistedGameId.js'
import { trackPageView } from './analytics/bootstrap.js'
import { normalizeEatView } from './state/eatFirstRouteUtils.js'

/** Instant transition between admin and control views (no login form flash). */
export const adminControlTransitionInstant = ref(false)

function resolveAdminGateGameId(query) {
  const g = query?.game
  if (g != null && String(g).trim()) return String(g).trim()
  const p = getPersistedGameId()
  if (p) return p
  return 'test1'
}

const DOC_TITLE_BASE = 'Кого ми з’їмо першим'

function eatViewTitle(view) {
  switch (normalizeEatView(view)) {
    case 'join':
      return `${DOC_TITLE_BASE} · Лобі`
    case 'admin':
      return `${DOC_TITLE_BASE} · Доступ ведучого`
    case 'control':
      return `${DOC_TITLE_BASE} · Панель`
    case 'overlay':
      return `${DOC_TITLE_BASE} · Overlay`
    default:
      return DOC_TITLE_BASE
  }
}

function isEatPath(p) {
  return typeof p === 'string' && (p === '/app/eat' || p.startsWith('/app/eat/'))
}

function isAdminOrControlQuery(query) {
  const v = normalizeEatView(query?.view)
  return v === 'admin' || v === 'control'
}

/**
 * @param {import('vue-router').Router} router
 */
export function registerEatFirstRouterGuards(router) {
  router.beforeEach((to, from) => {
    if (!isEatPath(to.path) && !isEatPath(from.path)) return
    adminControlTransitionInstant.value =
      Boolean(from.path) &&
      isAdminOrControlQuery(from.query) &&
      isAdminOrControlQuery(to.query)
  })

  router.afterEach((to) => {
    if (!isEatPath(to.path)) return
    document.title = eatViewTitle(to.query?.view)
    trackPageView(to.fullPath)
  })
}

/**
 * When URL has view=admin but host session is already valid, jump to control (same as former beforeEnter).
 * Call from EatFirstPage with watch(immediate).
 *
 * @param {import('vue-router').Router} router
 * @param {import('vue-router').RouteLocationNormalizedLoaded} route
 * @param {boolean} canEatFirstHost — admin or host role from GET /api/auth/me
 */
export function redirectAdminToControlIfAuthed(router, route, canEatFirstHost) {
  if (normalizeEatView(route.query.view) !== 'admin') return
  if (!canEatFirstHost) return
  router.replace({
    name: 'eat',
    query: {
      ...route.query,
      view: 'control',
      game: resolveAdminGateGameId(route.query),
      [HOST_PANEL_QUERY_KEY]: HOST_PANEL_QUERY_VALUE,
    },
  })
}
