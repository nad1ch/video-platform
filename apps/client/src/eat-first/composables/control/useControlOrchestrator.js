/**
 * Control page orchestrator: composes access + URL helpers + core setup (Firestore, voting, editor, …).
 */
import { createLogger } from '@/utils/logger'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { eatViewFromRoute } from '../../state/eatFirstRouteUtils.js'
import { useI18n } from 'vue-i18n'
import { useControlAccessContext } from './useControlAccessContext.js'
import { useControlUrlPersistence } from './useControlUrlPersistence.js'
import { useControlFirestoreRoom } from './useControlFirestoreRoom.js'
import {
  rollFieldValue,
  rollRandomIntoCharacter,
  randomPlayerAgeString,
  genders,
  pickNameForGender,
  createEmptyUsedState,
  mergePlayerDataIntoUsedState,
  traitExcludeSetFromPlayers,
  activeTemplateExcludeSetFromPlayers,
} from '../../data/randomPools.js'
import { scenarioIds } from '../../data/scenarios.js'
import {
  characterState,
  CORE_FIELD_KEYS,
  fieldConfig,
  applyRemoteCharacterData,
  snapshotCharacter,
} from '../../characterState'
import { pickRandomActiveCardTemplateAvoiding } from '../../data/activeCards.js'
import { applyActiveCardEffect } from '../../services/activeCardEffects.js'
import {
  saveCharacter,
  fetchCharacter,
  subscribeToCharacter,
  saveGameRoom,
  applyGlobalAction,
  startSpeakingTimer,
  clearSpeakingTimer,
  pauseSpeakingTimer,
  resumeSpeakingTimer,
  resetGameRoomControls,
  setGamePhase,
  regenerateAllPlayersRandom,
  regenerateAllPlayersActiveCards,
  createFirstNRandomPlayers,
  regeneratePlayerActiveCard,
  setGameNominations,
  nominationsFromRoom,
  nomineeTargetsInNominationOrder,
  setRoomVoting,
  setGameHandRaised,
  clearAllVotes,
  deleteVoteDoc,
  setRoomRound,
  clearAllHands,
  setPlayerReady,
  saveVote,
  ensureGameRoomExists,
  seedMissingStandardPlayers,
  ensurePlayerCharacterExists,
  removePlayerFromGameRoomState,
  deletePlayerDocument,
  reviveAllEliminatedPlayers,
} from '../../services/gameService'
import { millisFromFirestore } from '../../utils/firestoreTime.js'
import { formatGenderDisplay } from '../../utils/genderDisplay.js'
import { playRevealFlipSound, playVoteSubmitSound } from '../../utils/voteUiSound.js'
import { syncHostControlChrome, clearHostControlChrome } from '../hostControlChrome.js'
import { debugDelete } from '../../utils/debugDelete.js'
import { normalizePlayerSlotId } from '../../utils/playerSlot.js'
import { clearHostAccessSession } from '../../utils/persistedHostSession.js'
import { getJoinSessionToken } from '../../utils/joinSessionToken.js'
import {
  saveLastPlayerSlot,
  getValidatedLastPlayerSlot,
  routeHasExplicitPlayerSlot,
} from '../../utils/persistedPlayerSlot.js'
import {
  loadHostSessionStats,
  saveHostSessionStats,
  clearHostSessionStats,
} from '../../utils/hostSessionStatsStorage.js'
import { deleteField } from 'firebase/firestore'

const controlOrchLog = createLogger('control:orchestrator')

export function useControlOrchestrator() {
  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n()

  const {
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
  } = useControlAccessContext({ route, t })

  const { controlQuery, navigateQuery } = useControlUrlPersistence({
    route,
    router,
    gameId,
    isAdmin,
    adminAccessDenied,
  })

  const bootstrappedControl = ref(false)

  let unsubCharacter = null
  function teardownCharacter() {
    if (unsubCharacter) {
      unsubCharacter()
      unsubCharacter = null
    }
  }

  const {
    gameRoom,
    allPlayers,
    lastPlayersFirestoreList,
    pendingPlayerDeletes,
    antiGhostPlayerUntil,
    ANTI_GHOST_PLAYER_MS,
    votes,
    gotGameRoomSnap,
    gotPlayersSnap,
    teardownGamePlayersVotesListeners,
    applyPlayerListFromFirestore,
    pruneAntiGhostPlayerUntil,
    activeAntiGhostPlayerSlots,
    reconcilePendingDeletesWithSnapshot,
  } = useControlFirestoreRoom({
    gameId,
    isAdmin,
    adminAccessDenied,
    bootstrappedControl,
    onTeardownCharacter: teardownCharacter,
  })

const syncing = ref(false)
/** Не ставити в чергу autosave одразу після підстановки даних з Firestore (інакше зайві Write / WebChannel). */
const skipRemoteAutosave = ref(false)
/** Перший snap персонажа з Firestore (лоадер на панелі). */
const panelHydrating = ref(false)
/** Для гравця: joinToken з того ж документа що й персонаж (захист пульта). */
const playerDocJoinToken = ref('')
const playerJoinGateReady = ref(false)
const loadError = ref(null)
const newPlayerId = ref('')

const playerSlotAccessBlocked = computed(() => {
  if (isAdmin.value || adminAccessDenied.value) return false
  if (!playerJoinGateReady.value || !playerId.value) return false
  const st = playerDocJoinToken.value
  if (!st) return false
  const urlT = String(route.query.token ?? '').trim()
  const sess = getJoinSessionToken(gameId.value, playerId.value)
  return urlT !== st && sess !== st
})

const PLAYER_SLOTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']
const PHASE_OPTIONS = ['intro', 'discussion', 'voting', 'final']

/** Порядок колонок на екрані гравця (широкий layout). */
const PLAYER_TRAIT_COL_LEFT = fieldConfig.filter((f) =>
  ['profession', 'health', 'phobia'].includes(f.key),
)
const PLAYER_TRAIT_COL_RIGHT = fieldConfig.filter((f) =>
  ['luggage', 'fact', 'quirk'].includes(f.key),
)

const selectedScenario = ref('classic_crash')
const timerSpeakerSlot = ref('p1')
const speakingDuration = ref(30)
const globalFieldPick = ref('profession')

const scenarioMenuOptions = computed(() =>
  scenarioIds.map((sid) => ({ value: sid, label: t(`scenarios.${sid}.label`) })),
)
const fieldMenuOptions = computed(() =>
  fieldConfig.map((row) => ({ value: row.key, label: t(`traits.${row.key}`) })),
)

const toast = ref('')
let toastTimer = null

const tick = ref(Date.now())
let tickTimer = null

onMounted(() => {
  tickTimer = window.setInterval(() => {
    tick.value = Date.now()
  }, 250)
  nextTick(() => {
    if (eatViewFromRoute(route) !== 'control' || hostModeRequested.value) return
    const q = route.query
    if (routeHasExplicitPlayerSlot(q)) {
      saveLastPlayerSlot(gameId.value, playerId.value)
      return
    }
    const last = getValidatedLastPlayerSlot(gameId.value)
    if (last) {
      router.replace({
        name: 'eat',
        query: { ...q, view: 'control', player: last },
      })
      return
    }
    saveLastPlayerSlot(gameId.value, playerId.value)
  })
})

const personalUrlAbsolute = computed(() => {
  const h = router.resolve(overlayHrefPersonal.value).href
  if (typeof window === 'undefined') return h
  return new URL(h, window.location.origin).href
})

const globalUrlAbsolute = computed(() => {
  const h = router.resolve(overlayHrefGlobal.value).href
  if (typeof window === 'undefined') return h
  return new URL(h, window.location.origin).href
})

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2400)
}

async function copyPersonal() {
  try {
    await navigator.clipboard.writeText(personalUrlAbsolute.value)
    showToast(t('toast.copied'))
  } catch {
    showToast(t('toast.copyError'))
  }
}

async function copyGlobal() {
  try {
    await navigator.clipboard.writeText(globalUrlAbsolute.value)
    showToast(t('toast.copied'))
  } catch {
    showToast(t('toast.copyError'))
  }
}

function cleanupSubs() {
  teardownGamePlayersVotesListeners()
  if (unsubCharacter) {
    unsubCharacter()
    unsubCharacter = null
  }
  votes.value = []
}

const suggestedNextPlayerId = computed(() => {
  const ids = new Set(allPlayers.value.map((p) => String(p.id)))
  for (const s of PLAYER_SLOTS) {
    if (!ids.has(s)) return s
  }
  let n = 11
  while (ids.has(`p${n}`)) n++
  return `p${n}`
})

const aliveCount = computed(
  () => allPlayers.value.filter((p) => p.eliminated !== true).length,
)

const roomRoundLive = computed(() =>
  Math.min(8, Math.max(1, Math.floor(Number(gameRoom.value?.round) || 1))),
)

const votesLiveRound = computed(() =>
  votes.value.filter((v) => Number(v.round) === roomRoundLive.value),
)

const allPlayersVoted = computed(
  () =>
    Boolean(gameRoom.value?.voting?.active) &&
    aliveCount.value > 0 &&
    votesLiveRound.value.length === aliveCount.value,
)

const nominationsList = computed(() => nominationsFromRoom(gameRoom.value))

const nominatedPlayerActive = computed(() => nominationsList.value.length > 0)

/** Чекбокси ростера для масового видалення */
const bulkSelectedSlots = ref([])

function rosterSlotNum(id) {
  const s = String(id ?? '')
  const m = s.match(/^p(\d+)$/i)
  if (m) return m[1]
  return s.replace(/^p/i, '') || s
}

const rosterOrderHint = computed(() => {
  const parts = []
  const done = gameRoom.value?.voteTargetsThisRound
  if (Array.isArray(done) && done.length) {
    parts.push(
      t('roster.voteTargetsDoneThisRound', {
        list: done.map((id) => rosterSlotNum(id)).join(', '),
      }),
    )
  }
  const q = gameRoom.value?.voting?.ballotQueue
  if (Array.isArray(q) && q.length) {
    parts.push(
      t('roster.ballotQueueLive', {
        order: q.map((id) => rosterSlotNum(id)).join(' → '),
      }),
    )
  }
  const nom = nomineeTargetsInNominationOrder(nominationsList.value)
  if (nom.length) {
    const alive = new Set(
      allPlayers.value.filter((p) => p.eliminated !== true).map((p) => normalizePlayerSlotId(p.id)),
    )
    const nums = nom.filter((id) => alive.has(normalizePlayerSlotId(id))).map((id) => rosterSlotNum(id))
    if (nums.length) parts.push(t('roster.nominationOrderHint', { order: nums.join(' → ') }))
  }
  if (
    Array.isArray(q) &&
    q.length &&
    String(gameRoom.value?.voting?.ballotSource || '') === 'manual' &&
    nomineeTargetsInNominationOrder(nominationsList.value).length
  ) {
    parts.push(t('roster.manualBallotLastNomHint'))
  }
  return parts.filter(Boolean).join(' · ')
})

