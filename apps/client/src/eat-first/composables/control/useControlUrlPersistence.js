import { watch } from 'vue'
import { ADMIN_KEY, HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from '../../config/access.js'
import { saveHostAccessSession } from '../../utils/persistedHostSession.js'
import { eatViewFromRoute } from '../../eatFirstRouteUtils.js'

/**
 * controlQuery / navigateQuery plus URL sync watches (host key cleanup, game from persistence).
 */
export function useControlUrlPersistence({ route, router, gameId, isAdmin, adminAccessDenied }) {
  function controlQuery(overrides) {
    const base = { ...route.query, ...overrides }
    delete base.key
    delete base.role
    const gRaw = base.game
    if (gRaw == null || !String(gRaw).trim()) base.game = gameId.value
    else base.game = String(gRaw).trim()
    if (isAdmin.value) {
      base[HOST_PANEL_QUERY_KEY] = HOST_PANEL_QUERY_VALUE
    } else {
      delete base[HOST_PANEL_QUERY_KEY]
    }
    base.view = 'control'
    return base
  }

  function navigateQuery(overrides) {
    router.replace({
      name: 'eat',
      query: controlQuery(overrides),
    })
  }

  /** Прибираємо `key` / `role=admin` з адресного рядка; залишаємо лише `host=1`. */
  watch(
    () => [route.path, isAdmin.value, route.query.key, route.query.role],
    () => {
      if (eatViewFromRoute(route) !== 'control' || !isAdmin.value) return
      const legacyKey = String(route.query.key ?? '').trim()
      const legacyRole = String(route.query.role ?? '').toLowerCase() === 'admin'
      if (!legacyKey && !legacyRole) return
      if (legacyKey === ADMIN_KEY) saveHostAccessSession(ADMIN_KEY)
      router.replace({ name: 'eat', query: controlQuery({}) })
    },
    { flush: 'post' },
  )

  /** Підставляє `game` у URL з пам’яті, щоб F5 не скидав кімнату. */
  watch(
    () => [route.path, String(route.query.game ?? ''), adminAccessDenied.value],
    () => {
      if (eatViewFromRoute(route) !== 'control') return
      if (adminAccessDenied.value) return
      if (String(route.query.game ?? '').trim()) return
      router.replace({ name: 'eat', query: controlQuery({}) })
    },
    { immediate: true, flush: 'post' },
  )

  return { controlQuery, navigateQuery }
}
