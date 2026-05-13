import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { createStreamViewRouteHelpers } from '@/composables/game-room/createStreamViewRouteHelpers'

/**
 * Generic game-room route helpers (Phase 3B). Parallel of
 * `mafiaStreamViewRoute.ts` but gated on `route.name === 'game-template'`.
 *
 * `MAFIA_OPEN_KICK_MODAL_EVENT` is intentionally NOT mirrored — the kick
 * modal is a Mafia-specific UI surface. The OBS-url and settings-toast
 * events have generic counterparts so future game-room consumers do not
 * have to import Mafia-named constants.
 *
 * The view-mode gate behaviour is produced by the generic
 * `createStreamViewRouteHelpers` factory; this file owns the
 * game-template route-name binding (`'game-template'`), the
 * game-room DOM event name constants, and re-exports each function
 * under its stable public name.
 */
export const GAME_ROOM_OBS_URL_TOAST_EVENT = 'stream-assist:gameroom-obs-url-copied'

export const GAME_ROOM_SETTINGS_TOAST_EVENT = 'stream-assist:gameroom-settings-toast'

const gameRoomStreamView = createStreamViewRouteHelpers('game-template')

export const gameRoomViewQueryIsView = gameRoomStreamView.viewQueryIsView

export const gameRoomStreamViewFromRoute = gameRoomStreamView.streamViewFromRoute

export const gameRoomViewModeFromRoute = gameRoomStreamViewFromRoute

export const useGameRoomViewMode = gameRoomStreamView.useViewMode

/**
 * Backward-compatible `useGameRoomStreamViewFromRoute` keeps the
 * legacy result-key name `isGameRoomStreamView` (aliased to the same
 * ref as `isViewMode`). New consumers should prefer the generic
 * factory `useStreamViewFromRoute` returned by
 * `createStreamViewRouteHelpers`.
 */
export function useGameRoomStreamViewFromRoute(): {
  isGameRoomStreamView: ComputedRef<boolean>
  isViewMode: ComputedRef<boolean>
} {
  const route = useRoute()
  const isViewMode = computed(() => gameRoomStreamViewFromRoute(route))
  return {
    isGameRoomStreamView: isViewMode,
    isViewMode,
  }
}
