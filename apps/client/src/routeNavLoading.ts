import { ref } from 'vue'
import { isNavigationFailure, type Router } from 'vue-router'

/** Pending in-flight client navigations (lazy route chunks + guards). */
export const routeNavLoadingDepth = ref(0)
export const routeNavLoadingVisible = ref(false)

const ROUTE_LOADER_SHOW_DELAY_MS = 120
const ROUTE_LOADER_MIN_VISIBLE_MS = 180

let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let shownAt = 0

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function clearRouteLoaderTimer(timer: ReturnType<typeof setTimeout> | undefined): undefined {
  if (timer) {
    clearTimeout(timer)
  }
  return undefined
}

function syncRouteNavLoadingVisible(): void {
  if (routeNavLoadingDepth.value > 0) {
    hideTimer = clearRouteLoaderTimer(hideTimer)
    if (routeNavLoadingVisible.value || showTimer) {
      return
    }
    showTimer = setTimeout(() => {
      showTimer = undefined
      if (routeNavLoadingDepth.value <= 0) {
        return
      }
      shownAt = nowMs()
      routeNavLoadingVisible.value = true
    }, ROUTE_LOADER_SHOW_DELAY_MS)
    return
  }

  showTimer = clearRouteLoaderTimer(showTimer)
  if (!routeNavLoadingVisible.value) {
    return
  }

  const remaining = Math.max(0, ROUTE_LOADER_MIN_VISIBLE_MS - (nowMs() - shownAt))
  hideTimer = clearRouteLoaderTimer(hideTimer)
  hideTimer = setTimeout(() => {
    hideTimer = undefined
    if (routeNavLoadingDepth.value > 0) {
      syncRouteNavLoadingVisible()
      return
    }
    routeNavLoadingVisible.value = false
  }, remaining)
}

export function bumpRouteNavLoading(): void {
  routeNavLoadingDepth.value += 1
  syncRouteNavLoadingVisible()
}

export function releaseRouteNavLoading(): void {
  routeNavLoadingDepth.value = Math.max(0, routeNavLoadingDepth.value - 1)
  syncRouteNavLoadingVisible()
}

function releaseRouteNavLoadingAfterPaint(): void {
  if (typeof window === 'undefined') {
    releaseRouteNavLoading()
    return
  }
  window.requestAnimationFrame(() => {
    releaseRouteNavLoading()
  })
}

/**
 * Full-screen route loader: bump on navigation start, release when it settles or fails.
 * Registered first so it wraps the whole guard chain.
 */
export function installRouteNavLoadingGuards(router: Router): void {
  router.beforeEach(() => {
    bumpRouteNavLoading()
  })

  router.afterEach(releaseRouteNavLoadingAfterPaint)

  router.onError(() => {
    releaseRouteNavLoading()
  })

  const { push, replace } = router

  router.push = function routeNavLoadingPush(to) {
    return push.call(router, to).catch((err: unknown) => {
      if (isNavigationFailure(err)) {
        releaseRouteNavLoading()
      }
      return Promise.reject(err)
    }) as ReturnType<typeof push>
  }

  router.replace = function routeNavLoadingReplace(to) {
    return replace.call(router, to).catch((err: unknown) => {
      if (isNavigationFailure(err)) {
        releaseRouteNavLoading()
      }
      return Promise.reject(err)
    }) as ReturnType<typeof replace>
  }
}
