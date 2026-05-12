import { computed, type ComputedRef } from 'vue'
import { useRoute, type LocationQueryValue, type RouteLocationNormalizedLoaded } from 'vue-router'


export const MAFIA_OBS_URL_TOAST_EVENT = 'stream-assist:mafia-obs-url-copied'


export const MAFIA_SETTINGS_TOAST_EVENT = 'stream-assist:mafia-settings-toast'


export const MAFIA_OPEN_KICK_MODAL_EVENT = 'stream-assist:mafia-open-kick-modal'





export function mafiaViewQueryIsView(mode: LocationQueryValue | LocationQueryValue[] | undefined): boolean {
  if (mode === 'view') {
    return true
  }
  return Array.isArray(mode) && mode[0] === 'view'
}


export function mafiaStreamViewFromRoute(route: RouteLocationNormalizedLoaded): boolean {
  // Accept the Game Template route too — it forks the Mafia page tree and
  // reuses the same `?mode=view` OBS contract. Mafia behaviour is byte-
  // identical when `route.name === 'mafia'`; this is purely additive.
  if (route.name !== 'mafia' && route.name !== 'game-template') {
    return false
  }
  return mafiaViewQueryIsView(route.query.mode)
}


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
