/**
 * Eat-first public barrel (narrow). Shell / pages may import from `@/eat-first`.
 * Inside eat-first (services, composables, mediasoup) use deep paths — not this file — to avoid cycles.
 *
 * UI: `@/eat-first/ui/...`, `@/eat-first/components/...`, `@/eat-first/pages/...`.
 */
export { callableApiEnabled, callableRegion } from './api/callableApi.js'
export {
  EAT_FIRST_ROUTE_NAME,
  eatViewFromRoute,
  normalizeEatView,
} from './state/eatFirstRouteUtils.js'
export { useSeoApp, useSeoCanonical, useSeoMeta, useSeoOg } from './state/useSeoApp.js'
export { useTheme } from './state/useTheme.js'
