import { defineStore } from 'pinia'
import { computed, nextTick, ref, shallowRef } from 'vue'
import { useCallSessionStore } from 'call-core'
import { createLogger } from '@/utils/logger'
import { buildMafiaRoleDeck, MafiaPlayerCountError } from '@/utils/mafiaGameRoleDeck'
import type {
  MafiaHostInteractionMode,
  MafiaLastNightResult,
  MafiaNightActionKey,
  MafiaNightActions,
  MafiaPhase,
  MafiaPlayersUpdatePayload,
  MafiaReshufflePayload,
  MafiaRole,
  MafiaPlayerKickPayload,
  MafiaPlayerRevivePayload,
  MafiaTimerStartPayload,
  MafiaTimerState,
  MafiaTimerStopPayload,
} from '@/utils/mafiaGameTypes'
import { computeMafiaLastNightResult } from '@/utils/mafiaLastNightResult'
import { fisherYatesShuffle } from '@/utils/fisherYatesShuffle'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'

const mafiaGameLog = createLogger('mafia-game')

/**
 * Mafia *game* state: numbering (after shuffle), roles (host-only display later), phase.
 * `numberingOrder` empty → CallPage uses engine join order from `mafiaPlayers` store.
 */
const NIGHT_ACTION_ROLES: MafiaNightActionKey[] = ['mafia', 'doctor', 'sheriff', 'don']

const MAFIA_ROLES: ReadonlySet<MafiaRole> = new Set(['mafia', 'don', 'sheriff', 'doctor', 'civilian'])

/** Preset round lengths (30s / 60s / 90s). */
export const MAFIA_TIMER_PRESET_MS = [30_000, 60_000, 90_000] as const

const MAFIA_TIMER_MIN_MS = 30_000
const MAFIA_TIMER_MAX_MS = 7_200_000

const TIMER_STOP_SENTINEL: MafiaTimerStopPayload = Object.freeze({})

