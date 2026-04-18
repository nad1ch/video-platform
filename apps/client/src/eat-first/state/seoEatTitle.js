import { normalizeEatView } from './eatFirstRouteUtils.js'

const DOC_TITLE_BASE = 'Кого ми з’їмо першим'

/**
 * Document title for Eat First routes (same strings as before router.afterEach).
 * Pure — no Vue / DOM.
 *
 * @param {unknown} viewRaw — `route.query.view`
 * @returns {string}
 */
export function eatViewTitleFromQuery(viewRaw) {
  switch (normalizeEatView(viewRaw)) {
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
