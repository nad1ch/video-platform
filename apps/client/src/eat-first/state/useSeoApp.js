import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  buildCanonicalAbsoluteUrl,
  canonicalRelativePathForSeo,
  resolveCanonicalOriginForClient,
} from './seoCanonicalUrl.js'
import {
  resolveAppSeoDescription,
  resolveAppSeoTitle,
  resolveDefaultOgImageUrl,
} from './seoAppResolve.js'

/**
 * Single SEO entry for the `/app` shell: canonical, og:*, twitter:*, title, meta description.
 * og:url === link[rel=canonical] always (same absolute URL, noise-free path).
 *
 * Aliases (same implementation, no duplicate watchers):
 * - useSeoMeta / useSeoCanonical / useSeoOg
 */
export function useSeoApp() {
  const route = useRoute()
  const { t, locale } = useI18n()

  function setMetaName(name, content) {
    if (typeof document === 'undefined') return
    let el = document.querySelector(`meta[name="${name}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', name)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  function setMetaProperty(property, content) {
    if (typeof document === 'undefined') return
    let el = document.querySelector(`meta[property="${property}"]`)
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('property', property)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  function sync() {
    if (typeof document === 'undefined') return

    const origin = resolveCanonicalOriginForClient({
      dev: import.meta.env.DEV,
      vitePublicCanonicalOrigin: import.meta.env.VITE_PUBLIC_CANONICAL_ORIGIN,
      windowOrigin: typeof window !== 'undefined' ? window.location.origin : '',
    })
    if (!origin) return

    const relative = canonicalRelativePathForSeo(route.fullPath)
    const url = buildCanonicalAbsoluteUrl(origin, relative)
    if (!url) return

    const title = resolveAppSeoTitle(route, t)
    const description = resolveAppSeoDescription(route, t)
    const ogImage = resolveDefaultOgImageUrl(origin)
    if (!ogImage) return

    document.title = title

    setMetaName('description', description)

    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', url)

    setMetaProperty('og:type', 'website')
    setMetaProperty('og:title', title)
    setMetaProperty('og:description', description)
    setMetaProperty('og:url', url)
    setMetaProperty('og:image', ogImage)

    setMetaName('twitter:card', 'summary_large_image')
    setMetaName('twitter:title', title)
    setMetaName('twitter:description', description)
    setMetaName('twitter:image', ogImage)
  }

  watch(
    () => [route.fullPath, route.name, locale.value],
    sync,
    { immediate: true, flush: 'post' },
  )
}

export const useSeoMeta = useSeoApp
export const useSeoCanonical = useSeoApp
export const useSeoOg = useSeoApp
