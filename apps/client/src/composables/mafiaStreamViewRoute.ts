import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { createStreamViewRouteHelpers } from '@/composables/game-room/createStreamViewRouteHelpers'

/**
 * Mafia route helpers for OBS `?mode=view` detection. The view-mode
 * gate behaviour is produced by the generic
 * `createStreamViewRouteHelpers` factory; this file owns the Mafia
 * route-name binding (`'mafia'`), the Mafia-only DOM event name
 * constants, and re-exports each function under its stable public
 * name.
 *
 * `MAFIA_OPEN_KICK_MODAL_EVENT` is intentionally Mafia-only — the
 * kick modal is a Mafia-specific UI surface and is not mirrored to
 * the generic game-room helpers.
 */
export const MAFIA_OBS_URL_TOAST_EVENT = 'stream-assist:mafia-obs-url-copied'

export const MAFIA_SETTINGS_TOAST_EVENT = 'stream-assist:mafia-settings-toast'

export const MAFIA_OPEN_KICK_MODAL_EVENT = 'stream-assist:mafia-open-kick-modal'

const mafiaStreamView = createStreamViewRouteHelpers('mafia')

export const mafiaViewQueryIsView = mafiaStreamView.viewQueryIsView

export const mafiaStreamViewFromRoute = mafiaStreamView.streamViewFromRoute

export const mafiaViewModeFromRoute = mafiaStreamViewFromRoute

export const useMafiaViewMode = mafiaStreamView.useViewMode

/**
 * Backward-compatible `useMafiaStreamViewFromRoute` keeps the legacy
 * result-key name `isMafiaStreamView` (aliased to the same ref as
 * `isViewMode`). New consumers should prefer the generic factory
 * `useStreamViewFromRoute` returned by
 * `createStreamViewRouteHelpers`.
 */
export function useMafiaStreamViewFromRoute(): {
  isMafiaStreamView: ComputedRef<boolean>
  isViewMode: ComputedRef<boolean>
} {
  const route = useRoute()
  const isViewMode = computed(() => mafiaStreamViewFromRoute(route))
  return {
    isMafiaStreamView: isViewMode,
    isViewMode,
  }
}
