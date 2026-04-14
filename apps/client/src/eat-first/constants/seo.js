/** Тексти для HTML / fallback, якщо meta ще не в head (Lighthouse, старий кеш). */
export const META_DESCRIPTION =
  'Інтерфейс шоу «Кого ми з’їмо першим»: лобі, панель гравця та ведучого, overlay для OBS. Канал nad1ch.'

export function ensureMetaDescription() {
  if (typeof document === 'undefined') return
  if (document.querySelector('meta[name="description"]')) return
  const m = document.createElement('meta')
  m.name = 'description'
  m.content = META_DESCRIPTION
  document.head.insertBefore(m, document.head.firstChild)
}
