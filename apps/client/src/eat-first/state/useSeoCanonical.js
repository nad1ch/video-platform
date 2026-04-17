import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { buildCanonicalAbsoluteUrl, trimCanonicalOrigin } from './seoCanonicalUrl.js'

const ORIGIN = trimCanonicalOrigin(import.meta.env.VITE_PUBLIC_CANONICAL_ORIGIN ?? '')

/**
 * Оновлює rel=canonical та og:url під поточний маршрут (path + query), щоб SEO не вважав усі сторінки головною.
 */
export function useSeoCanonical() {
  const route = useRoute()

  function sync() {
    if (!ORIGIN || typeof document === 'undefined') return
    const url = buildCanonicalAbsoluteUrl(ORIGIN, route.fullPath)
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

  watch(() => route.fullPath, sync, { immediate: true })
}
