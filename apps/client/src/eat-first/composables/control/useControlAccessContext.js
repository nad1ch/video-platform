import { computed, ref, watch } from 'vue'
import { ADMIN_KEY, HOST_PANEL_QUERY_KEY, HOST_PANEL_QUERY_VALUE } from '../../config/access.js'
import { createLogger } from '@/utils/logger'
import { callableApiEnabled } from '../../api/callableApi.js'
import { ensureAnonymousAuth } from '../../services/authBootstrap.js'
import { callLinkPlayerSlot } from '../../api/callableClient.js'
import { getPersistedGameId, setPersistedGameId } from '../../utils/persistedGameId.js'
import {
  saveLastPlayerSlot,
} from '../../utils/persistedPlayerSlot.js'
import { getValidatedPersistedHostKey } from '../../utils/persistedHostSession.js'
import { normalizePlayerSlotId } from '../../utils/playerSlot.js'
import { getJoinSessionToken } from '../../utils/joinSessionToken.js'

const controlAccessLog = createLogger('control:access')

/**
 * Host/player gate, game & slot identity from route, overlay links, join linking.
 * `playerSlotAccessBlocked` stays in the orchestrator (depends on join-gate refs).
 */
export function useControlAccessContext({ route, t }) {
  /** Пульт ведучого: ?host=1 або застарілі закладки ?role=admin (без key у нових посиланнях). */
  const hostModeRequested = computed(
    () =>
      String(route.query[HOST_PANEL_QUERY_KEY] ?? '').trim() === HOST_PANEL_QUERY_VALUE ||
      String(route.query.role ?? '').toLowerCase() === 'admin',
  )
  const urlKey = computed(() => {
    const q = String(route.query.key ?? '').trim()
    if (q !== '') return q
    if (hostModeRequested.value) {
      const p = getValidatedPersistedHostKey(ADMIN_KEY)
      return p ?? ''
    }
    return ''
  })
  const adminKeyOk = computed(() => urlKey.value === ADMIN_KEY)
  const isAdmin = computed(() => hostModeRequested.value && adminKeyOk.value)
  const adminAccessDenied = computed(() => hostModeRequested.value && !adminKeyOk.value)

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
    if (adminAccessDenied.value) return t('control.accessDenied')
    if (isAdmin.value) return t('control.modeHost')
    return t('control.modePlayer')
  })

  /** Після deploy Callable: зв’язати anonymous uid зі слотом за joinToken (з URL або session). */
  watch(
    () => ({
      gid: gameId.value,
      pid: playerId.value,
      adm: isAdmin.value,
      denied: adminAccessDenied.value,
      tokenQ: String(route.query.token ?? '').trim(),
      useFn: callableApiEnabled(),
    }),
    async ({ gid, pid, adm, denied, tokenQ, useFn }) => {
      if (!useFn || denied || adm || !gid || !pid) return
      const tok = tokenQ || getJoinSessionToken(gid, pid)
      if (!tok) return
      try {
        await ensureAnonymousAuth()
        await callLinkPlayerSlot(gid, pid, tok)
      } catch (e) {
        controlAccessLog.warn('linkPlayerSlot', e)
      }
    },
    { immediate: true, flush: 'post' },
  )

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
    urlKey,
    adminKeyOk,
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
