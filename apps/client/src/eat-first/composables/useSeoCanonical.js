import { watch } from 'vue'
import { useRoute } from 'vue-router'

const ORIGIN = (import.meta.env.VITE_PUBLIC_CANONICAL_ORIGIN || '').replace(/\/$/, '')

/**
 * Оновлює rel=canonical та og:url під поточний маршрут (path + query), щоб SEO не вважав усі сторінки головною.
 */
export function useSeoCanonical() {
  const route = useRoute()

  function sync() {
    if (!ORIGIN || typeof document === 'undefined') return
    const path = route.fullPath || '/'
    const url = `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`

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