export const useMafiaGameStore = defineStore('mafiaGame', () => {
  const callSession = useCallSessionStore()

  const phase = ref<MafiaPhase | null>(null)
  /** Use whole-object replacement only — never assign nested keys in place. */
  const nightActions = ref<MafiaNightActions>({})

  /** Which night-action slot a tile click applies to. */
  const activeNightActionRole = ref<MafiaNightActionKey>('mafia')

  /** Shuffled player order for seat numbers 1..N. Empty = use engine join order. */
  const numberingOrder = ref<string[]>([])

  const roleByPeerId = shallowRef<Record<string, MafiaRole>>({})
  const aliveByPeerId = shallowRef<Record<string, boolean>>({})

  /** Mafia “ведучий” — from signaling `mafia:host-updated` (one per room). */
  const mafiaHostPeerId = ref<string | null>(null)

  const isMafiaHost = computed(() => {
    const h = mafiaHostPeerId.value
    if (h == null || h === '') {
      return false
    }
    return callSession.selfPeerId === h
  })

  /** For host: set after a successful `reshuffleGame`; `useMafiaHostSignaling` sends WS then clears. */
  const reshuffleBroadcastPayload = ref<MafiaReshufflePayload | null>(null)

  /** For host: first peer id selected in “Swap” mode; second click runs `swapSeatsByPeerId`. */
  const hostSeatSwapSelectionPeerId = ref<string | null>(null)

  /**
   * When true, skip queue signaling (batch update from swap / remote `mafia:players-update`).
   */
  const applyingPlayersUpdateFromSignaling = ref(false)

  /**
   * True while host or remote apply is mutating numbering/roles for a reshuffle.
   * CallPage’s mafia refresh skips `syncWithPeers` / reconcile in that window to avoid a
   * joinOrder/numbering ref-churn loop with `orderedGridRows` (same state, new array refs).
   */
  const isApplyingMafiaReshuffle = ref(false)

  function beginMafiaReshuffleApply(): void {
    isApplyingMafiaReshuffle.value = true
    void nextTick(() => {
      isApplyingMafiaReshuffle.value = false
    })
  }

  /** For host: after `swapSeatsByPeerId`; signaling sends `mafia:players-update` then clears. */
  const playersUpdateBroadcastPayload = ref<MafiaPlayersUpdatePayload | null>(null)

  /** Shared round timer; `remaining = duration - (Date.now() - startedAt)` on each client. */
  const mafiaTimer = ref<MafiaTimerState | null>(null)

  /** Host: set in `startTimer`; `useMafiaHostSignaling` sends `mafia:timer-start` then clears. */
  const timerStartBroadcastPayload = ref<MafiaTimerStartPayload | null>(null)

  /** Host: set in `stopTimer`; composable sends `mafia:timer-stop` then clears. */
  const timerStopBroadcastPayload = ref<MafiaTimerStopPayload | null>(null)

  /** Host: set in `kickPlayer`; `useMafiaHostSignaling` sends `mafia:player-kick` then clears. */
  const kickBroadcastPayload = ref<MafiaPlayerKickPayload | null>(null)
  const reviveBroadcastPayload = ref<MafiaPlayerRevivePayload | null>(null)

  function setMafiaHostFromSignaling(peerId: string | null): void {
    mafiaHostPeerId.value = peerId
  }

  /** Host: night-action assignment vs building speaking-order queue (tile click). */
  const hostInteractionMode = ref<MafiaHostInteractionMode>('night')

  /** Shared speaking queue (1-based seat #s); order preserved; host edits, others receive via signaling. */
  const speakingQueue = ref<number[]>([])

  const numberingKey = computed(() => numberingOrder.value.join('\u0000'))

  /** Auto-derived when `nightActions` change (host UI). */
  const lastNightResult = computed((): MafiaLastNightResult | null =>
    computeMafiaLastNightResult(nightActions.value),
  )

  function getDisplayNumberingOrder(engineJoin: string[]): string[] {
    if (numberingOrder.value.length === 0) {
      return engineJoin
    }
    return numberingOrder.value
  }

  /**
   * When participants change, keep shuffled order for survivors and append new peers (engine order).
   */
  function reconcileNumberingWithEngine(engineOrder: string[]): void {
    if (numberingOrder.value.length === 0) {
      return
    }
    const inEngine = new Set<string>()
    for (const id of engineOrder) {
      if (typeof id === 'string' && id.length > 0) {
        inEngine.add(id)
      }
    }
    const filtered = numberingOrder.value.filter((id) => inEngine.has(id))
    const next: string[] = []
    const seen = new Set<string>()
    for (const id of filtered) {
      if (!seen.has(id)) {
        seen.add(id)
        next.push(id)
      }
    }
    for (const id of engineOrder) {
      if (typeof id !== 'string' || id.length === 0) {
        continue
      }
      if (!seen.has(id)) {
        seen.add(id)
        next.push(id)
      }
    }
    const nextKey = next.join('\u0000')
    const curKey = numberingOrder.value.join('\u0000')
    if (nextKey === curKey) {
      return
    }
    numberingOrder.value = next
  }

  /** Remove role/alive state for peer ids that are no longer in the call. */
  function pruneGameStateToPeers(engineOrder: string[]): void {
    const s = new Set<string>()
    for (const id of engineOrder) {
      if (typeof id === 'string' && id.length > 0) {
        s.add(id)
      }
    }
    const r = { ...roleByPeerId.value }
    for (const k of Object.keys(r)) {
      if (!s.has(k)) {
        delete r[k]
      }
    }
    roleByPeerId.value = r
    const a = { ...aliveByPeerId.value }
    for (const k of Object.keys(a)) {
      if (!s.has(k)) {
        delete a[k]
      }
    }
    aliveByPeerId.value = a
  }

  /** Drop night-action seat refs outside 1..maxSeat. */
  function pruneNightActionsToMaxSeat(maxSeat: number): void {
    if (maxSeat < 1) {
      nightActions.value = {}
      return
    }
    const next: MafiaNightActions = { ...nightActions.value }
    let changed = false
    for (const k of NIGHT_ACTION_ROLES) {
      const v = next[k]
      if (v != null && (v < 1 || v > maxSeat || !Number.isInteger(v))) {
        delete next[k]
        changed = true
      }
    }
    if (changed) {
      nightActions.value = next
    }
  }

  function setActiveNightActionRole(k: MafiaNightActionKey): void {
    activeNightActionRole.value = k
  }

  /**
   * Host: set a night action target by role and seat. Replaces `nightActions` with a new object.
   */
  function setNightAction(role: MafiaNightActionKey, seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    nightActions.value = { ...nightActions.value, [role]: seat }
    mafiaGameLog.info('night action set', { role, seat })
    void nextTick()
  }

  /**
   * Host: assign the active night role’s target to a seat (1..N from tile #).
   * Ignored when not host.
   */
  function assignNightActionForSeat(seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    setNightAction(activeNightActionRole.value, seat)
  }

  /**
   * Host: set or clear the active night role’s target for a seat. Same seat again clears that role’s slot.
   */
  function assignOrClearNightActionForActiveRole(seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    const role = activeNightActionRole.value
    const current = nightActions.value[role]
    if (current === seat) {
      const next: MafiaNightActions = { ...nightActions.value }
      delete next[role]
      nightActions.value = next
      mafiaGameLog.info('night action cleared', { role, seat })
      void nextTick()
      return
    }
    setNightAction(role, seat)
  }

  function setHostInteractionMode(mode: MafiaHostInteractionMode): void {
    if (!isMafiaHost.value) {
      return
    }
    hostInteractionMode.value = mode
    if (mode !== 'swap') {
      hostSeatSwapSelectionPeerId.value = null
    }
  }

  function setSeatSwapSelectionPeerId(peerId: string | null): void {
    if (!isMafiaHost.value) {
      return
    }
    hostSeatSwapSelectionPeerId.value = peerId
  }

  /**
   * If `numberingOrder` is still empty, copy `joinOrder` so seat positions are a concrete list to permute.
   */
  function ensureNumberingOrderMaterialized(joinOrder: string[]): void {
    if (numberingOrder.value.length > 0) {
      return
    }
    if (joinOrder.length < 1) {
      return
    }
    numberingOrder.value = [...joinOrder]
  }

  function remapNightActionsForSeatSwap(seatA: number, seatB: number): void {
    if (seatA === seatB) {
      return
    }
    const next: MafiaNightActions = { ...nightActions.value }
    for (const k of NIGHT_ACTION_ROLES) {
      const v = next[k]
      if (v === seatA) {
        next[k] = seatB
      } else if (v === seatB) {
        next[k] = seatA
      }
    }
    nightActions.value = next
  }

  function remapSpeakingQueueForSeatSwap(seatA: number, seatB: number): void {
    if (seatA === seatB) {
      return
    }
    speakingQueue.value = speakingQueue.value.map((n) =>
      n === seatA ? seatB : n === seatB ? seatA : n,
    )
  }

  function buildPlayersUpdatePayloadFromState(): MafiaPlayersUpdatePayload {
    return {
      order: [...numberingOrder.value],
      nightActions: { ...nightActions.value },
      speakingQueue: [...speakingQueue.value],
    }
  }

  /**
   * Host: swap two players’ seat numbers; roles stay on the people (`roleByPeerId` unchanged).
   * `nightActions` and `speakingQueue` (seat #s) are remapped so targets stay on the same people.
   */
  function swapSeatsByPeerId(peerA: string, peerB: string): void {
    if (!isMafiaHost.value) {
      return
    }
    if (peerA === peerB) {
      return
    }
    const mafia = useMafiaPlayersStore()
    const joinOrder = mafia.joinOrder
    ensureNumberingOrderMaterialized(joinOrder)
    const order = [...numberingOrder.value]
    const ia = order.indexOf(peerA)
    const ib = order.indexOf(peerB)
    if (ia < 0 || ib < 0) {
      mafiaGameLog.info('swap seats: peer not in numbering order', { peerA, peerB, ia, ib })
      return
    }
    const seatA = ia + 1
    const seatB = ib + 1
    ;[order[ia], order[ib]] = [order[ib]!, order[ia]!]

    applyingPlayersUpdateFromSignaling.value = true
    numberingOrder.value = order
    remapNightActionsForSeatSwap(seatA, seatB)
    remapSpeakingQueueForSeatSwap(seatA, seatB)
    hostSeatSwapSelectionPeerId.value = null
    mafiaGameLog.info('swap seats', { peerA, peerB, seatA, seatB })
    playersUpdateBroadcastPayload.value = buildPlayersUpdatePayloadFromState()
    void nextTick(() => {
      applyingPlayersUpdateFromSignaling.value = false
    })
  }

  function applyMafiaPlayersUpdateFromSignaling(payload: MafiaPlayersUpdatePayload): void {
    if (!Array.isArray(payload.order) || payload.order.length < 1) {
      return
    }
    const o = new Set<string>()
    for (const id of payload.order) {
      if (typeof id !== 'string' || id.length < 1 || o.has(id)) {
        return
      }
      o.add(id)
    }
    numberingOrder.value = [...payload.order]
    const nextNight: MafiaNightActions = {}
    const src = payload.nightActions
    if (src && typeof src === 'object') {
      for (const k of NIGHT_ACTION_ROLES) {
        const v = src[k]
        if (v != null && Number.isInteger(v) && v >= 1) {
          nextNight[k] = v
        }
      }
    }
    nightActions.value = nextNight
    applySpeakingQueueFromSignaling([...(payload.speakingQueue ?? [])])
  }

  function clearPlayersUpdateBroadcastPayload(): void {
    playersUpdateBroadcastPayload.value = null
  }

  /**
   * Host speaking queue: append seat if not already present (order preserved).
   */
  function addSpeakingSeatIfNew(seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    if (speakingQueue.value.includes(seat)) {
      return
    }
    speakingQueue.value = [...speakingQueue.value, seat]
    mafiaGameLog.info('speaking queue add', { seat, order: speakingQueue.value })
  }

  function removeSpeakingSeat(seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    speakingQueue.value = speakingQueue.value.filter((n) => n !== seat)
  }

  /** Host: empty the speaking order (broadcast via `useMafiaHostSignaling` like other queue edits). */
  function clearSpeakingQueue(): void {
    if (!isMafiaHost.value) {
      return
    }
    if (speakingQueue.value.length === 0) {
      return
    }
    speakingQueue.value = []
    mafiaGameLog.info('speaking queue cleared')
  }

  /**
   * Host toolbar: clear speaking queue, night tile selections, and in-progress seat swap in one action.
   * Speaking queue clear is broadcast; night actions are local until the next `mafia:players-update` path.
   */
  function clearHostToolbarSelections(): void {
    if (!isMafiaHost.value) {
      return
    }
    setHostInteractionMode('night')
    if (Object.keys(nightActions.value).length > 0) {
      nightActions.value = {}
    }
    if (speakingQueue.value.length > 0) {
      speakingQueue.value = []
    }
    mafiaGameLog.info('host toolbar: clear all selections')
  }

  function pruneSpeakingQueueToMaxSeat(maxSeat: number): void {
    if (maxSeat < 1) {
      speakingQueue.value = []
      return
    }
    const next = speakingQueue.value.filter((n) => n >= 1 && n <= maxSeat)
    if (next.length !== speakingQueue.value.length) {
      speakingQueue.value = [...next]
    }
  }

  /**
   * Apply queue from `mafia:queue-update` (all peers; host applies echo from server to avoid re-send).
   */
  function applySpeakingQueueFromSignaling(seats: number[]): void {
    if (!Array.isArray(seats)) {
      speakingQueue.value = []
      return
    }
    const next: number[] = []
    const seen = new Set<number>()
    for (const x of seats) {
      if (typeof x !== 'number' || !Number.isInteger(x) || x < 1) {
        continue
      }
      if (seen.has(x)) {
        continue
      }
      seen.add(x)
      next.push(x)
    }
    speakingQueue.value = next
  }

  type ReshuffleResult = { ok: true } | { ok: false; error: 'count' | 'empty' | 'message'; messageKey?: string }

  function buildReshufflePayloadFromState(
    orderedPeerIds: string[],
    roles: Record<string, MafiaRole>,
  ): MafiaReshufflePayload {
    return {
      players: orderedPeerIds.map((peerId, i) => ({
        peerId,
        seat: i + 1,
        role: roles[peerId]!,
      })),
    }
  }

  /**
   * Apply a host-issued reshuffle (from WebSocket) so everyone shares numbering, roles, and grid order.
   */
  function applyMafiaReshuffleFromSignaling(payload: MafiaReshufflePayload): void {
    const list = payload.players
    if (list.length < 1) {
      return
    }
    const order: string[] = []
    const r: Record<string, MafiaRole> = {}
    const seen = new Set<string>()
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i]!
      if (typeof p.peerId !== 'string' || p.peerId.length < 1) {
        return
      }
      if (p.seat !== i + 1) {
        return
      }
      if (seen.has(p.peerId)) {
        return
      }
      seen.add(p.peerId)
      order.push(p.peerId)
      if (typeof p.role !== 'string' || !MAFIA_ROLES.has(p.role as MafiaRole)) {
        return
      }
      r[p.peerId] = p.role as MafiaRole
    }
    beginMafiaReshuffleApply()
    numberingOrder.value = order
    roleByPeerId.value = r
    const a: Record<string, boolean> = {}
    for (const id of order) {
      a[id] = true
    }
    aliveByPeerId.value = a
    phase.value = 'night'
    nightActions.value = {}
    activeNightActionRole.value = 'mafia'
    speakingQueue.value = []
    hostInteractionMode.value = 'night'
    mafiaTimer.value = null
  }

  function reshuffleGame(): ReshuffleResult {
    if (!isMafiaHost.value) {
      mafiaGameLog.info('reshuffle ignored: not mafia host')
      return { ok: false, error: 'message', messageKey: 'mafiaPage.reshuffleNotHost' }
    }
    const mafia = useMafiaPlayersStore()
    const ids = mafia.joinOrder
    if (ids.length < 2) {
      return { ok: false, error: 'empty' }
    }
    if (ids.length < 5 || ids.length > 12) {
      return { ok: false, error: 'count' }
    }

    let deck: MafiaRole[]
    try {
      deck = buildMafiaRoleDeck(ids.length)
    } catch (e) {
      if (e instanceof MafiaPlayerCountError) {
        return { ok: false, error: 'count' }
      }
      throw e
    }

    beginMafiaReshuffleApply()
    const shuffledIds = fisherYatesShuffle([...ids])
    numberingOrder.value = shuffledIds

    const shuffledRoles = fisherYatesShuffle([...deck])
    const r: Record<string, MafiaRole> = {}
    for (let i = 0; i < shuffledIds.length; i += 1) {
      r[shuffledIds[i]!] = shuffledRoles[i]!
    }
    roleByPeerId.value = r

    const a: Record<string, boolean> = {}
    for (const id of shuffledIds) {
      a[id] = true
    }
    aliveByPeerId.value = a

    phase.value = 'night'
    nightActions.value = {}
    activeNightActionRole.value = 'mafia'
    speakingQueue.value = []
    hostInteractionMode.value = 'night'
    mafiaTimer.value = null
    timerStopBroadcastPayload.value = TIMER_STOP_SENTINEL
    mafiaGameLog.info('reshuffle: players shuffled, roles assigned', { n: ids.length, phase: phase.value })
    reshuffleBroadcastPayload.value = buildReshufflePayloadFromState(shuffledIds, r)
    return { ok: true }
  }

  function clearReshuffleBroadcastPayload(): void {
    reshuffleBroadcastPayload.value = null
  }

  function nightActionsCleared(a: MafiaNightActions): boolean {
    for (const k of NIGHT_ACTION_ROLES) {
      if (a[k] != null) {
        return false
      }
    }
    return true
  }

  /**
   * Idempotent: CallPage’s mafia `watch` runs on every `tiles` bump (e.g. mic toggle). Reassigning
   * fresh `{}` / `[]` each time retriggered the same watch → "Maximum recursive updates exceeded".
   */
  function clearWhenLeavingMafiaRoute(): void {
    if (
      phase.value === null &&
      numberingOrder.value.length === 0 &&
      Object.keys(roleByPeerId.value).length === 0 &&
      Object.keys(aliveByPeerId.value).length === 0 &&
      nightActionsCleared(nightActions.value) &&
      activeNightActionRole.value === 'mafia' &&
      speakingQueue.value.length === 0 &&
      hostInteractionMode.value === 'night' &&
      hostSeatSwapSelectionPeerId.value === null &&
      playersUpdateBroadcastPayload.value === null &&
      mafiaTimer.value === null &&
      timerStartBroadcastPayload.value === null &&
      timerStopBroadcastPayload.value === null &&
      kickBroadcastPayload.value === null &&
      reviveBroadcastPayload.value === null &&
      isApplyingMafiaReshuffle.value === false
    ) {
      return
    }
    numberingOrder.value = []
    roleByPeerId.value = {}
    aliveByPeerId.value = {}
    nightActions.value = {}
    activeNightActionRole.value = 'mafia'
    speakingQueue.value = []
    hostInteractionMode.value = 'night'
    hostSeatSwapSelectionPeerId.value = null
    playersUpdateBroadcastPayload.value = null
    mafiaTimer.value = null
    timerStartBroadcastPayload.value = null
    timerStopBroadcastPayload.value = null
    kickBroadcastPayload.value = null
    reviveBroadcastPayload.value = null
    isApplyingMafiaReshuffle.value = false
    phase.value = null
  }

  function fullReset(): void {
    clearWhenLeavingMafiaRoute()
    mafiaHostPeerId.value = null
  }

  /**
   * Role on the tile: host sees everyone; a player sees only their own; others’ roles are hidden.
   * Uses `roleByPeerId` (filled after host reshuffle + WS sync, or on join state apply).
   */
  function startTimer(durationMs: number): void {
    if (!isMafiaHost.value) {
      mafiaGameLog.info('startTimer ignored: not mafia host')
      return
    }
    if (!Number.isFinite(durationMs) || durationMs < MAFIA_TIMER_MIN_MS || durationMs > 90_000) {
      mafiaGameLog.info('startTimer ignored: use 30s / 60s / 90s presets only', { durationMs })
      return
    }
    const startedAt = Date.now()
    const duration = Math.floor(durationMs)
    const next: MafiaTimerState = { startedAt, duration, isRunning: true }
    mafiaTimer.value = next
    timerStartBroadcastPayload.value = next
    mafiaGameLog.info('timer started', next)
  }

  function stopTimer(): void {
    if (!isMafiaHost.value) {
      mafiaGameLog.info('stopTimer ignored: not mafia host')
      return
    }
    mafiaTimer.value = null
    timerStopBroadcastPayload.value = TIMER_STOP_SENTINEL
    mafiaGameLog.info('timer stopped')
  }

  function applyMafiaTimerFromSignaling(payload: MafiaTimerStartPayload): void {
    if (
      typeof payload.startedAt !== 'number' ||
      !Number.isFinite(payload.startedAt) ||
      typeof payload.duration !== 'number' ||
      !Number.isFinite(payload.duration) ||
      payload.duration < 1000 ||
      payload.duration > MAFIA_TIMER_MAX_MS
    ) {
      return
    }
    if (payload.isRunning === false) {
      mafiaTimer.value = null
      return
    }
    mafiaTimer.value = {
      startedAt: Math.floor(payload.startedAt),
      duration: Math.floor(payload.duration),
      isRunning: true,
    }
  }

  function applyMafiaTimerStopFromSignaling(): void {
    mafiaTimer.value = null
  }

  /**
   * UI: show elimination placeholder only when a round is active and this peer was kicked / marked dead.
   */
  function isMafiaPeerEliminated(peerId: string): boolean {
    if (phase.value == null) {
      return false
    }
    return aliveByPeerId.value[peerId] === false
  }

  type KickResult = { ok: true } | { ok: false; reason: 'not-host' | 'bad-peer' | 'self' | 'no-game' | 'already' }

  /**
   * Host: mark a remote player dead and broadcast; tiles hide video for everyone.
   */
  function kickPlayer(peerId: string): KickResult {
    if (!isMafiaHost.value) {
      return { ok: false, reason: 'not-host' }
    }
    const self = callSession.selfPeerId
    if (typeof self === 'string' && peerId === self) {
      return { ok: false, reason: 'self' }
    }
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return { ok: false, reason: 'bad-peer' }
    }
    if (phase.value == null) {
      return { ok: false, reason: 'no-game' }
    }
    const players = useMafiaPlayersStore()
    if (!players.joinOrder.includes(peerId)) {
      return { ok: false, reason: 'bad-peer' }
    }
    if (aliveByPeerId.value[peerId] === false) {
      return { ok: false, reason: 'already' }
    }
    aliveByPeerId.value = { ...aliveByPeerId.value, [peerId]: false }
    kickBroadcastPayload.value = { peerId }
    mafiaGameLog.info('player kicked', { peerId })
    return { ok: true }
  }

  function applyMafiaKickFromSignaling(payload: MafiaPlayerKickPayload): void {
    if (!payload || typeof payload.peerId !== 'string' || payload.peerId.length < 1) {
      return
    }
    aliveByPeerId.value = { ...aliveByPeerId.value, [payload.peerId]: false }
  }

  function applyMafiaReviveFromSignaling(payload: MafiaPlayerRevivePayload): void {
    if (!payload || typeof payload.peerId !== 'string' || payload.peerId.length < 1) {
      return
    }
    aliveByPeerId.value = { ...aliveByPeerId.value, [payload.peerId]: true }
  }

  function clearKickBroadcastPayload(): void {
    kickBroadcastPayload.value = null
  }

  function clearReviveBroadcastPayload(): void {
    reviveBroadcastPayload.value = null
  }

  type ReviveResult = { ok: true } | { ok: false; reason: 'not-host' | 'bad-peer' | 'no-game' | 'not-dead' | 'self' }

  /**
   * Host: mark a remote player alive again; broadcast to room.
   */
  function revivePlayer(peerId: string): ReviveResult {
    if (!isMafiaHost.value) {
      return { ok: false, reason: 'not-host' }
    }
    const self = callSession.selfPeerId
    if (typeof self === 'string' && peerId === self) {
      return { ok: false, reason: 'self' }
    }
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return { ok: false, reason: 'bad-peer' }
    }
    if (phase.value == null) {
      return { ok: false, reason: 'no-game' }
    }
    const players = useMafiaPlayersStore()
    if (!players.joinOrder.includes(peerId)) {
      return { ok: false, reason: 'bad-peer' }
    }
    if (aliveByPeerId.value[peerId] !== false) {
      return { ok: false, reason: 'not-dead' }
    }
    aliveByPeerId.value = { ...aliveByPeerId.value, [peerId]: true }
    reviveBroadcastPayload.value = { peerId }
    mafiaGameLog.info('player revived', { peerId })
    return { ok: true }
  }

  /** Host: kill if alive, revive if dead (tile 💀 / ❤️). */
  function hostToggleMafiaPlayerLife(peerId: string): KickResult | ReviveResult {
    if (aliveByPeerId.value[peerId] === false) {
      return revivePlayer(peerId)
    }
    return kickPlayer(peerId)
  }

  function clearTimerStartBroadcastPayload(): void {
    timerStartBroadcastPayload.value = null
  }

  function clearTimerStopBroadcastPayload(): void {
    timerStopBroadcastPayload.value = null
  }

  function getMafiaRoleVisibleForTile(peerId: string): MafiaRole | undefined {
    const r = roleByPeerId.value[peerId]
    if (r == null) {
      return undefined
    }
    if (isMafiaHost.value) {
      return r
    }
    const self = callSession.selfPeerId
    if (typeof self === 'string' && self.length > 0 && self === peerId) {
      return r
    }
    return undefined
  }

  return {
    phase,
    nightActions,
    lastNightResult,
    activeNightActionRole,
    hostInteractionMode,
    speakingQueue,
    numberingOrder,
    numberingKey,
    roleByPeerId,
    aliveByPeerId,
    mafiaHostPeerId,
    isMafiaHost,
    setMafiaHostFromSignaling,
    getDisplayNumberingOrder,
    reconcileNumberingWithEngine,
    pruneGameStateToPeers,
    pruneNightActionsToMaxSeat,
    pruneSpeakingQueueToMaxSeat,
    applySpeakingQueueFromSignaling,
    setActiveNightActionRole,
    assignNightActionForSeat,
    assignOrClearNightActionForActiveRole,
    setNightAction,
    setHostInteractionMode,
    addSpeakingSeatIfNew,
    removeSpeakingSeat,
    clearSpeakingQueue,
    clearHostToolbarSelections,
    reshuffleGame,
    clearWhenLeavingMafiaRoute,
    fullReset,
    getMafiaRoleVisibleForTile,
    reshuffleBroadcastPayload,
    applyMafiaReshuffleFromSignaling,
    clearReshuffleBroadcastPayload,
    hostSeatSwapSelectionPeerId,
    applyingPlayersUpdateFromSignaling,
    isApplyingMafiaReshuffle,
    playersUpdateBroadcastPayload,
    setSeatSwapSelectionPeerId,
    swapSeatsByPeerId,
    applyMafiaPlayersUpdateFromSignaling,
    clearPlayersUpdateBroadcastPayload,
    mafiaTimer,
    startTimer,
    stopTimer,
    applyMafiaTimerFromSignaling,
    applyMafiaTimerStopFromSignaling,
    timerStartBroadcastPayload,
    clearTimerStartBroadcastPayload,
    timerStopBroadcastPayload,
    clearTimerStopBroadcastPayload,
    kickBroadcastPayload,
    kickPlayer,
    applyMafiaKickFromSignaling,
    clearKickBroadcastPayload,
    reviveBroadcastPayload,
    revivePlayer,
    applyMafiaReviveFromSignaling,
    clearReviveBroadcastPayload,
    hostToggleMafiaPlayerLife,
    isMafiaPeerEliminated,
  }
})
