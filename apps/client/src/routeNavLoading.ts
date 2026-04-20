import { ref } from 'vue'
import { isNavigationFailure, type Router } from 'vue-router'

/** Pending in-flight client navigations (lazy route chunks + guards). */
export const routeNavLoadingDepth = ref(0)

export function bumpRouteNavLoading(): void {
  routeNavLoadingDepth.value += 1
}

export function releaseRouteNavLoading(): void {
  routeNavLoadingDepth.value = Math.max(0, routeNavLoadingDepth.value - 1)
}

/**
 * Full-screen route loader: bump on navigation start, release when it settles or fails.
 * Registered first so it wraps the whole guard chain.
 */
export function installRouteNavLoadingGuards(router: Router): void {
  router.beforeEach(() => {
    bumpRouteNavLoading()
  })

  router.afterEach(() => {
    releaseRouteNavLoading()
  })

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
