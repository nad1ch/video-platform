import { computed, type ComputedRef } from 'vue'
import {
  useRoute,
  type LocationQueryValue,
  type RouteLocationNormalizedLoaded,
} from 'vue-router'

/**
 * Factory for the route helpers each call-game route uses to detect
 * `?mode=view` (OBS view mode) — gated on a specific `route.name` so a
 * helper from one route's family never reports `true` for the other
 * route. The Mafia and Game Template helper files
 * (`mafiaStreamViewRoute`, `gameRoomStreamViewRoute`) re-export the
 * returned functions under their stable, route-specific public names
 * (and renamed result-keys, e.g. `isMafiaStreamView`).
 *
 * Behaviour matches the historic helpers byte-for-byte:
 *   - `viewQueryIsView('view') === true`
 *   - `viewQueryIsView(['view', ...]) === true` (first element)
 *   - any other shape → `false`
 *   - `streamViewFromRoute(route)` is `false` unless `route.name`
 *     matches the configured route name AND the query says `view`.
 */
export interface StreamViewRouteHelpers {
  viewQueryIsView(mode: LocationQueryValue | LocationQueryValue[] | undefined): boolean
  streamViewFromRoute(route: RouteLocationNormalizedLoaded): boolean
  useViewMode(): { isViewMode: ComputedRef<boolean> }
  useStreamViewFromRoute(): {
    isStreamView: ComputedRef<boolean>
    isViewMode: ComputedRef<boolean>
  }
}

export function createStreamViewRouteHelpers(routeName: string): StreamViewRouteHelpers {
  function viewQueryIsView(
    mode: LocationQueryValue | LocationQueryValue[] | undefined,
  ): boolean {
    if (mode === 'view') {
      return true
    }
    return Array.isArray(mode) && mode[0] === 'view'
  }

  function streamViewFromRoute(route: RouteLocationNormalizedLoaded): boolean {
    if (route.name !== routeName) {
      return false
    }
    return viewQueryIsView(route.query.mode)
  }

  function useViewMode(): { isViewMode: ComputedRef<boolean> } {
    const route = useRoute()
    return {
      isViewMode: computed(() => streamViewFromRoute(route)),
    }
  }

  function useStreamViewFromRoute(): {
    isStreamView: ComputedRef<boolean>
    isViewMode: ComputedRef<boolean>
  } {
    const route = useRoute()
    const isViewMode = computed(() => streamViewFromRoute(route))
    return {
      isStreamView: isViewMode,
      isViewMode,
    }
  }

  return {
    viewQueryIsView,
    streamViewFromRoute,
    useViewMode,
    useStreamViewFromRoute,
  }
}
