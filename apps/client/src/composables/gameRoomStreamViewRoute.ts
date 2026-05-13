import { computed, type ComputedRef } from 'vue'
import { useRoute, type LocationQueryValue, type RouteLocationNormalizedLoaded } from 'vue-router'

/**
 * Generic game-room route helpers (Phase 3B). Parallel of
 * `mafiaStreamViewRoute.ts` but gated on `route.name === 'game-template'`.
 *
 * `MAFIA_OPEN_KICK_MODAL_EVENT` is intentionally NOT mirrored — the kick
 * modal is a Mafia-specific UI surface. The OBS-url and settings-toast
 * events have generic counterparts so future game-room consumers do not
 * have to import Mafia-named constants.
 */
export const GAME_ROOM_OBS_URL_TOAST_EVENT = 'stream-assist:gameroom-obs-url-copied'

export const GAME_ROOM_SETTINGS_TOAST_EVENT = 'stream-assist:gameroom-settings-toast'

export function gameRoomViewQueryIsView(
  mode: LocationQueryValue | LocationQueryValue[] | undefined,
): boolean {
  if (mode === 'view') {
    return true
  }
  return Array.isArray(mode) && mode[0] === 'view'
}

export function gameRoomStreamViewFromRoute(route: RouteLocationNormalizedLoaded): boolean {
  if (route.name !== 'game-template') {
    return false
  }
  return gameRoomViewQueryIsView(route.query.mode)
}

export const gameRoomViewModeFromRoute = gameRoomStreamViewFromRoute

export function useGameRoomViewMode(): { isViewMode: ComputedRef<boolean> } {
  const route = useRoute()
  return {
    isViewMode: computed(() => gameRoomViewModeFromRoute(route)),
  }
}

export function useGameRoomStreamViewFromRoute(): {
  isGameRoomStreamView: ComputedRef<boolean>
  isViewMode: ComputedRef<boolean>
} {
  const route = useRoute()
  const isViewMode = computed(() => gameRoomViewModeFromRoute(route))
  return {
    isGameRoomStreamView: isViewMode,
    isViewMode,
  }
}
