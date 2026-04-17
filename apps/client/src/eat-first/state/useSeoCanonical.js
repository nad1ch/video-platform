import { watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  buildCanonicalAbsoluteUrl,
  canonicalRelativePathForSeo,
  resolveCanonicalOriginForClient,
} from './seoCanonicalUrl.js'

/**
 * Оновлює rel=canonical та og:url під поточний маршрут (path + контентні query; hash і шумові query прибираються).
 * Origin: dev uses `window.location.origin`; prod prefers `VITE_PUBLIC_CANONICAL_ORIGIN` when set (see `resolveCanonicalOriginForClient`).
 */
export function useSeoCanonical() {
  const route = useRoute()

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

    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', url)

    let og = document.querySelector('meta[property="og:url"]')
    if (!og) {
      og = document.createElement('meta')
      og.setAttribute('property', 'og:url')
      document.head.appendChild(og)
    }
    og.setAttribute('content', url)
  }

  watch(() => route.fullPath, sync, { immediate: true, flush: 'post' })
}
