const prefetchedRoutes = new WeakSet();
export function prefetchRoute(importFn) {
    if (prefetchedRoutes.has(importFn)) {
        return;
    }
    prefetchedRoutes.add(importFn);
    void importFn().catch(() => {
        prefetchedRoutes.delete(importFn);
    });
}
