import { trackPageView } from './analytics/bootstrap.js'

/**
 * Eat First router guards — kept narrow after the legacy
 * `view=overlay|control|admin` panels were removed. Today this only emits an
 * analytics page-view event for `/app/eat*` navigations; legacy redirect /
 * admin-gate logic is gone and lives nowhere in this file.
 */
function isEatPath(p) {
  return typeof p === 'string' && (p === '/app/eat' || p.startsWith('/app/eat/'))
}

export function registerEatFirstRouterGuards(router) {
  router.afterEach((to) => {
    if (!isEatPath(to.path)) return
    trackPageView(to.fullPath)
  })
}
