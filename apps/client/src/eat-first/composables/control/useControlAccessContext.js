import { computed, ref, watch } from 'vue'
import { HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from '../../config/access.js'
import { getPersistedGameId, setPersistedGameId } from '../../utils/persistedGameId.js'
import { saveLastPlayerSlot } from '../../utils/persistedPlayerSlot.js'
import { normalizePlayerSlotId } from '../../utils/playerSlot.js'

/**
 * Host/player gate, game & slot identity from route, overlay links, join linking.
 * Host access: signed-in user with role admin or host (see GET /api/auth/me).
 */
export function useControlAccessContext({ route, t, authUser, authLoaded }) {
  const hostModeRequested = computed(
    () =>
      String(route.query[HOST_PANEL_QUERY_KEY] ?? '').trim() === HOST_PANEL_QUERY_VALUE ||
      String(route.query.role ?? '').toLowerCase() === 'admin',
  )

  const sessionCanHost = computed(() => {
    const r = authUser.value?.role
    return r === 'admin' || r === 'host'
  })

  const isAdmin = computed(
    () => hostModeRequested.value && authLoaded.value && sessionCanHost.value,
  )
  const adminAccessDenied = computed(
    () => hostModeRequested.value && authLoaded.value && !sessionCanHost.value,
  )

  const gameId = computed(() => {
    const q = route.query.game
    if (q != null && String(q).trim()) return String(q).trim()
    const p = getPersistedGameId()
    if (p) return p
    return 'test1'
  })

  /** `= # ? &` у значенні `?game=` ламають або плутають посилання (наприклад `test=4`). */
  const GAME_ID_UNSAFE = /[=#?&]/
  const gameIdHasUnsafeChars = computed(() => GAME_ID_UNSAFE.test(gameId.value))

  const playerId = computed(() => normalizePlayerSlotId(route.query.player))

  const modeLabel = computed(() => {
    if (hostModeRequested.value && !authLoaded.value) return t('control.modeHostLoading')
    if (adminAccessDenied.value) return t('control.accessDenied')
    if (isAdmin.value) return t('control.modeHost')
    return t('control.modePlayer')
  })

  const overlayHrefGlobal = computed(() => ({
    name: 'eat',
    query: { view: 'overlay', game: gameId.value },
  }))

  const overlayHrefPersonal = computed(() => ({
    name: 'eat',
    query: { view: 'overlay', game: gameId.value, player: playerId.value },
  }))

  const draftGameId = ref('')

  watch(
    gameId,
    (g) => {
      draftGameId.value = g
      setPersistedGameId(g)
    },
    { immediate: true },
  )

  watch([gameId, playerId, isAdmin], ([gid, pid, adm]) => {
    if (adm || !gid || !pid) return
    saveLastPlayerSlot(gid, pid)
  })

  return {
    hostModeRequested,
    sessionCanHost,
    isAdmin,
    adminAccessDenied,
    gameId,
    GAME_ID_UNSAFE,
    gameIdHasUnsafeChars,
    playerId,
    modeLabel,
    overlayHrefGlobal,
    overlayHrefPersonal,
    draftGameId,
  }
}
