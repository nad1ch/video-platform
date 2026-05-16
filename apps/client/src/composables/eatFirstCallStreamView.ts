import { type ComputedRef } from 'vue'
import { createStreamViewRouteHelpers } from '@/composables/game-room/createStreamViewRouteHelpers'

/**
 * Eat First route helpers for OBS `?mode=view` detection. Structurally
 * mirrors `mafiaStreamViewRoute.ts`: behaviour is produced by the generic
 * `createStreamViewRouteHelpers` factory (one source of OBS view-mode
 * truth shared with Mafia), this file owns the Eat First route-name
 * binding (`'eat'`) and the Eat First-only DOM event constant.
 *
 * `EAT_FIRST_OBS_URL_TOAST_EVENT` is intentionally Eat First-only — the
 * OBS-URL copy toast is dispatched from `AppShellLayout`'s Eat First
 * header action and is not mirrored to the generic helpers.
 */
export const EAT_FIRST_OBS_URL_TOAST_EVENT = 'stream-assist:eat-first-obs-url-copied'

const eatFirstStreamView = createStreamViewRouteHelpers('eat')

export const eatFirstStreamViewQueryIsView = eatFirstStreamView.viewQueryIsView

export const eatFirstStreamViewFromRoute = eatFirstStreamView.streamViewFromRoute

/**
 * Returns `{ isStreamView }` for `EatFirstCallPage`. Delegates to the
 * shared factory so Eat First and Mafia share one OBS view-mode
 * implementation; the legacy result-key name `isStreamView` is preserved
 * for the existing consumer.
 */
export function useEatFirstCallStreamView(): { isStreamView: ComputedRef<boolean> } {
  const { isStreamView } = eatFirstStreamView.useStreamViewFromRoute()
  return { isStreamView }
}
