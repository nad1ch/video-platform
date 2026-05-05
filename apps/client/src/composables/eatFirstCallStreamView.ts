import { computed, type ComputedRef } from 'vue'
import { useRoute, type LocationQueryValue, type RouteLocationNormalizedLoaded } from 'vue-router'

/** Dispatched after copying the Eat First `mode=view` call URL (shell header action). */
export const EAT_FIRST_OBS_URL_TOAST_EVENT = 'stream-assist:eat-first-obs-url-copied'

/**
 * OBS / browser-source style receive-only mode for Eat First on `/app/eat`,
 * aligned with Mafia (`?mode=view`) but scoped to the `eat` route.
 */
export function eatFirstStreamViewQueryIsView(mode: LocationQueryValue | LocationQueryValue[] | undefined): boolean {
  if (mode === 'view') {
    return true
  }
  return Array.isArray(mode) && mode[0] === 'view'
}

export function eatFirstStreamViewFromRoute(route: RouteLocationNormalizedLoaded): boolean {
  if (route.name !== 'eat') {
    return false
  }
  return eatFirstStreamViewQueryIsView(route.query.mode)
}

export function useEatFirstCallStreamView(): { isStreamView: ComputedRef<boolean> } {
  const route = useRoute()
  return {
    isStreamView: computed(() => eatFirstStreamViewFromRoute(route)),
  }
}
