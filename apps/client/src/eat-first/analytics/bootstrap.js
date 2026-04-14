/**
 * Аналітика за змінними середовища (без жорсткого ключа в репозиторії).
 * - VITE_PLAUSIBLE_DOMAIN — домен у Plausible (наприклад, app.example.com)
 * - VITE_GA_MEASUREMENT_ID — G-XXXXXXXXXX для Google Analytics 4
 */

function appendScript(src, attrs = {}) {
  const s = document.createElement('script')
  s.src = src
  s.async = true
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v))
  document.head.appendChild(s)
}

export function initAnalytics() {
  if (typeof document === 'undefined') return

  const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN
  if (plausibleDomain) {
    window.plausible =
      window.plausible ||
      function (...args) {
        ;(window.plausible.q = window.plausible.q || []).push(args)
      }
    appendScript('https://plausible.io/js/script.js', { 'data-domain': plausibleDomain })
  }

  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID
  if (gaId) {
    appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`)
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', gaId, { send_page_view: false })
  }
}

export function trackPageView(path) {
  if (window.plausible) {
    window.plausible('pageview')
  }
  if (window.gtag && path) {
    window.gtag('event', 'page_view', { page_path: path })
  }
}

/** Технічні події (відвал слухача Firestore тощо). */
export function trackTechnicalEvent(name, props = {}) {
  if (window.plausible) {
    window.plausible(name, { props })
  }
  if (window.gtag) {
    window.gtag('event', name, { ...props, event_category: 'technical' })
  }
}
