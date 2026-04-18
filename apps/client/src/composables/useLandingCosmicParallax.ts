import { onBeforeUnmount, onMounted, type Ref } from 'vue'

function landingPageScrollY(): number {
  if (typeof window === 'undefined') return 0
  return (
    document.scrollingElement?.scrollTop ?? window.pageYOffset ?? document.documentElement?.scrollTop ?? 0
  )
}

/** Same multipliers as `LandingPage` canvas — keeps scroll depth consistent app-wide. */
export function useLandingCosmicParallax(canvasEl: Ref<HTMLElement | null>) {
  let cleanup: (() => void) | undefined

  onMounted(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    const applyParallax = () => {
      const el = canvasEl.value
      if (!el) return
      const y = landingPageScrollY()
      const off = (m: number) => `${y * m}px`
      el.style.setProperty('--landing-parallax-bg-x', off(-0.048))
      el.style.setProperty('--landing-parallax-bg-y', off(0.165))
      el.style.setProperty('--landing-parallax-mid-x', off(-0.042))
      el.style.setProperty('--landing-parallax-mid-y', off(0.102))
      el.style.setProperty('--landing-parallax-fg-x', off(0.063))
      el.style.setProperty('--landing-parallax-fg-y', off(0.083))
      el.style.setProperty('--landing-parallax-glow-x', off(0.057))
      el.style.setProperty('--landing-parallax-glow-y', off(0.108))
      el.style.setProperty('--landing-parallax-bolt-x', off(-0.072))
      el.style.setProperty('--landing-parallax-bolt-y', off(0.128))
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        applyParallax()
      })
    }
    applyParallax()
    window.addEventListener('scroll', onScroll, { passive: true })
    cleanup = () => window.removeEventListener('scroll', onScroll)
  })

  onBeforeUnmount(() => {
    cleanup?.()
  })
}
