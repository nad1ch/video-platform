type RouteImport = () => Promise<unknown>

const prefetchedRoutes = new WeakSet<RouteImport>()

export function prefetchRoute(importFn: RouteImport): void {
  if (prefetchedRoutes.has(importFn)) {
    return
  }
  prefetchedRoutes.add(importFn)
  void importFn().catch(() => {
    prefetchedRoutes.delete(importFn)
  })
}
