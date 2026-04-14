import { i18n } from '../i18n/index.js'
import { STREAMER_NICK } from './brand.js'

/** @deprecated Використовуйте ensureMetaDescription() — текст з i18n `seo.metaDescription`. */
export const META_DESCRIPTION = ''

export function ensureMetaDescription() {
  if (typeof document === 'undefined') return
  if (document.querySelector('meta[name="description"]')) return
  const m = document.createElement('meta')
  m.name = 'description'
  m.content = i18n.global.t('seo.metaDescription', { nick: STREAMER_NICK })
  document.head.insertBefore(m, document.head.firstChild)
}