const votesLiveRoundVoterIds = computed(() => {
  const rr = roomRoundLive.value
  return votes.value.filter((v) => Number(v.round) === rr).map((v) => normalizePlayerSlotId(v.id))
})

const isLastNominationBallotSlot = computed(() => {
  const v = gameRoom.value?.voting
  if (!v?.active || !Array.isArray(v.ballotQueue) || !v.ballotQueue.length) return false
  const alive = new Set(
    allPlayers.value.filter((p) => p.eliminated !== true).map((p) => normalizePlayerSlotId(p.id)),
  )
  const nom = nomineeTargetsInNominationOrder(nominationsList.value).filter((id) =>
    alive.has(normalizePlayerSlotId(id)),
  )
  const L = nom.length ? normalizePlayerSlotId(nom[nom.length - 1]) : ''
  if (!L) return false
  const q = v.ballotQueue.map(normalizePlayerSlotId)
  if (q[q.length - 1] !== L) return false
  const idx = Math.max(0, Math.min(q.length - 1, Number(v.ballotIndex) || 0))
  const tp = normalizePlayerSlotId(String(v.targetPlayer || '').trim())
  return idx === q.length - 1 && tp === L
})

function onToggleBulkSelection({ id, checked }) {
  if (!isAdmin.value) return
  const p = normalizePlayerSlotId(id)
  const s = new Set(bulkSelectedSlots.value.map((x) => normalizePlayerSlotId(x)))
  if (checked) s.add(p)
  else s.delete(p)
  bulkSelectedSlots.value = [...s].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

function clearBulkSelection() {
  bulkSelectedSlots.value = []
}

function askBulkDeletePlayers() {
  const ids = [...bulkSelectedSlots.value]
  if (!ids.length || !isAdmin.value) return
  openHostGenConfirm(
    t('control.bulkDeleteTitle'),
    t('control.bulkDeleteConfirm', { slots: ids.join(', ') }),
    () => hostExecuteBulkDeletePlayers(ids),
  )
}

async function hostExecuteBulkDeletePlayers(idsRaw) {
  if (!isAdmin.value) return
  const ids = [...new Set(idsRaw.map((x) => normalizePlayerSlotId(x)).filter(Boolean))]
  if (!ids.length) return
  clearTimeout(saveTimer)
  saveTimer = null
  const idSet = new Set(ids)
  try {
    loadError.value = null
    pendingPlayerDeletes.value = [...new Set([...pendingPlayerDeletes.value, ...ids])]
    applyPlayerListFromFirestore(lastPlayersFirestoreList.value)
    for (const p of ids) {
      await removePlayerFromGameRoomState(gameId.value, p)
      await deletePlayerDocument(gameId.value, p)
      const editorWasOnDeletedSlot =
        normalizePlayerSlotId(editorPlayerId.value) === p ||
        String(selectedDeskPlayerId.value || '').trim() === p
      if (editorWasOnDeletedSlot) slotsToSkipPersistOnSwitch.add(p)
      antiGhostPlayerUntil.value = {
        ...antiGhostPlayerUntil.value,
        [p]: Date.now() + ANTI_GHOST_PLAYER_MS,
      }
      applyPlayerListFromFirestore(lastPlayersFirestoreList.value)
    }
    for (const p of ids) {
      if (String(selectedDeskPlayerId.value) === p) selectedDeskPlayerId.value = ''
    }
    const curPid = normalizePlayerSlotId(playerId.value)
    if (idSet.has(curPid)) {
      const fallback = PLAYER_SLOTS.find((slot) => !idSet.has(slot)) || 'p1'
      navigateQuery({ player: fallback })
    }
    bulkSelectedSlots.value = []
    showToast(t('toast.playersBulkDeleted', { n: ids.length }))
  } catch (e) {
    pendingPlayerDeletes.value = pendingPlayerDeletes.value.filter((x) => !idSet.has(x))
    applyPlayerListFromFirestore(lastPlayersFirestoreList.value)
    const msg = e instanceof Error ? e.message : String(e)
    loadError.value = msg
    showToast(msg)
  }
}

async function hostApplyBallotFromNominations() {
  if (!isAdmin.value) return
  const alive = new Set(
    allPlayers.value.filter((p) => p.eliminated !== true).map((p) => normalizePlayerSlotId(p.id)),
  )
  const order = nomineeTargetsInNominationOrder(nominationsList.value).filter((t) =>
    alive.has(normalizePlayerSlotId(t)),
  )
  if (!order.length) {
    showToast(t('toast.noNomineesForBallot'))
    return
  }
  try {
    loadError.value = null
    const curV =
      gameRoom.value?.voting && typeof gameRoom.value.voting === 'object'
        ? { ...gameRoom.value.voting }
        : {}
    const ballotRunId = `run-${Date.now()}`
    const slotDur = Math.max(1, Math.floor(Number(curV.slotDurationSec) || 5))
    await saveGameRoom(gameId.value, {
      voting: {
        ...curV,
        active: false,
        targetPlayer: order[0],
        ballotQueue: order,
        ballotIndex: 0,
        ballotRunId,
        ballotRound: roomRoundLive.value,
        ballotSource: 'nominations',
        slotDurationSec: slotDur,
        voteSlotStartedAt: deleteField(),
      },
    })
    showToast(t('toast.ballotOrderSet', { count: order.length }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

const selectedDeskPlayerId = ref('')

watch(gameId, () => {
  selectedDeskPlayerId.value = ''
  bulkSelectedSlots.value = []
})

/** Після зміни гри / URL слоту підтягуємо вибір ростера (без повного remount сторінки). */
watch(
  [isAdmin, playerId, gameId],
  () => {
    if (!isAdmin.value) return
    const pid = playerId.value
    if (selectedDeskPlayerId.value !== pid) {
      selectedDeskPlayerId.value = pid
    }
  },
  { immediate: true, flush: 'post' },
)

/** Документ гравця для редактора: у ведучого — вибраний слот у ростері, інакше з URL. */
const editorPlayerId = computed(() => {
  if (!isAdmin.value) return playerId.value
  const sel = String(selectedDeskPlayerId.value || '').trim()
  return sel ? normalizePlayerSlotId(sel) : playerId.value
})

/** Є документ у Firestore для обраного слота (кубик і автосейв мають сенс лише тоді). */
const editorPlayerInRoster = computed(() =>
  allPlayers.value.some(
    (p) => normalizePlayerSlotId(p.id) === normalizePlayerSlotId(editorPlayerId.value),
  ),
)

const raisedHandsCount = computed(() => {
  const h = gameRoom.value?.hands || {}
  return Object.keys(h).filter((k) => h[k] === true).length
})

const playersReadyMap = computed(() => {
  const r = gameRoom.value?.playersReady
  if (!r || typeof r !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(r)) {
    if (v === true) out[String(k)] = true
  }
  return out
})

const alivePlayersCount = computed(() => allPlayers.value.filter((p) => p.eliminated !== true).length)

const readyPlayersCount = computed(
  () =>
    allPlayers.value.filter((p) => p.eliminated !== true && playersReadyMap.value[String(p.id)] === true)
      .length,
)

const allAlivePlayersReady = computed(
  () => alivePlayersCount.value > 0 && readyPlayersCount.value === alivePlayersCount.value,
)

const playerPhaseDisplay = computed(() => {
  const p = String(gameRoom.value?.gamePhase || 'intro')
  const pk = `gamePhase.${p}`
  return te(pk) ? t(pk) : p
})

/** Sticky рядок: фаза, раунд, спікер, ціль, голосування, руки */
const hostSummaryLine = computed(() => {
  const phRaw = String(gameRoom.value?.gamePhase || 'intro')
  const pk = `gamePhase.${phRaw}`
  const ph = (te(pk) ? t(pk) : phRaw).toUpperCase()
  const r = roomRoundLive.value
  const sp = String(gameRoom.value?.currentSpeaker ?? '').trim() || '—'
  const tg = String(gameRoom.value?.voting?.targetPlayer ?? '').trim()
  const tgTxt = tg ? t('hostChrome.summaryTargetLine', { slot: tg }) : t('hostChrome.summaryTargetNone')
  const v = gameRoom.value?.voting?.active ? t('hostChrome.votingOn') : t('hostChrome.votingOff')
  const hc = raisedHandsCount.value
  const alive = alivePlayersCount.value
  const rd = readyPlayersCount.value
  const readySeg =
    alive > 0
      ? allAlivePlayersReady.value
        ? t('hostChrome.summaryAllReady', { n: rd, m: alive })
        : t('hostChrome.summaryReady', { n: rd, m: alive })
      : ''
  return `${ph} · R${r} · ${sp} · ${tgTxt} · ${v} · ✋ ${hc}${readySeg ? ` · ${readySeg}` : ''}`
})

watch(
  () => gameRoom.value?.activeScenario,
  (a) => {
    if (typeof a === 'string' && a && scenarioIds.includes(a) && selectedScenario.value !== a) {
      selectedScenario.value = a
    }
  },
)

watch(
  () => String(gameRoom.value?.currentSpeaker ?? '').trim(),
  (c) => {
    if (c && PLAYER_SLOTS.includes(c)) timerSpeakerSlot.value = c
  },
  { immediate: true },
)

const scenarioForRolls = computed(
  () => String(gameRoom.value?.activeScenario || selectedScenario.value || 'classic_crash'),
)

const myStatusLabel = computed(() => {
  if (characterState.eliminated) return t('status.eliminated')
  const sp = String(gameRoom.value?.currentSpeaker ?? '').trim()
  if (sp && sp === playerId.value) return t('status.speaking')
  const ap = String(gameRoom.value?.activePlayer ?? '').trim()
  if (ap && ap === playerId.value) return t('status.spotlight')
  return t('status.waiting')
})

const hostTimerRemaining = computed(() => {
  const gr = gameRoom.value
  if (gr?.timerPaused === true) {
    const f = Number(gr?.timerRemainingFrozen)
    if (Number.isFinite(f) && f >= 0) return f
    return null
  }
  const start = millisFromFirestore(gr?.timerStartedAt)
  const total = Number(gr?.speakingTimer) || 0
  if (start == null || total <= 0) return null
  const elapsed = Math.floor((tick.value - start) / 1000)
  return Math.max(0, total - elapsed)
})

watch(hostTimerRemaining, async (left, prev) => {
  if (gameRoom.value?.timerPaused === true) return
  if (left !== 0) return
  if (prev === null || prev === undefined || prev === 0) return
  const gr = gameRoom.value
  if (!(Number(gr?.speakingTimer) > 0)) return
  try {
    await clearSpeakingTimer(gameId.value)
  } catch (e) {
    controlOrchLog.error('[autoClearSpeaker]', e)
  }
})

async function persistScenarioChoice() {
  if (!isAdmin.value) return
  try {
    await saveGameRoom(gameId.value, { activeScenario: selectedScenario.value })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function controlStartRound() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await setGamePhase(gameId.value, 'discussion')
    showToast(t('toast.phaseDiscussion'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function controlPauseShow() {
  if (!isAdmin.value) return
  const r = hostTimerRemaining.value
  try {
    loadError.value = null
    if (r != null && r >= 0 && gameRoom.value?.timerPaused !== true) {
      await pauseSpeakingTimer(gameId.value, r)
      showToast(t('toast.timerPaused'))
    } else if (gameRoom.value?.timerPaused === true) {
      showToast(t('toast.alreadyPaused'))
    } else {
      showToast(t('toast.timerInactive'))
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function controlReset() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await resetGameRoomControls(gameId.value)
    clearHostSessionStats(gameId.value)
    hostSessionStats.value = { v: 1, voteSessions: [], handRaises: {} }
    prevHandsForStats.value = null
    showToast(t('toast.roomReset'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function adminStartSpeakingTimer() {
  if (!isAdmin.value) return
  const slot = String(timerSpeakerSlot.value || 'p1').trim() || 'p1'
  const sec = Number(speakingDuration.value) || 30
  try {
    loadError.value = null
    await startSpeakingTimer(gameId.value, slot, sec)
    showToast(t('toast.slotTimer', { slot, sec }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function adminPauseTimerOnly() {
  const r = hostTimerRemaining.value
  if (r == null) {
    showToast(t('toast.noActiveTimer'))
    return
  }
  try {
    await pauseSpeakingTimer(gameId.value, r)
    showToast(t('toast.pause'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function adminResumeTimer() {
  try {
    await resumeSpeakingTimer(gameId.value)
    showToast(t('toast.resumed'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function adminClearTimer() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await clearSpeakingTimer(gameId.value)
    showToast(t('toast.speakerCleared'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function setPhase(ph) {
  if (!isAdmin.value) return
  try {
    await setGamePhase(gameId.value, ph)
    showToast(t('toast.phaseNamed', { phase: ph }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function setSpotlightPlayer(slot) {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    if (slot === '' || slot == null) {
      await saveGameRoom(gameId.value, { activePlayer: '' })
      return
    }
    const cur = String(gameRoom.value?.activePlayer ?? '').trim()
    const next = cur === slot ? '' : slot
    await saveGameRoom(gameId.value, { activePlayer: next })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

function eliminatedBySlot() {
  const m = Object.create(null)
  for (const p of allPlayers.value) {
    m[String(p.id)] = p.eliminated === true
  }
  return m
}

/** Лише стан з Firestore — без оптимістичного UI (ведучий може скинути руки, гравець має одразу бачити). */
const myHandRaised = computed(() => gameRoom.value?.hands?.[playerId.value] === true)

const myPlayerReady = computed(() => playersReadyMap.value[String(playerId.value)] === true)

function characterReadsFemale() {
  const d = formatGenderDisplay(characterState.gender)
  if (d === 'Жінка') return true
  const s = String(characterState.gender ?? '')
    .trim()
    .toLowerCase()
  return (
    s.includes('жін') ||
    s.includes('woman') ||
    s.includes('female') ||
    s.includes('kobieta') ||
    s === 'f'
  )
}

/** Текст кнопки готовності (зелений / червоний) з урахуванням статі персонажа. */
const playerReadyPillLabel = computed(() => {
  const fem = characterReadsFemale()
  if (myPlayerReady.value) {
    return fem ? t('control.readyOnF') : t('control.readyOnM')
  }
  return fem ? t('control.readyOffF') : t('control.readyOffM')
})

async function setMyHandRaised(raised) {
  const up = gameRoom.value?.hands?.[playerId.value] === true
  if (up === raised) return
  try {
    loadError.value = null
    await setGameHandRaised(gameId.value, playerId.value, raised)
    showToast(raised ? t('toast.handRaised') : t('toast.handLowered'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function setMyPlayerReady(ready) {
  if (isAdmin.value) return
  if (characterState.eliminated) return
  const up = playersReadyMap.value[String(playerId.value)] === true
  if (up === ready) return
  try {
    loadError.value = null
    await setPlayerReady(gameId.value, playerId.value, ready)
    showToast(ready ? t('toast.playerReadyOn') : t('toast.playerReadyOff'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

const playerVotingTargetId = computed(() =>
  String(gameRoom.value?.voting?.targetPlayer ?? '').trim(),
)

const showPlayerVotingUi = computed(
  () =>
    !isAdmin.value &&
    Boolean(gameRoom.value?.voting?.active) &&
    playerVotingTargetId.value.length > 0 &&
    characterState.eliminated !== true,
)

const playerHasVotedThisRound = computed(() =>
  votes.value.some(
    (v) =>
      String(v.id) === String(playerId.value) && Number(v.round) === roomRoundLive.value,
  ),
)

const playerVoteSlotLabel = computed(() => {
  const id = playerVotingTargetId.value
  const m = id.match(/^p(\d+)$/i)
  return m ? m[1] : id.replace(/^p/i, '') || id
})

const playerIsVotingTarget = computed(
  () => showPlayerVotingUi.value && String(playerId.value) === playerVotingTargetId.value,
)

const playerVoteBusy = ref(false)

async function submitPlayerVote(choice) {
  if (isAdmin.value) return
  if (!showPlayerVotingUi.value || playerHasVotedThisRound.value || playerVoteBusy.value) return
  const gid = gameId.value
  const voter = playerId.value
  const target = playerVotingTargetId.value
  const rr = roomRoundLive.value
  playerVoteBusy.value = true
  try {
    loadError.value = null
    const res = await saveVote(gid, voter, target, choice, rr)
    if (res.ok) {
      playVoteSubmitSound(0.14)
      showToast(t('toast.voteRecorded'))
    } else if (res.reason === 'already-voted') {
      showToast(t('toast.alreadyVoted'))
    } else if (res.reason === 'not-linked') {
      showToast(t('toast.voteNotLinked'))
    } else {
      showToast(t('toast.voteSendFail'))
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    playerVoteBusy.value = false
  }
}

function revealDemographics(open) {
  if (!open && !isAdmin.value && characterState.demographicsRevealed) {
    showToast(t('toast.revealCannotCloseProfile'))
    return
  }
  if (open && !isAdmin.value) {
    if (characterState.demographicsRevealed) return
    const ledger = syncRevealLedgerForOpenAttempt()
    const rr = roomRoundLive.value
    const profOpen = Boolean(characterState.profession?.revealed)
    if (rr === 1 && !profOpen) {
      showToast(t('toast.revealProfessionFirst'))
      return
    }
    if (ledger.count >= ledger.maxForRound) {
      showToast(t('toast.revealRoundLimit', { round: rr }))
      return
    }
    ledger.count += 1
  }
  if (open) playRevealFlipSound(0.09)
  characterState.demographicsRevealed = open
  characterState.identityRevealed = open
}

/** Ліміт «слотів» відкриття за раунд (гравець): 6 характеристик + профіль (вік/стать) — кожен слот з ліміту. Раунд 1: два слоти (спочатку професія). Далі: один. */
function computeRevealMaxForRound(rr) {
  if (rr === 1) return 2
  return 1
}

/** Скільки з CORE_FIELD_KEYS зараз відкрито (для узгодження лічильника з Firestore). */
function countRevealedCoreTraits() {
  return CORE_FIELD_KEYS.filter((k) => characterState[k]?.revealed === true).length
}

/** Слоти відкриття: картки + показ профілю (оверлей). */
function countPlayerRevealSlotsUsed() {
  return countRevealedCoreTraits() + (characterState.demographicsRevealed ? 1 : 0)
}

/**
 * Після зміни полів / завантаження: count не може бути більшим за фактично відкриті слоти
 * (картки + профіль), інакше лічильник з БД блокує відкриття в тому ж раунді.
 */
function reconcilePlayerRevealLedgerCount() {
  if (isAdmin.value) return
  const rr = roomRoundLive.value
  const L = characterState.revealLedger
  if (!L || typeof L !== 'object') return
  if (L.round !== rr) return
  const nUsed = countPlayerRevealSlotsUsed()
  if (L.count > nUsed) L.count = nUsed
  L.maxForRound = computeRevealMaxForRound(rr)
}

/** Синхронізує лічильник відкриттів з поточним раундом кімнати (гравець). */
function syncRevealLedgerForOpenAttempt() {
  const rr = roomRoundLive.value
  const maxForRound = computeRevealMaxForRound(rr)
  const cur = characterState.revealLedger
  if (!cur || typeof cur !== 'object') {
    characterState.revealLedger = { round: rr, count: 0, maxForRound }
    reconcilePlayerRevealLedgerCount()
    return characterState.revealLedger
  }
  if (cur.round !== rr || !(cur.maxForRound >= 1)) {
    characterState.revealLedger = { round: rr, count: 0, maxForRound }
    reconcilePlayerRevealLedgerCount()
    return characterState.revealLedger
  }
  cur.maxForRound = maxForRound
  reconcilePlayerRevealLedgerCount()
  return cur
}

function revealTrait(key, open) {
  const slot = characterState[key]
  if (!slot || typeof slot !== 'object') return

  if (!CORE_FIELD_KEYS.includes(key)) {
    if (open) playRevealFlipSound(0.09)
    slot.revealed = open
    return
  }

  if (!open) {
    if (!isAdmin.value && CORE_FIELD_KEYS.includes(key) && slot.revealed) {
      showToast(t('toast.revealCannotCloseTrait'))
      return
    }
    playRevealFlipSound(0.09)
    slot.revealed = false
    return
  }

  if (slot.revealed) return

  if (isAdmin.value) {
    playRevealFlipSound(0.09)
    slot.revealed = true
    return
  }

  const ledger = syncRevealLedgerForOpenAttempt()
  const rr = roomRoundLive.value
  const profOpen = Boolean(characterState.profession?.revealed)

  if (rr === 1 && key !== 'profession' && !profOpen) {
    showToast(t('toast.revealProfessionFirst'))
    return
  }

  if (ledger.count >= ledger.maxForRound) {
    showToast(t('toast.revealRoundLimit', { round: rr }))
    return
  }

  ledger.count += 1
  playRevealFlipSound(0.09)
  slot.revealed = true
}

async function hostToggleNomination({ target, by }) {
  if (!isAdmin.value) return
  const targetSlot = String(target ?? '').trim()
  const bySlot = String(by ?? '').trim()
  if (!targetSlot || !bySlot) return
  try {
    loadError.value = null
    const onePer = Boolean(gameRoom.value?.nominationOneTargetPerRound)
    let cur = nominationsFromRoom(gameRoom.value)
    const exists = cur.some((x) => x.target === targetSlot && x.by === bySlot)
    let next
    if (exists) {
      next = cur.filter((x) => !(x.target === targetSlot && x.by === bySlot))
    } else if (onePer) {
      next = [...cur.filter((x) => x.by !== bySlot), { target: targetSlot, by: bySlot }]
    } else {
      next = [...cur, { target: targetSlot, by: bySlot }]
    }
    await setGameNominations(gameId.value, next)
    showToast(exists ? t('toast.nomRemoved') : t('toast.nomAdded'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function onRosterHostCommand({ type, playerId: pid }) {
  if (!isAdmin.value) return
  const p = String(pid ?? '').trim()
  if (!p) return
  try {
    loadError.value = null
    switch (type) {
      case 'speaker': {
        const cur = String(gameRoom.value?.currentSpeaker ?? '').trim()
        if (cur === p) {
          await clearSpeakingTimer(gameId.value)
          await saveGameRoom(gameId.value, { currentSpeaker: '' })
          showToast(t('toast.speakerCleared'))
        } else {
          timerSpeakerSlot.value = p
          await saveGameRoom(gameId.value, { currentSpeaker: p })
          showToast(t('toast.speakerSet', { slot: p }))
        }
        break
      }
      case 'vote-target': {
        const pid = normalizePlayerSlotId(p)
        const alive = new Set(
          allPlayers.value
            .filter((pl) => pl.eliminated !== true)
            .map((pl) => normalizePlayerSlotId(pl.id)),
        )
        if (!alive.has(pid)) break
        const rr = roomRoundLive.value
        const curV =
          gameRoom.value?.voting && typeof gameRoom.value.voting === 'object'
            ? { ...gameRoom.value.voting }
            : {}
        const active = Boolean(curV.active)
        const noms = nomineeTargetsInNominationOrder(nominationsList.value).filter((id) =>
          alive.has(normalizePlayerSlotId(id)),
        )
        const nomTail = noms.length ? normalizePlayerSlotId(noms[noms.length - 1]) : ''
        let runId = String(curV.ballotRunId || '').trim()
        const prevRound = Number(curV.ballotRound) || 0
        if (!runId || prevRound !== rr) {
          runId = `run-${Date.now()}`
        }
        let q = Array.isArray(curV.ballotQueue)
          ? curV.ballotQueue.map(normalizePlayerSlotId).filter(Boolean)
          : []
        if (nomTail && q.length && q[q.length - 1] === nomTail) {
          q = q.slice(0, -1)
        }
        if (!q.includes(pid)) q.push(pid)
        const seen = new Set()
        q = q.filter((id) => {
          if (seen.has(id)) return false
          seen.add(id)
          return true
        })
        if (nomTail) {
          q = q.filter((id) => id !== nomTail)
          q.push(nomTail)
        }
        const ballotIndex = Math.min(
          Math.max(0, Number(curV.ballotIndex) || 0),
          Math.max(0, q.length - 1),
        )
        const targetPlayer = q[ballotIndex] || q[0] || pid
        await saveGameRoom(gameId.value, {
          voting: {
            ...curV,
            active,
            targetPlayer,
            ballotQueue: q,
            ballotIndex: q.length ? ballotIndex : 0,
            ballotRunId: runId,
            ballotRound: rr,
            ballotSource: 'manual',
          },
        })
        showToast(t('toast.voteTargetSet'))
        break
      }
      case 'spotlight': {
        await setSpotlightPlayer(p)
        break
      }
      case 'reset':
        await hostResetPlayerRoles(p)
        break
      case 'delete-player':
        openHostGenConfirm(
          t('control.deletePlayerTitle'),
          t('control.deletePlayerConfirm', { slot: p }),
          () => hostExecuteDeletePlayer(p),
        )
        break
      case 'eliminate-player': {
        const slot = normalizePlayerSlotId(p)
        const pl = allPlayers.value.find((x) => normalizePlayerSlotId(String(x.id)) === slot)
        if (!pl || pl.eliminated === true) break
        const existing = await fetchCharacter(gameId.value, slot)
        await saveCharacter(gameId.value, slot, {
          ...(existing && typeof existing === 'object' ? existing : {}),
          eliminated: true,
        })
        await setGameHandRaised(gameId.value, slot, false)
        showToast(t('toast.playerEliminatedFromCard', { slot }))
        break
      }
      case 'revive-player': {
        const slot = normalizePlayerSlotId(p)
        const pl = allPlayers.value.find((x) => normalizePlayerSlotId(String(x.id)) === slot)
        if (!pl || pl.eliminated !== true) break
        await saveCharacter(gameId.value, slot, { eliminated: false })
        showToast(t('toast.playerRevived', { slot }))
        break
      }
      default:
        break
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostExecuteDeletePlayer(pid) {
  if (!isAdmin.value) return
  const p = normalizePlayerSlotId(pid)
  if (!p) return
  debugDelete('hostExecuteDeletePlayer:start', {
    gameId: gameId.value,
    slot: p,
    url: typeof window !== 'undefined' ? window.location.href : '',
  })
  pendingPlayerDeletes.value = [...new Set([...pendingPlayerDeletes.value, p])]
  applyPlayerListFromFirestore(lastPlayersFirestoreList.value)
  try {
    clearTimeout(saveTimer)
    saveTimer = null
    loadError.value = null
    debugDelete('hostExecuteDeletePlayer:await removePlayerFromGameRoomState')
    await removePlayerFromGameRoomState(gameId.value, p)
    debugDelete('hostExecuteDeletePlayer:await deletePlayerDocument')
    await deletePlayerDocument(gameId.value, p)
    const editorWasOnDeletedSlot =
      normalizePlayerSlotId(editorPlayerId.value) === p ||
      String(selectedDeskPlayerId.value || '').trim() === p
    if (editorWasOnDeletedSlot) {
      slotsToSkipPersistOnSwitch.add(p)
    }
    antiGhostPlayerUntil.value = {
      ...antiGhostPlayerUntil.value,
      [p]: Date.now() + ANTI_GHOST_PLAYER_MS,
    }
    debugDelete('hostExecuteDeletePlayer:обидва await OK, оновлюємо ростер з lastSnap')
    applyPlayerListFromFirestore(lastPlayersFirestoreList.value)
    if (String(selectedDeskPlayerId.value) === p) {
      selectedDeskPlayerId.value = ''
    }
    if (playerId.value === p) {
      const fallback = PLAYER_SLOTS.find((slot) => slot !== p) || 'p1'
      navigateQuery({ player: fallback })
    }
    showToast(t('toast.playerDeleted', { slot: p }))
    debugDelete('hostExecuteDeletePlayer:успіх (тост показано)')
  } catch (e) {
    debugDelete('hostExecuteDeletePlayer:ПОМИЛКА', {
      name: e instanceof Error ? e.name : '',
      message: e instanceof Error ? e.message : String(e),
      code: typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined,
    })
    pendingPlayerDeletes.value = pendingPlayerDeletes.value.filter((x) => x !== p)
    applyPlayerListFromFirestore(lastPlayersFirestoreList.value)
    const raw = e instanceof Error ? e.message : String(e)
    const msg = raw.startsWith('PLAYER_DOC_NOT_FOUND:')
      ? t('control.deletePlayerDocMissing', { slot: raw.slice('PLAYER_DOC_NOT_FOUND:'.length) })
      : raw
    loadError.value = `${t('control.deletePlayerFailed')}: ${msg}`
    showToast(`${t('control.deletePlayerFailed')}: ${msg}`)
  }
}

async function hostResetPlayerRoles(pid) {
  if (!isAdmin.value) return
  const p = String(pid ?? '').trim()
  if (!p) return
  try {
    loadError.value = null
    const gr = gameRoom.value
    const list = nominationsFromRoom(gr)
    const next = list.filter((x) => x.target !== p && x.by !== p)
    const legacyNom = String(gr?.nominatedPlayer ?? '').trim() === p && list.length === 0
    if (next.length !== list.length || legacyNom) {
      await setGameNominations(gameId.value, next)
    }
    if (String(gr?.voting?.targetPlayer ?? '').trim() === p) {
      await setRoomVoting(gameId.value, false, '', { clearBallot: true })
    }
    if (String(gr?.currentSpeaker ?? '').trim() === p) {
      await clearSpeakingTimer(gameId.value)
    }
    if (String(gr?.activePlayer ?? '').trim() === p) {
      await saveGameRoom(gameId.value, { activePlayer: '' })
    }
    showToast(t('toast.cleared'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostVotingStart() {
  if (!isAdmin.value) return
  let v = gameRoom.value?.voting && typeof gameRoom.value.voting === 'object' ? { ...gameRoom.value.voting } : {}
  const q = v.ballotQueue
  let tp = String(v.targetPlayer ?? '').trim()
  if (Array.isArray(q) && q.length > 0) {
    const idx = Math.max(0, Math.min(q.length - 1, Number(v.ballotIndex) || 0))
    const expected = normalizePlayerSlotId(q[idx])
    if (tp !== expected) {
      tp = expected
      v = { ...v, targetPlayer: tp, ballotIndex: idx, ballotQueue: q }
      try {
        await saveGameRoom(gameId.value, { voting: v })
      } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e)
        return
      }
    }
  }
  if (!tp) {
    showToast(t('toast.pickVoteTarget'))
    return
  }
  try {
    loadError.value = null
    const slotSec = Math.max(1, Math.floor(Number(v.slotDurationSec || gameRoom.value?.voting?.slotDurationSec) || 5))
    await setRoomVoting(gameId.value, true, tp, { slotDurationSec: slotSec })
    showToast(t('toast.votingOpened'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

/** Локальна статистика сесії (localStorage по gameId): голосування + підрахунок підняття рук. */
const hostSessionStats = ref({ v: 1, voteSessions: [], handRaises: {} })

function persistHostStats() {
  saveHostSessionStats(gameId.value, {
    voteSessions: hostSessionStats.value.voteSessions || [],
    handRaises: hostSessionStats.value.handRaises || {},
  })
}

function bumpHandRaiseSlot(pidRaw) {
  if (!isAdmin.value) return
  const pid = normalizePlayerSlotId(pidRaw)
  if (!pid) return
  const hr = { ...(hostSessionStats.value.handRaises || {}) }
  hr[pid] = (hr[pid] || 0) + 1
  hostSessionStats.value = {
    v: 1,
    voteSessions: hostSessionStats.value.voteSessions || [],
    handRaises: hr,
  }
  persistHostStats()
}

/** null = ще не «заряджено» — перший знімок рук без лічильника (щоб не порахувати вже підняті). */
const prevHandsForStats = ref(null)

watch([gameId, isAdmin], () => {
  if (!isAdmin.value) return
  hostSessionStats.value = loadHostSessionStats(gameId.value)
  prevHandsForStats.value = null
}, { immediate: true })

watch(
  () => ({
    admin: isAdmin.value,
    snap: gotGameRoomSnap.value,
    hands: gameRoom.value?.hands,
  }),
  ({ admin, snap, hands }) => {
    if (!admin || !snap) return
    const h = hands && typeof hands === 'object' ? { ...hands } : {}
    if (prevHandsForStats.value === null) {
      prevHandsForStats.value = h
      return
    }
    const prev = prevHandsForStats.value
    for (const [pid, up] of Object.entries(h)) {
      if (up === true && prev[pid] !== true) bumpHandRaiseSlot(pid)
    }
    prevHandsForStats.value = h
  },
  { deep: true },
)

const hostHandRaiseRows = computed(() => {
  const hr = hostSessionStats.value?.handRaises || {}
  const ids = new Set(PLAYER_SLOTS.map((s) => normalizePlayerSlotId(s)))
  for (const k of Object.keys(hr)) ids.add(normalizePlayerSlotId(k))
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((id) => ({ id, n: Math.max(0, Math.floor(Number(hr[id]) || 0)) }))
})

const elimSuggestHandLines = computed(() => {
  const slot = normalizePlayerSlotId(String(elimSuggestSlot.value || '').trim())
  if (!slot) return null
  const hr = hostSessionStats.value.handRaises || {}
  const alive = allPlayers.value.filter((p) => p.eliminated !== true)
  let best = []
  let max = -1
  const ids = alive.map((p) => normalizePlayerSlotId(p.id))
  for (const id of ids) {
    const n = Math.floor(Number(hr[id]) || 0)
    if (n > max) {
      max = n
      best = [id]
    } else if (n === max && n > 0) {
      best.push(id)
    }
  }
  if (max <= 0) return null
  if (best.length === 1 && best[0] === slot) return { key: 'agree' }
  return { key: 'top', list: best.join(', ') }
})

function hostSessionVoteTally(sess) {
  const votes = sess?.votes || []
  let forC = 0
  let ag = 0
  for (const v of votes) {
    if (v.choice === 'against') ag += 1
    else forC += 1
  }
  return { forC, ag }
}

function hostSessionEndedLabel(ts) {
  const n = Math.floor(Number(ts) || 0)
  if (!n) return '—'
  return new Date(n).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function hostClearSessionStatsOnly() {
  if (!isAdmin.value) return
  clearHostSessionStats(gameId.value)
  hostSessionStats.value = { v: 1, voteSessions: [], handRaises: {} }
  showToast(t('toast.sessionStatsCleared'))
}

function sessionVoteForCount(e) {
  let forN = 0
  for (const v of e.votes || []) {
    if (v.choice !== 'against') forN += 1
  }
  return forN
}

function votesPayloadFingerprint(payload) {
  if (!Array.isArray(payload)) return ''
  return [...payload]
    .map((v) => `${normalizePlayerSlotId(v.voter)}:${v.choice === 'against' ? 'a' : 'f'}`)
    .sort()
    .join('|')
}

function aggregateForVotesByTarget(entries) {
  const m = {}
  for (const e of entries) {
    const tid = normalizePlayerSlotId(e.target)
    if (!tid) continue
    const mult = Math.max(1, Math.floor(Number(e.slotCount) || 1))
    const forN = sessionVoteForCount(e)
    m[tid] = (m[tid] || 0) + forN * mult
  }
  return m
}

/** Підсумок 👍 по серії слотів: однозначний лідер, нічия кількох, або немає голосів. */
function analyzeVoteOutcome(tallies) {
  const pairs = Object.entries(tallies).filter(([, n]) => n > 0)
  if (pairs.length === 0) return { kind: 'none' }
  pairs.sort((a, b) => b[1] - a[1])
  const max = pairs[0][1]
  const tops = pairs.filter(([, n]) => n === max).map(([id]) => normalizePlayerSlotId(id))
  if (tops.length >= 2) return { kind: 'tie', slots: tops }
  return { kind: 'winner', slot: tops[0] }
}

/** Порядок переголосування: спочатку як у номінаціях, далі — за номером слота на столі. */
function orderTieSlotsByNominationOrder(slots, nominations, slotOrder) {
  const norm = [...new Set(slots.map((s) => normalizePlayerSlotId(s)))]
  const set = new Set(norm)
  const fromNom = nomineeTargetsInNominationOrder(nominations).filter((s) => set.has(s))
  const rest = norm.filter((s) => !fromNom.includes(s))
  rest.sort((a, b) => {
    const ia = slotOrder.indexOf(a)
    const ib = slotOrder.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return [...fromNom, ...rest]
}

const lastAutoFinishedVoteSlotMs = ref(null)
const ballotSummaryOpen = ref(false)
const ballotSummarySessions = ref([])
const tieBreakOpen = ref(false)
const tieBreakSlots = ref([])

const elimSuggestOpen = ref(false)
const elimSuggestSlot = ref('')
const elimSuggestForVotes = ref(0)

async function hostFinishVoting() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    const vRaw =
      gameRoom.value?.voting && typeof gameRoom.value.voting === 'object' ? gameRoom.value.voting : {}
    const target = String(vRaw.targetPlayer ?? '').trim()
    const ballotQ = vRaw.ballotQueue
    const ballotRunId = String(vRaw.ballotRunId || '')
    const ballotIdx = Number(vRaw.ballotIndex) || 0
    const rr = roomRoundLive.value
    const list = [...votesLiveRound.value]
    const hadNoRealVotes = list.length === 0
    let votesPayload = list.map((v) => ({
      voter: normalizePlayerSlotId(v.id),
      choice: v.choice === 'against' ? 'against' : 'for',
    }))
    let statTarget = target
    if (votesPayload.length === 0 && Array.isArray(ballotQ) && ballotQ.length > 0) {
      const lastSlot = normalizePlayerSlotId(ballotQ[ballotQ.length - 1])
      statTarget = lastSlot
      const aliveIds = allPlayers.value
        .filter((p) => p.eliminated !== true)
        .map((p) => normalizePlayerSlotId(p.id))
      votesPayload = aliveIds.map((voter) => ({ voter, choice: 'for' }))
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      endedAt: Date.now(),
      round: rr,
      target: statTarget || '',
      ballotRunId,
      votes: votesPayload,
    }
    const existingSessions = hostSessionStats.value.voteSessions || []
    const fp = votesPayloadFingerprint(votesPayload)
    const isSyntheticEmptySlot =
      hadNoRealVotes && Array.isArray(ballotQ) && ballotQ.length > 0 && votesPayload.length > 0

    let vs
    if (isSyntheticEmptySlot && ballotRunId) {
      const prev = existingSessions[0]
      const sameTarget = normalizePlayerSlotId(prev?.target) === normalizePlayerSlotId(statTarget)
      const sameVotes =
        prev && votesPayloadFingerprint(prev.votes || []) === fp
      if (
        prev &&
        prev.syntheticEmptyRun === true &&
        String(prev.ballotRunId || '') === ballotRunId &&
        sameTarget &&
        sameVotes
      ) {
        vs = [
          {
            ...prev,
            slotCount: (prev.slotCount || 1) + 1,
            endedAt: Date.now(),
          },
          ...existingSessions.slice(1),
        ].slice(0, 50)
      } else {
        vs = [
          {
            ...entry,
            syntheticEmptyRun: true,
            slotCount: 1,
          },
          ...existingSessions,
        ].slice(0, 50)
      }
    } else {
      vs = [entry, ...existingSessions].slice(0, 50)
    }
    hostSessionStats.value = {
      v: 1,
      voteSessions: vs,
      handRaises: hostSessionStats.value.handRaises || {},
    }
    persistHostStats()
    await appendVoteTargetsThisRound(statTarget)

    if (Array.isArray(ballotQ) && ballotIdx < ballotQ.length - 1) {
      const nextIdx = ballotIdx + 1
      const nextTarget = normalizePlayerSlotId(ballotQ[nextIdx])
      const curVm = { ...vRaw }
      await saveGameRoom(gameId.value, {
        voting: {
          ...curVm,
          active: false,
          targetPlayer: nextTarget,
          ballotQueue: ballotQ,
          ballotIndex: nextIdx,
          voteSlotStartedAt: deleteField(),
        },
      })
      await clearAllVotes(gameId.value)
      showToast(t('toast.votingNextTarget', { slot: nextTarget }))
      return
    }

    await clearAllVotes(gameId.value)

    const sessions = hostSessionStats.value.voteSessions || []
    const runEntries =
      ballotRunId && sessions.length
        ? sessions.filter((s) => String(s.ballotRunId || '') === ballotRunId)
        : [entry]
    const tallies = aggregateForVotesByTarget(runEntries.length ? runEntries : [entry])
    const outcome = analyzeVoteOutcome(tallies)

    if (outcome.kind === 'tie' && outcome.slots.length >= 2) {
      const ordered = orderTieSlotsByNominationOrder(
        outcome.slots,
        nominationsFromRoom(gameRoom.value),
        PLAYER_SLOTS,
      )
      tieBreakSlots.value = ordered
      tieBreakOpen.value = true
      await setGameNominations(gameId.value, [])
      const curVm = { ...vRaw }
      const slotSec = Math.max(5, Math.min(60, Math.floor(Number(curVm.slotDurationSec) || 30)))
      await saveGameRoom(gameId.value, {
        voting: {
          ...curVm,
          active: false,
          targetPlayer: ordered[0],
          ballotQueue: ordered,
          ballotIndex: 0,
          ballotRunId: `tie-${Date.now()}`,
          slotDurationSec: slotSec,
          voteSlotStartedAt: deleteField(),
        },
      })
      showToast(t('toast.votingTiePickDefense'))
      return
    }

    await setRoomVoting(gameId.value, false, '', { clearBallot: true })
    ballotSummarySessions.value = runEntries.length ? runEntries : [entry]
    tieBreakOpen.value = false
    tieBreakSlots.value = []

    if (outcome.kind === 'winner') {
      elimSuggestSlot.value = outcome.slot
      elimSuggestForVotes.value = Math.floor(Number(tallies[outcome.slot]) || 0)
      elimSuggestOpen.value = true
    } else {
      ballotSummaryOpen.value = true
    }
    showToast(t('toast.votingClosed'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

watch(
  () => [
    isAdmin.value,
    gameRoom.value?.voting?.active,
    gameRoom.value?.voting?.voteSlotStartedAt,
    gameRoom.value?.voting?.slotDurationSec,
    tick.value,
  ],
  () => {
    if (!isAdmin.value) return
    const vot = gameRoom.value?.voting
    if (!vot?.active) return
    const start = millisFromFirestore(vot.voteSlotStartedAt)
    if (start == null) return
    const sec = Math.max(1, Number(vot.slotDurationSec) || 5)
    const elapsed = (tick.value - start) / 1000
    if (elapsed < sec) return
    if (lastAutoFinishedVoteSlotMs.value === start) return
    lastAutoFinishedVoteSlotMs.value = start
    void hostFinishVoting()
  },
)

async function hostSetVoteSlotDuration(sec) {
  if (!isAdmin.value) return
  const curV =
    gameRoom.value?.voting && typeof gameRoom.value.voting === 'object'
      ? { ...gameRoom.value.voting }
      : {}
  const n = Math.max(1, Math.floor(Number(sec) || 5))
  try {
    loadError.value = null
    await saveGameRoom(gameId.value, { voting: { ...curV, slotDurationSec: n } })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostTieDefenseDuration(sec) {
  if (!isAdmin.value || !tieBreakOpen.value) return
  const n = Math.max(5, Math.min(60, Math.floor(Number(sec) || 30)))
  const curV =
    gameRoom.value?.voting && typeof gameRoom.value.voting === 'object'
      ? { ...gameRoom.value.voting }
      : {}
  try {
    loadError.value = null
    await saveGameRoom(gameId.value, { voting: { ...curV, slotDurationSec: n } })
    tieBreakOpen.value = false
    tieBreakSlots.value = []
    showToast(t('toast.tieDefenseDurationSet', { sec: n }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostEliminateSuggestedPlayer() {
  if (!isAdmin.value) return false
  const slot = normalizePlayerSlotId(String(elimSuggestSlot.value || '').trim())
  if (!slot) return false
  try {
    loadError.value = null
    const existing = await fetchCharacter(gameId.value, slot)
    await saveCharacter(gameId.value, slot, {
      ...(existing && typeof existing === 'object' ? existing : {}),
      eliminated: true,
    })
    await setGameNominations(gameId.value, [])
    await setRoomVoting(gameId.value, false, '', { clearBallot: true })
    await setGameHandRaised(gameId.value, slot, false)
    showToast(t('toast.playerMarkedEliminated', { slot }))
    return true
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    return false
  }
}

async function hostConfirmEliminateSuggested() {
  if (!isAdmin.value) return
  const ok = await hostEliminateSuggestedPlayer()
  if (!ok) return
  elimSuggestOpen.value = false
  elimSuggestSlot.value = ''
  ballotSummaryOpen.value = true
}

async function hostDismissEliminateSuggested() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await setGameNominations(gameId.value, [])
    elimSuggestOpen.value = false
    elimSuggestSlot.value = ''
    ballotSummaryOpen.value = true
    showToast(t('toast.nominationsClearedAfterVote'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function persistNominationOnePerRound(val) {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await saveGameRoom(gameId.value, { nominationOneTargetPerRound: Boolean(val) })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

/** Накопичення цілей голосування в поточному раунді (окремо від черги). */
async function appendVoteTargetsThisRound(slotRaw) {
  if (!isAdmin.value) return
  const tid = normalizePlayerSlotId(String(slotRaw ?? '').trim())
  if (!tid) return
  const prev = Array.isArray(gameRoom.value?.voteTargetsThisRound)
    ? gameRoom.value.voteTargetsThisRound.map(normalizePlayerSlotId)
    : []
  if (prev.includes(tid)) return
  try {
    loadError.value = null
    await saveGameRoom(gameId.value, { voteTargetsThisRound: [...prev, tid] })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostRemoveVote(voterId) {
  if (!isAdmin.value) return
  const v = String(voterId ?? '').trim()
  if (!v) return
  try {
    loadError.value = null
    await deleteVoteDoc(gameId.value, v)
    showToast(t('toast.voteRemoved', { slot: v }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostRoundDelta(d) {
  if (!isAdmin.value) return
  const cur = roomRoundLive.value
  const next = Math.min(8, Math.max(1, cur + Number(d)))
  if (next === cur) return
  try {
    loadError.value = null
    await setRoomRound(gameId.value, next)
    showToast(t('toast.roundChanged'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostClearHands() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await clearAllHands(gameId.value)
    showToast(t('toast.handsCleared'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function hostReviveAllPlayers() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    const n = await reviveAllEliminatedPlayers(gameId.value)
    if (n <= 0) showToast(t('toast.reviveAllNobody'))
    else showToast(t('toast.reviveAllDone', { n }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function adminNextSpeaker() {
  if (!isAdmin.value) return
  const elim = eliminatedBySlot()
  const slots = PLAYER_SLOTS
  const cur = String(gameRoom.value?.currentSpeaker ?? '').trim()
  let from = 0
  if (cur && slots.includes(cur)) from = slots.indexOf(cur) + 1

  const sec = Math.max(1, Math.floor(Number(speakingDuration.value) || 30))
  for (let step = 0; step < slots.length; step++) {
    const slot = slots[(from + step) % slots.length]
    if (elim[slot] !== true) {
      try {
        loadError.value = null
        timerSpeakerSlot.value = slot
        await startSpeakingTimer(gameId.value, slot, sec)
        showToast(t('toast.slotTimer', { slot, sec }))
      } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e)
      }
      return
    }
  }
  showToast(t('toast.noAlivePlayers'))
}

const hostChromeActions = {
  roundDelta: hostRoundDelta,
  votingStart: hostVotingStart,
  votingFinish: hostFinishVoting,
  removeVote: hostRemoveVote,
  setVoteSlotDuration: hostSetVoteSlotDuration,
  tieDefenseDuration: hostTieDefenseDuration,
  clearHands: hostClearHands,
  reviveAllPlayers: hostReviveAllPlayers,
  setSpeakingDuration(n) {
    speakingDuration.value = n
  },
  startRound: controlStartRound,
  pauseShow: controlPauseShow,
  resetRoom: controlReset,
  setPhase,
  startTimer: adminStartSpeakingTimer,
  pauseTimer: adminPauseTimerOnly,
  resumeTimer: adminResumeTimer,
  clearTimer: adminClearTimer,
  nextSpeaker: adminNextSpeaker,
}

watchEffect(() => {
  if (adminAccessDenied.value || !isAdmin.value) {
    clearHostControlChrome()
    return
  }
  syncHostControlChrome({
    summaryLine: hostSummaryLine.value,
    round: roomRoundLive.value,
    gameRoom: gameRoom.value,
    votesLive: votesLiveRound.value,
    allPlayersVoted: allPlayersVoted.value,
    speakingDuration: speakingDuration.value,
    phaseOptions: PHASE_OPTIONS,
    actions: hostChromeActions,
    voteHistorySessions: hostSessionStats.value.voteSessions || [],
    handRaises: hostSessionStats.value.handRaises || {},
  })
})

function buildUsedStateExcludingEditorSlot() {
  const us = createEmptyUsedState()
  const eid = String(editorPlayerId.value)
  for (const p of allPlayers.value) {
    if (String(p.id) === eid) continue
    mergePlayerDataIntoUsedState(p, us)
  }
  return us
}

async function ensureEditorSlotHasPlayerDoc() {
  if (!isAdmin.value) return
  const gid = gameId.value
  const pid = editorPlayerId.value
  if (!gid || !pid) return
  if (editorPlayerInRoster.value) return
  await ensureGameRoomExists(gid)
  const created = await ensurePlayerCharacterExists(gid, pid, selectedScenario.value)
  const data = await fetchCharacter(gid, pid)
  if (data) applyFromFirestoreSnapshot(data)
  if (created) showToast(t('toast.playerAdded', { slot: pid }))
}

/** Якщо в кімнаті ще нікого немає — фокусуємо слот p1, щоб кубик / «згенерувати» створювали першого гравця. */
async function focusFirstSlotWhenRosterEmpty() {
  if (!isAdmin.value) return
  if (allPlayers.value.length > 0) return
  const first = 'p1'
  selectedDeskPlayerId.value = first
  navigateQuery({ player: first })
  await nextTick()
}

async function rerollSingleTrait(fieldKey) {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await focusFirstSlotWhenRosterEmpty()
    await ensureEditorSlotHasPlayerDoc()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    return
  }
  characterState[fieldKey].value = rollFieldValue(
    fieldKey,
    scenarioForRolls.value,
    traitExcludeSetFromPlayers(allPlayers.value, fieldKey, editorPlayerId.value),
  )
}

async function rerollIdentity() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await focusFirstSlotWhenRosterEmpty()
    await ensureEditorSlotHasPlayerDoc()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    return
  }
  const g = genders[Math.floor(Math.random() * genders.length)]
  characterState.gender = g
  characterState.name = pickNameForGender(g)
  characterState.age = randomPlayerAgeString()
  characterState.identityRevealed = false
  characterState.demographicsRevealed = false
}

function generateRandomCharacter() {
  if (!isAdmin.value) return
  rollRandomIntoCharacter(characterState, {
    scenarioId: selectedScenario.value,
    usedState: buildUsedStateExcludingEditorSlot(),
  })
}

async function globalRollField(fieldKey) {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    const sid = scenarioForRolls.value
    await applyGlobalAction(gameId.value, fieldKey, sid)
    showToast(t('toast.allField', { field: t(`traits.${fieldKey}`) }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function globalChaos() {
  const k = CORE_FIELD_KEYS[Math.floor(Math.random() * CORE_FIELD_KEYS.length)]
  await globalRollField(k)
}

async function globalRollSelected() {
  await globalRollField(globalFieldPick.value)
}

async function regenerateAllPlayers() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await regenerateAllPlayersRandom(gameId.value, selectedScenario.value)
    showToast(t('toast.allRegenerated'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function regenerateActiveCardsForAllPlayers() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await regenerateAllPlayersActiveCards(gameId.value)
    showToast(t('toast.activeCardsUpdated'))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function regenerateActiveCardForCurrentSlot() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    await regeneratePlayerActiveCard(gameId.value, editorPlayerId.value)
    showToast(t('toast.activeCardSlotUpdated', { slot: editorPlayerId.value }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

const genDialogOpen = ref(false)
const genDialogTitle = ref('')
const genDialogMessage = ref('')
const genDialogShowCountInput = ref(false)
const genEmptyRosterCount = ref(6)
let genDialogRunner = null

function openHostGenConfirm(title, message, runner, opts = {}) {
  const { showEmptyRosterCount = false } = opts
  genDialogTitle.value = title
  genDialogMessage.value = message
  genDialogRunner = runner
  genDialogShowCountInput.value = showEmptyRosterCount
  genDialogOpen.value = true
}

function onHostGenDialogClose() {
  genDialogRunner = null
  genDialogShowCountInput.value = false
}

async function onHostGenDialogConfirm() {
  const fn = genDialogRunner
  genDialogRunner = null
  if (fn) await fn()
}

function askGenerateRandomCharacter() {
  if (allPlayers.value.length === 0) {
    openHostGenConfirm(
      t('control.genConfirmTitle'),
      t('control.genConfirmFirstPlayerBody'),
      async () => {
        try {
          loadError.value = null
          await focusFirstSlotWhenRosterEmpty()
          await ensureEditorSlotHasPlayerDoc()
          generateRandomCharacter()
        } catch (e) {
          loadError.value = e instanceof Error ? e.message : String(e)
        }
      },
    )
  } else {
    openHostGenConfirm(
      t('control.genConfirmTitle'),
      t('control.genConfirmPlayer', { slot: editorPlayerId.value }),
      () => generateRandomCharacter(),
    )
  }
}

async function runCreateNPlayersFromDialog() {
  if (!isAdmin.value) return
  try {
    loadError.value = null
    const raw = Number(genEmptyRosterCount.value)
    const n = Math.max(1, Math.min(10, Math.floor(Number.isFinite(raw) ? raw : 6) || 1))
    await ensureGameRoomExists(gameId.value)
    await createFirstNRandomPlayers(gameId.value, selectedScenario.value, n)
    showToast(t('toast.rosterCreatedN', { n }))
    selectedDeskPlayerId.value = 'p1'
    navigateQuery({ player: 'p1' })
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

function askRegenerateAllPlayers() {
  if (allPlayers.value.length === 0) {
    genEmptyRosterCount.value = 6
    openHostGenConfirm(
      t('control.genConfirmTitle'),
      t('control.genConfirmAllEmpty'),
      runCreateNPlayersFromDialog,
      { showEmptyRosterCount: true },
    )
  } else {
    openHostGenConfirm(t('control.genConfirmTitle'), t('control.genConfirmAll'), regenerateAllPlayers)
  }
}

function askRegenerateActiveCardsAll() {
  openHostGenConfirm(t('control.genConfirmTitle'), t('control.genConfirmActiveAll'), regenerateActiveCardsForAllPlayers)
}

function askRegenerateActiveCardOne() {
  openHostGenConfirm(
    t('control.genConfirmTitle'),
    t('control.genConfirmActiveOne', { slot: editorPlayerId.value }),
    regenerateActiveCardForCurrentSlot,
  )
}

function askGlobalRollField(fieldKey) {
  openHostGenConfirm(
    t('control.genConfirmTitle'),
    t('control.genConfirmGlobalField', { field: t(`traits.${fieldKey}`) }),
    () => globalRollField(fieldKey),
  )
}

function askGlobalChaos() {
  openHostGenConfirm(t('control.genConfirmTitle'), t('control.genConfirmChaos'), globalChaos)
}

function askGlobalRollSelected() {
  const fk = globalFieldPick.value
  openHostGenConfirm(
    t('control.genConfirmTitle'),
    t('control.genConfirmGlobalField', { field: t(`traits.${fk}`) }),
    globalRollSelected,
  )
}

async function confirmActiveCardEffect() {
  if (!isAdmin.value) return
  const eid = String(characterState.activeCard?.effectId || '')
  if (!eid) {
    showToast(t('toast.noEffectId'))
    return
  }
  try {
    loadError.value = null
    const res = await applyActiveCardEffect(
      gameId.value,
      editorPlayerId.value,
      eid,
      scenarioForRolls.value,
    )
    if (!res.ok) {
      showToast(res.message)
      return
    }
    const fresh = await fetchCharacter(gameId.value, editorPlayerId.value)
    syncing.value = true
    applyRemoteCharacterData(characterState, fresh)
    characterState.activeCard.used = true
    characterState.activeCardRequest = false
    syncing.value = false
    await saveCharacter(gameId.value, editorPlayerId.value, snapshotCharacter(characterState))
    showToast(res.message)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function clearCardRequest() {
  if (!isAdmin.value) return
  characterState.activeCardRequest = false
  await saveCharacter(gameId.value, editorPlayerId.value, snapshotCharacter(characterState))
  showToast(t('toast.requestCancelled'))
}

async function requestCardFromHost() {
  if (isAdmin.value) return
  if (characterState.activeCard.used) return
  characterState.activeCardRequest = true
  try {
    loadError.value = null
    await saveCharacter(gameId.value, playerId.value, snapshotCharacter(characterState))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

let saveTimer = null
/** Не зберігати попередній слот при перемиканні редактора — інакше після deleteDoc merge знову створює документ у Firestore. */
const slotsToSkipPersistOnSwitch = new Set()

function goToPlayer(id) {
  if (!isAdmin.value) return
  navigateQuery({ player: String(id).trim() || 'p1' })
  hostBlocksOpen.value.editor = true
  nextTick(() => {
    document.getElementById('host-editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function hostForgetSavedAndLeave() {
  clearHostAccessSession()
  router.push({ name: 'eat', query: { view: 'join', game: gameId.value } })
}

/** URL збігається з вибраним слотом — після оновлення сторінки той самий гравець у редакторі. */
watch(
  () => String(selectedDeskPlayerId.value || '').trim(),
  (sel) => {
    if (!isAdmin.value || !sel) return
    const n = normalizePlayerSlotId(sel)
    if (n !== playerId.value) navigateQuery({ player: n })
  },
)

async function applyNewGame() {
  if (!isAdmin.value) return
  const g = String(draftGameId.value).trim() || 'test1'
  if (GAME_ID_UNSAFE.test(g)) {
    showToast(t('control.gameIdUnsafeToast'))
  }
  navigateQuery({ game: g })
  try {
    loadError.value = null
    const created = await ensureGameRoomExists(g)
    await saveGameRoom(g, { activeScenario: selectedScenario.value })
    // Не викликати seed при кожному OK — інакше знову з’являються видалені слоти p1–p10.
    if (created) {
      await seedMissingStandardPlayers(g, selectedScenario.value)
      showToast(t('toast.rosterSeeded'))
    } else {
      showToast(t('toast.gameRoomUpdated'))
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function createAndGoToPlayer() {
  if (!isAdmin.value) return
  const raw = String(newPlayerId.value ?? '').trim() || suggestedNextPlayerId.value
  if (!raw) return
  const id = normalizePlayerSlotId(raw)
  newPlayerId.value = ''
  const ag = { ...antiGhostPlayerUntil.value }
  delete ag[id]
  antiGhostPlayerUntil.value = ag
  try {
    loadError.value = null
    await ensureGameRoomExists(gameId.value)
    await ensurePlayerCharacterExists(gameId.value, id, selectedScenario.value)
    selectedDeskPlayerId.value = id
    navigateQuery({ player: id })
    showToast(t('toast.playerAdded', { slot: id }))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      loadError.value = null
      await saveCharacter(gameId.value, editorPlayerId.value, snapshotCharacter(characterState))
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }, 400)
}

function applyFromFirestoreSnapshot(data) {
  skipRemoteAutosave.value = true
  syncing.value = true
  try {
    if (data != null) applyRemoteCharacterData(characterState, data)
    else applyRemoteCharacterData(characterState, null)
  } finally {
    syncing.value = false
    nextTick(() => {
      reconcilePlayerRevealLedgerCount()
      skipRemoteAutosave.value = false
    })
  }
}

/** Поля службові Firestore — не передаємо в редактор персонажа. */
watch(characterState, () => {
  if (
    syncing.value ||
    skipRemoteAutosave.value ||
    adminAccessDenied.value ||
    playerSlotAccessBlocked.value
  )
    return
  scheduleSave()
}, { deep: true })

watch(
  [gameId, editorPlayerId, adminAccessDenied],
  async ([gid, pid, denied], oldTuple) => {
    clearTimeout(saveTimer)
    saveTimer = null

    if (unsubCharacter) {
      unsubCharacter()
      unsubCharacter = null
    }
    panelHydrating.value = false

    if (denied) return
    if (!gid || !pid) return

    if (oldTuple && !oldTuple[2]) {
      const [og, op] = oldTuple
      if (op && (og !== gid || op !== pid)) {
        const prevSlot = normalizePlayerSlotId(op)
        if (slotsToSkipPersistOnSwitch.has(prevSlot)) {
          slotsToSkipPersistOnSwitch.delete(prevSlot)
        } else {
          try {
            await saveCharacter(og, op, snapshotCharacter(characterState))
          } catch (e) {
            controlOrchLog.warn('save before switching editor slot', e)
          }
        }
      }
    }

    loadError.value = null
    panelHydrating.value = true
    if (!isAdmin.value) {
      playerJoinGateReady.value = false
      playerDocJoinToken.value = ''
    }
    unsubCharacter = subscribeToCharacter(gid, pid, (data) => {
      if (!isAdmin.value) {
        playerDocJoinToken.value =
          data && typeof data.joinToken === 'string' ? String(data.joinToken).trim() : ''
        playerJoinGateReady.value = true
      }
      applyFromFirestoreSnapshot(data)
      panelHydrating.value = false
    })
  },
  { immediate: true },
)

watch(
  () => ({
    adm: isAdmin.value,
    gid: gameId.value,
    pid: playerId.value,
    routeTok: String(route.query.token ?? '').trim(),
    docTok: playerDocJoinToken.value,
    ready: playerJoinGateReady.value,
  }),
  (o) => {
    if (o.adm || !o.ready || !o.docTok) return
    const sess = getJoinSessionToken(o.gid, o.pid)
    if (!sess || sess !== o.docTok) return
    if (o.routeTok === sess) return
    router.replace({
      name: 'eat',
      query: { ...route.query, view: 'control', token: sess },
    })
  },
  { flush: 'post' },
)

watch(
  [gotGameRoomSnap, gotPlayersSnap, panelHydrating, isAdmin, adminAccessDenied],
  () => {
    if (adminAccessDenied.value) {
      bootstrappedControl.value = true
      return
    }
    if (!gotGameRoomSnap.value) return
    if (isAdmin.value && !gotPlayersSnap.value) return
    if (panelHydrating.value) return
    bootstrappedControl.value = true
  },
  { flush: 'post' },
)

const showControlPageLoader = computed(
  () => !adminAccessDenied.value && !bootstrappedControl.value,
)

onUnmounted(() => {
  clearHostControlChrome()
  clearTimeout(saveTimer)
  clearTimeout(toastTimer)
  cleanupSubs()
  if (typeof window !== 'undefined') {
    window.removeEventListener(EAT_FIRST_ONBOARDING_EXPAND, onEatFirstOnboardingExpand)
  }
  if (tickTimer != null) {
    window.clearInterval(tickTimer)
    tickTimer = null
  }
})

const playerRevealLocked = computed(
  () => !isAdmin.value && Boolean(characterState.eliminated),
)

const HOST_BLOCKS_KEY = 'eat-first:host-blocks-v1'
function defaultHostBlocksOpen() {
  return {
    live: true,
    sessionStats: true,
    activeCard: true,
    players: true,
    gen: true,
    editor: true,
  }
}
function readHostBlocksOpen() {
  if (typeof sessionStorage === 'undefined') return defaultHostBlocksOpen()
  try {
    const raw = sessionStorage.getItem(HOST_BLOCKS_KEY)
    if (!raw) return defaultHostBlocksOpen()
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return defaultHostBlocksOpen()
    return { ...defaultHostBlocksOpen(), ...o }
  } catch {
    return defaultHostBlocksOpen()
  }
}
const hostBlocksOpen = ref(readHostBlocksOpen())
watch(
  hostBlocksOpen,
  (v) => {
    try {
      sessionStorage.setItem(HOST_BLOCKS_KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)
function hostCollapseAllBlocks() {
  const o = hostBlocksOpen.value
  o.live = false
  o.sessionStats = false
  o.activeCard = false
  o.players = false
  o.gen = false
  o.editor = false
}
function hostExpandAllBlocks() {
  const o = hostBlocksOpen.value
  o.live = true
  o.sessionStats = true
  o.activeCard = true
  o.players = true
  o.gen = true
  o.editor = true
}

const EAT_FIRST_ONBOARDING_EXPAND = 'eat-first-onboarding-expand'

function onEatFirstOnboardingExpand(ev) {
  if (!isAdmin.value) return
  const b = ev?.detail?.hostBlock
  if (b == null || typeof b !== 'string') return
  const o = hostBlocksOpen.value
  const key = b.trim()
  if (key === 'live') o.live = true
  else if (key === 'sessionStats') o.sessionStats = true
  else if (key === 'activeCard') o.activeCard = true
  else if (key === 'players') o.players = true
  else if (key === 'gen') o.gen = true
  else if (key === 'editor') o.editor = true
}

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener(EAT_FIRST_ONBOARDING_EXPAND, onEatFirstOnboardingExpand)
})

const activeCardPanelKey = computed(
  () =>
    `${characterState.activeCard.used ? 'u' : 'a'}-${characterState.activeCardRequest ? 'r' : 'n'}-${String(characterState.activeCard.title ?? '').slice(0, 24)}`,
)

function rerollActiveCardOnly() {
  if (!isAdmin.value) return
  const ex = activeTemplateExcludeSetFromPlayers(allPlayers.value, editorPlayerId.value)
  const t = pickRandomActiveCardTemplateAvoiding(ex)
  characterState.activeCard = {
    title: t.title,
    description: t.description,
    used: false,
    effectId: t.effectId,
    templateId: t.templateId,
  }
}


  return {
    route,
    router,
    t,
    te,
    ANTI_GHOST_PLAYER_MS,
    EAT_FIRST_ONBOARDING_EXPAND,
    GAME_ID_UNSAFE,
    HOST_BLOCKS_KEY,
    PHASE_OPTIONS,
    PLAYER_SLOTS,
    PLAYER_TRAIT_COL_LEFT,
    PLAYER_TRAIT_COL_RIGHT,
    activeAntiGhostPlayerSlots,
    activeCardPanelKey,
    adminAccessDenied,
    adminClearTimer,
    adminKeyOk,
    adminNextSpeaker,
    adminPauseTimerOnly,
    adminResumeTimer,
    adminStartSpeakingTimer,
    aggregateForVotesByTarget,
    aliveCount,
    alivePlayersCount,
    allAlivePlayersReady,
    allPlayers,
    allPlayersVoted,
    analyzeVoteOutcome,
    antiGhostPlayerUntil,
    appendVoteTargetsThisRound,
    applyFromFirestoreSnapshot,
    applyNewGame,
    applyPlayerListFromFirestore,
    askBulkDeletePlayers,
    askGenerateRandomCharacter,
    askGlobalChaos,
    askGlobalRollField,
    askGlobalRollSelected,
    askRegenerateActiveCardOne,
    askRegenerateActiveCardsAll,
    askRegenerateAllPlayers,
    ballotSummaryOpen,
    ballotSummarySessions,
    bootstrappedControl,
    buildUsedStateExcludingEditorSlot,
    bulkSelectedSlots,
    bumpHandRaiseSlot,
    characterReadsFemale,
    characterState,
    cleanupSubs,
    clearBulkSelection,
    clearCardRequest,
    computeRevealMaxForRound,
    confirmActiveCardEffect,
    controlPauseShow,
    controlQuery,
    controlReset,
    controlStartRound,
    copyGlobal,
    copyPersonal,
    countPlayerRevealSlotsUsed,
    countRevealedCoreTraits,
    createAndGoToPlayer,
    defaultHostBlocksOpen,
    draftGameId,
    editorPlayerId,
    editorPlayerInRoster,
    elimSuggestForVotes,
    elimSuggestHandLines,
    elimSuggestOpen,
    elimSuggestSlot,
    eliminatedBySlot,
    ensureEditorSlotHasPlayerDoc,
    fieldConfig,
    fieldMenuOptions,
    focusFirstSlotWhenRosterEmpty,
    formatGenderDisplay,
    gameId,
    gameIdHasUnsafeChars,
    gameRoom,
    genDialogMessage,
    genDialogOpen,
    genDialogRunner,
    genDialogShowCountInput,
    genDialogTitle,
    genEmptyRosterCount,
    generateRandomCharacter,
    globalChaos,
    globalFieldPick,
    globalRollField,
    globalRollSelected,
    globalUrlAbsolute,
    goToPlayer,
    gotGameRoomSnap,
    gotPlayersSnap,
    hostApplyBallotFromNominations,
    hostBlocksOpen,
    hostChromeActions,
    hostClearHands,
    hostClearSessionStatsOnly,
    hostCollapseAllBlocks,
    hostConfirmEliminateSuggested,
    hostDismissEliminateSuggested,
    hostEliminateSuggestedPlayer,
    hostExecuteBulkDeletePlayers,
    hostExecuteDeletePlayer,
    hostExpandAllBlocks,
    hostFinishVoting,
    hostForgetSavedAndLeave,
    hostHandRaiseRows,
    hostModeRequested,
    hostRemoveVote,
    hostResetPlayerRoles,
    hostReviveAllPlayers,
    hostRoundDelta,
    hostSessionEndedLabel,
    hostSessionStats,
    hostSessionVoteTally,
    hostSetVoteSlotDuration,
    hostSummaryLine,
    hostTieDefenseDuration,
    hostTimerRemaining,
    hostToggleNomination,
    hostVotingStart,
    isAdmin,
    isLastNominationBallotSlot,
    lastAutoFinishedVoteSlotMs,
    lastPlayersFirestoreList,
    loadError,
    modeLabel,
    myHandRaised,
    myPlayerReady,
    myStatusLabel,
    navigateQuery,
    newPlayerId,
    nominatedPlayerActive,
    nominationsList,
    onEatFirstOnboardingExpand,
    onHostGenDialogClose,
    onHostGenDialogConfirm,
    onRosterHostCommand,
    onToggleBulkSelection,
    openHostGenConfirm,
    orderTieSlotsByNominationOrder,
    overlayHrefGlobal,
    overlayHrefPersonal,
    panelHydrating,
    pendingPlayerDeletes,
    persistHostStats,
    persistNominationOnePerRound,
    persistScenarioChoice,
    personalUrlAbsolute,
    playerDocJoinToken,
    playerHasVotedThisRound,
    playerId,
    playerIsVotingTarget,
    playerJoinGateReady,
    playerPhaseDisplay,
    playerReadyPillLabel,
    playerRevealLocked,
    playerSlotAccessBlocked,
    playerVoteBusy,
    playerVoteSlotLabel,
    playerVotingTargetId,
    playersReadyMap,
    prevHandsForStats,
    pruneAntiGhostPlayerUntil,
    raisedHandsCount,
    readHostBlocksOpen,
    readyPlayersCount,
    reconcilePendingDeletesWithSnapshot,
    reconcilePlayerRevealLedgerCount,
    regenerateActiveCardForCurrentSlot,
    regenerateActiveCardsForAllPlayers,
    regenerateAllPlayers,
    requestCardFromHost,
    rerollActiveCardOnly,
    rerollIdentity,
    rerollSingleTrait,
    revealDemographics,
    revealTrait,
    roomRoundLive,
    rosterOrderHint,
    rosterSlotNum,
    runCreateNPlayersFromDialog,
    saveTimer,
    scenarioForRolls,
    scenarioMenuOptions,
    scheduleSave,
    selectedDeskPlayerId,
    selectedScenario,
    sessionVoteForCount,
    setMyHandRaised,
    setMyPlayerReady,
    setPhase,
    setSpotlightPlayer,
    showControlPageLoader,
    showPlayerVotingUi,
    showToast,
    skipRemoteAutosave,
    slotsToSkipPersistOnSwitch,
    speakingDuration,
    submitPlayerVote,
    suggestedNextPlayerId,
    syncRevealLedgerForOpenAttempt,
    syncing,
    tick,
    tickTimer,
    tieBreakOpen,
    tieBreakSlots,
    timerSpeakerSlot,
    toast,
    toastTimer,
    unsubCharacter,
    urlKey,
    votes,
    votesLiveRound,
    votesLiveRoundVoterIds,
    votesPayloadFingerprint,
  }
}
