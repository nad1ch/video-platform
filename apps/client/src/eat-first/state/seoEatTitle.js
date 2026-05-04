import { normalizeEatView } from './eatFirstRouteUtils.js'

const DOC_TITLE_BASE = 'Кого ми з’їмо першим'








export function eatViewTitleFromQuery(viewRaw) {
  switch (normalizeEatView(viewRaw)) {
    case 'call':
      return `${DOC_TITLE_BASE} · Кімната`
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
