import { computed, type ComputedRef } from 'vue'
import { useRoute, type LocationQueryValue, type RouteLocationNormalizedLoaded } from 'vue-router'

/** App shell → CallPage: show copy-to-clipboard toast after switching to `?mode=view` (OBS URL). */
export const MAFIA_OBS_URL_TOAST_EVENT = 'stream-assist:mafia-obs-url-copied'

/** CallPage / tile → MafiaOverlay: open kick dialog with a pre-selected peer. */
export const MAFIA_OPEN_KICK_MODAL_EVENT = 'stream-assist:mafia-open-kick-modal'

/**
 * `?mode=view` enables Mafia **view / stream** layout (read-only, minimal UI).
 * Any other or missing `mode` = **host** mode (default).
 */
export function mafiaViewQueryIsView(mode: LocationQueryValue | LocationQueryValue[] | undefined): boolean {
  if (mode === 'view') {
    return true
  }
  return Array.isArray(mode) && mode[0] === 'view'
}

/** Shell / layout: use `mafiaViewModeFromRoute` in Mafia UI for the same check. */
export function mafiaStreamViewFromRoute(route: RouteLocationNormalizedLoaded): boolean {
  if (route.name !== 'mafia') {
    return false
  }
  return mafiaViewQueryIsView(route.query.mode)
}

/** Mafia: `?mode=view` (stream) vs default host mode. */
export const mafiaViewModeFromRoute = mafiaStreamViewFromRoute

export function useMafiaViewMode(): { isViewMode: ComputedRef<boolean> } {
  const route = useRoute()
  return {
    isViewMode: computed(() => mafiaViewModeFromRoute(route)),
  }
}

export function useMafiaStreamViewFromRoute(): {
  isMafiaStreamView: ComputedRef<boolean>
  isViewMode: ComputedRef<boolean>
} {
  const route = useRoute()
  const isViewMode = computed(() => mafiaViewModeFromRoute(route))
  return {
    isMafiaStreamView: isViewMode,
    isViewMode,
  }
}
