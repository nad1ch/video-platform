import { defineStore } from 'pinia'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useCallSessionStore } from 'call-core'
import { createLogger } from '@/utils/logger'
import { buildMafiaRoleDeck, MafiaPlayerCountError } from '@/utils/mafiaGameRoleDeck'
import type {
  BackgroundItem,
  MafiaHostInteractionMode,
  MafiaEliminationBackground,
  MafiaBackgroundItem,
  MafiaLastNightResult,
  MafiaModeUpdatePayload,
  MafiaNightActionKey,
  MafiaNightActions,
  MafiaPhase,
  MafiaPlayerLifeState,
  MafiaPlayerLifeStateSnapshotPayload,
  MafiaPlayerOverlayState,
  MafiaPlayersUpdatePayload,
  MafiaReshufflePayload,
  MafiaRole,
  MafiaSettingsUpdatePayload,
  MafiaPageBackgroundSettings,
  MafiaPlayerKickPayload,
  MafiaPlayerRevivePayload,
  MafiaTimerStartPayload,
  MafiaTimerState,
  MafiaTimerStopPayload,
} from '@/utils/mafiaGameTypes'
import { computeMafiaLastNightResult } from '@/utils/mafiaLastNightResult'
import { fisherYatesShuffle } from '@/utils/fisherYatesShuffle'
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers'
import { mafiaNightActionMaxSeatForOrder, pinHostPeerToEndOfOrder } from '@/utils/mafiaHostOrdering'
import { GAME_TIMER_PRESET_MS } from '@/utils/gameTimerPresets'
import {
  appendSpeakingPair,
  applySpeakingQueueFromSignaling as applySpeakingQueueFromSignalingShared,
  remapSpeakingQueueForSeatSwap as remapSpeakingQueueForSeatSwapShared,
  removeSpeakingPairAt,
} from '@/utils/speakingNominationController'

const mafiaGameLog = createLogger('mafia-game')





const NIGHT_ACTION_ROLES: MafiaNightActionKey[] = ['mafia', 'doctor', 'sheriff', 'don']

const MAFIA_ROLES: ReadonlySet<MafiaRole> = new Set(['mafia', 'don', 'sheriff', 'doctor', 'civilian'])
const MAFIA_ELIMINATION_BACKGROUNDS: ReadonlySet<MafiaEliminationBackground> = new Set([
  'dark',
  'red',
  'violet',
  'gray',
])
const MAFIA_PRESET_BACKGROUND_ITEMS = Object.freeze(
  [...MAFIA_ELIMINATION_BACKGROUNDS].map((background) => ({
    id: `preset-${background}`,
    url: `preset:${background}`,
    type: 'preset' as const,
  })),
) satisfies readonly MafiaBackgroundItem[]
const MAFIA_CUSTOM_BACKGROUND_MAX_URL_LENGTH = 7_000_000
const MAFIA_BACKGROUND_STORAGE_PREFIX = 'streamassist_mafia_dead_backgrounds'
const MAFIA_PAGE_BACKGROUND_STORAGE_PREFIX = 'streamassist_mafia_page_backgrounds'
const MAFIA_BACKGROUND_STORAGE_KEY = `${MAFIA_BACKGROUND_STORAGE_PREFIX}:global`
const MAFIA_PAGE_BACKGROUND_STORAGE_KEY = `${MAFIA_PAGE_BACKGROUND_STORAGE_PREFIX}:global`
const APP_HUB_PAGE_BACKGROUND_STORAGE_KEY = 'streamassist_app_hub_page_backgrounds:global'
const MAFIA_HOST_SESSION_STORAGE_KEY = 'streamassist_mafia_host_session_id'
const MAFIA_DEFAULT_PAGE_BACKGROUND_ID = 'default-page'
/** Persisted shell backdrop default; legacy saves used `default-page` for plain canvas. */
export const SHELL_FALLBACK_PAGE_BACKGROUND_ID = 'preset-page-violet'
const MAFIA_PAGE_BACKGROUND_ITEMS = Object.freeze([
  { id: MAFIA_DEFAULT_PAGE_BACKGROUND_ID, url: 'default', type: 'default' as const },
  { id: SHELL_FALLBACK_PAGE_BACKGROUND_ID, url: 'preset:violet', type: 'preset' as const },
  { id: 'preset-page-night', url: 'preset:night', type: 'preset' as const },
]) satisfies readonly BackgroundItem[]


/**
 * Mafia timer presets — re-exported from `@/utils/gameTimerPresets` so the
 * shared `GameTimerOverlay` chip and production Mafia share one source of
 * truth (single tuple, single set of values, no duplication). The constant
 * name is preserved for any in-tree importers of `MAFIA_TIMER_PRESET_MS`.
 */
export const MAFIA_TIMER_PRESET_MS = GAME_TIMER_PRESET_MS

const MAFIA_TIMER_MIN_MS = 30_000
const MAFIA_TIMER_MAX_MS = 7_200_000
const MAFIA_RESHUFFLE_MIN_INTERVAL_MS = 700

const TIMER_STOP_SENTINEL: MafiaTimerStopPayload = Object.freeze({})

function createMafiaHostSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mafia-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readMafiaHostSessionId(): string {
  if (typeof window === 'undefined') {
    return createMafiaHostSessionId()
  }
  try {
    const existing = window.sessionStorage.getItem(MAFIA_HOST_SESSION_STORAGE_KEY)
    if (existing && existing.trim().length > 0) {
      return existing.trim()
    }
    const next = createMafiaHostSessionId()
    window.sessionStorage.setItem(MAFIA_HOST_SESSION_STORAGE_KEY, next)
    return next
  } catch {
    return createMafiaHostSessionId()
  }
}

export const useMafiaGameStore = defineStore('mafiaGame', () => {
  const callSession = useCallSessionStore()

  const phase = ref<MafiaPhase | null>(null)
  
  const nightActions = ref<MafiaNightActions>({})

  
  const activeNightActionRole = ref<MafiaNightActionKey>('mafia')

  
  const numberingOrder = ref<string[]>([])
  /**
   * True only after explicit host-driven order sync (`players-update` / reshuffle / seat-swap).
   * Until then, UI order should follow deterministic engine peer order for all clients.
   */
  const numberingOrderAuthoritative = ref(false)

  const roleByPeerId = shallowRef<Record<string, MafiaRole>>({})
  const playerOverlayStateByPeerId = shallowRef<Record<string, MafiaPlayerOverlayState>>({})

  /** Mafia “ведучий” — stable user id from signaling; peer id is only an online hint. */
  const mafiaHostPeerId = ref<string | null>(null)
  const mafiaHostUserId = ref<string | null>(null)
  const mafiaHostSessionId = ref<string | null>(null)
  const localMafiaSessionId = ref(readMafiaHostSessionId())
  const localMafiaUserId = ref<string | null>(null)

  const isMafiaHost = computed(() => {
    const hostPeerId = mafiaHostPeerId.value
    const hostUserId = mafiaHostUserId.value
    const hostSessionId = mafiaHostSessionId.value
    const localUserId = localMafiaUserId.value
    const localSessionId = localMafiaSessionId.value
    const localPeerId = callSession.selfPeerId
    if (
      hostPeerId == null ||
      hostPeerId === '' ||
      hostUserId == null ||
      hostUserId === '' ||
      hostSessionId == null ||
      hostSessionId === '' ||
      localUserId == null ||
      localUserId === '' ||
      localSessionId === ''
    ) {
      return false
    }
    return localUserId === hostUserId && localSessionId === hostSessionId && localPeerId === hostPeerId
  })

  
  const reshuffleBroadcastPayload = ref<MafiaReshufflePayload | null>(null)
  const lastReshuffleStartedAtMs = ref(0)

  
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
  const modeUpdateBroadcastPayload = ref<MafiaModeUpdatePayload | null>(null)
  const settingsUpdateBroadcastPayload = ref<MafiaSettingsUpdatePayload | null>(null)
  const pageBackgroundSettingsBroadcastPayload = ref<MafiaPageBackgroundSettings | null>(null)

  
  const mafiaTimer = ref<MafiaTimerState | null>(null)

  /**
   * Live host-selected timer preset (ms). Mirrored across all peers via
   * `mafia:timer-preset-select`. `null` means "no live override; clients
   * use their local default". Survives Start/Stop so the chip returns to
   * the host's last picked idle duration after a Stop.
   */
  const mafiaSelectedTimerDurationMs = ref<number | null>(null)
  const timerPresetSelectBroadcastPayload = ref<number | null>(null)


  const timerStartBroadcastPayload = ref<MafiaTimerStartPayload | null>(null)


  const timerStopBroadcastPayload = ref<MafiaTimerStopPayload | null>(null)

  
  const kickBroadcastPayload = ref<MafiaPlayerKickPayload | null>(null)
  const reviveBroadcastPayload = ref<MafiaPlayerRevivePayload | null>(null)

  /**
   * Server-authoritative room-wide "host clicked mute all" flag (P1 Bug 1).
   *
   * The host UI button state is NOT this flag alone — it is the AND of
   * (this flag) AND (every non-host peer is currently effectively muted),
   * via {@link everyNonHostEffectivelyMuted}. That way, if any non-host
   * peer becomes audible (e.g. host transfer leaves the previous host
   * unmuted, or future server changes lift forced-mute for someone), the
   * host can press "mute all" again with one click.
   *
   * Server replays this on `handleJoinRoom` (Mafia replay block) so reload
   * of the host tab AND OBS reload both derive button state from server,
   * not a stale local ref.
   */
  const mafiaForceMuteAllActive = ref(false)

  /**
   * Per-peer effective audio-muted state, populated from the call signaling
   * messages `room-state.peers[].audioMuted` (initial snapshot) and
   * `peer-audio-muted` (live updates). Server's `peer-audio-muted` already
   * encodes effective mute (`audioMuted || forcedAudioMuted`), so this
   * map carries the final UI-visible state.
   *
   * Used by {@link everyNonHostEffectivelyMuted}.
   */
  const peerEffectiveMutedByPeerId = shallowRef<Record<string, boolean>>({})

  function setMafiaForceMuteAllActiveFromSignaling(active: boolean): void {
    mafiaForceMuteAllActive.value = active === true
  }

  /** Snapshot replace from `room-state.peers[].audioMuted`. */
  function replacePeerEffectiveMutedSnapshot(snapshot: Record<string, boolean>): void {
    const next: Record<string, boolean> = {}
    for (const [peerId, muted] of Object.entries(snapshot)) {
      if (typeof peerId === 'string' && peerId.length > 0 && muted === true) {
        next[peerId] = true
      }
    }
    peerEffectiveMutedByPeerId.value = next
  }

  /** Single-peer update from `peer-audio-muted`. */
  function setPeerEffectiveMuted(peerId: string, muted: boolean): void {
    if (typeof peerId !== 'string' || peerId.length === 0) return
    const current = peerEffectiveMutedByPeerId.value
    const has = current[peerId] === true
    if (muted === has) {
      return
    }
    const next = { ...current }
    if (muted === true) {
      next[peerId] = true
    } else {
      delete next[peerId]
    }
    peerEffectiveMutedByPeerId.value = next
  }

  function clearPeerEffectiveMuted(peerId: string): void {
    if (typeof peerId !== 'string' || peerId.length === 0) return
    if (peerEffectiveMutedByPeerId.value[peerId] !== true) return
    const next = { ...peerEffectiveMutedByPeerId.value }
    delete next[peerId]
    peerEffectiveMutedByPeerId.value = next
  }

  /**
   * Computed: does every non-host peer currently appear effectively muted?
   *
   * Inputs are the CallPage-maintained `peerEffectiveMutedByPeerId` (from
   * `peer-audio-muted` + `room-state` snapshot) and the engine's join order
   * (passed to {@link setNonHostPeerIds}). Empty room → `true` by convention
   * (no one to be unmuted) so the toggle stays in "active" visual state
   * after host reload of an empty room.
   */
  const nonHostPeerIds = ref<string[]>([])

  function setNonHostPeerIds(ids: string[]): void {
    if (!Array.isArray(ids)) {
      nonHostPeerIds.value = []
      return
    }
    const hostId = mafiaHostPeerId.value
    const next: string[] = []
    const seen = new Set<string>()
    for (const id of ids) {
      if (typeof id !== 'string' || id.length === 0) continue
      if (id === hostId) continue
      if (seen.has(id)) continue
      seen.add(id)
      next.push(id)
    }
    nonHostPeerIds.value = next
  }

  const everyNonHostEffectivelyMuted = computed(() => {
    if (nonHostPeerIds.value.length === 0) return true
    const map = peerEffectiveMutedByPeerId.value
    for (const id of nonHostPeerIds.value) {
      if (map[id] !== true) return false
    }
    return true
  })

  /**
   * Eat First call (`/app/eat` + CallPage): host may eliminate/revive via the same
   * `mafia:player-kick` / `mafia:player-revive` messages; `isMafiaHost` stays false.
   */
  const eatFirstCallEliminationHost = ref(false)

  function setEatFirstCallEliminationHost(on: boolean): void {
    eatFirstCallEliminationHost.value = on === true
    if (eatFirstCallEliminationHost.value) {
      hydratePersistedBackgroundSettingsForHost()
    }
  }

  function setLocalMafiaUserId(userId: string | null): void {
    localMafiaUserId.value = typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null
  }

  function setMafiaHostFromSignaling(peerId: string | null, userId?: string | null, sessionId?: string | null): void {
    mafiaHostPeerId.value = peerId
    mafiaHostUserId.value = typeof userId === 'string' && userId.length > 0 ? userId : null
    mafiaHostSessionId.value = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null
    hydratePersistedBackgroundSettingsForHost()
    if (numberingOrder.value.length > 0) {
      pinMafiaHostPeerToEndOfNumberingOrder()
    }
    if (isMafiaHost.value) {
      hydratePersistedPageBackgroundSettings()
      emitPageBackgroundSettingsUpdate()
    }
  }

  
  const hostInteractionMode = ref<MafiaHostInteractionMode>('night')
  const oldMafiaMode = ref(true)
  const deadBackgrounds = ref<MafiaBackgroundItem[]>([...MAFIA_PRESET_BACKGROUND_ITEMS])
  const activeBackgroundId = ref<string | null>(null)
  const pageBackgrounds = ref<BackgroundItem[]>([...MAFIA_PAGE_BACKGROUND_ITEMS])
  const selectedPageBackgroundId = ref<string | null>(null)
  const forcedPageBackgroundId = ref<string | null>(null)
  const appHubPageBackgrounds = ref<BackgroundItem[]>([...MAFIA_PAGE_BACKGROUND_ITEMS])
  const appHubSelectedPageBackgroundId = ref<string | null>(null)
  const defaultEliminationBackground = ref<MafiaEliminationBackground>('dark')
  const eliminationBackgroundByPeerId = shallowRef<Record<string, MafiaEliminationBackground>>({})

  /**
   * Shared nomination / speaking queue (1-based seat numbers).
   * Pair-encoded when even length: `[by1, target1, by2, target2, ...]`.
   * Odd length is treated as legacy target-only lists when decoding for display.
   */
  const speakingQueue = ref<number[]>([])

  /** Host: first click in speaking mode picks the nominator seat; second click completes the pair. */
  const speakingNominationDraftBySeat = ref<number | null>(null)

  function clearSpeakingNominationDraft(): void {
    speakingNominationDraftBySeat.value = null
  }

  const numberingKey = computed(() => numberingOrder.value.join('\u0000'))

  
  const lastNightResult = computed((): MafiaLastNightResult | null =>
    computeMafiaLastNightResult(nightActions.value),
  )

  function getDisplayNumberingOrder(engineJoin: string[]): string[] {
    if (!numberingOrderAuthoritative.value || numberingOrder.value.length === 0) {
      return engineJoin
    }
    return numberingOrder.value
  }

  


  function reconcileNumberingWithEngine(engineOrder: string[]): void {
    if (numberingOrder.value.length === 0 || !numberingOrderAuthoritative.value) {
      numberingOrder.value = [...engineOrder]
      pinMafiaHostPeerToEndOfNumberingOrder()
      return
    }
    const filtered = [...numberingOrder.value]
    const explicitHostId = typeof mafiaHostPeerId.value === 'string' ? mafiaHostPeerId.value.trim() : ''
    const hostAnchorId =
      explicitHostId.length > 0
        ? explicitHostId
        : filtered.length > 0
          ? filtered[filtered.length - 1] ?? ''
          : ''
    const next: string[] = []
    const seen = new Set<string>()
    for (const id of filtered) {
      if (hostAnchorId.length > 0 && id === hostAnchorId) {
        continue
      }
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
    if (hostAnchorId.length > 0 && !seen.has(hostAnchorId)) {
      next.push(hostAnchorId)
      seen.add(hostAnchorId)
    }
    const nextKey = next.join('\u0000')
    const curKey = numberingOrder.value.join('\u0000')
    if (nextKey === curKey) {
      pinMafiaHostPeerToEndOfNumberingOrder()
      return
    }
    numberingOrder.value = next
    pinMafiaHostPeerToEndOfNumberingOrder()
  }

  
  function pruneGameStateToPeers(engineOrder: string[]): void {
    if (numberingOrderAuthoritative.value) {
      // After host-defined order/roles are established, keep seat+role across
      // transient disconnect/reload. Host reshuffle / explicit players-update
      // remains the authority for changing this mapping.
      return
    }
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
    const bg = { ...eliminationBackgroundByPeerId.value }
    for (const k of Object.keys(bg)) {
      if (!s.has(k)) {
        delete bg[k]
      }
    }
    eliminationBackgroundByPeerId.value = bg
  }

  
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

  function pinMafiaHostPeerToEndOfNumberingOrder(): void {
    const hp = mafiaHostPeerId.value
    const next = pinHostPeerToEndOfOrder(numberingOrder.value, hp)
    if (next.join('\u0000') !== numberingOrder.value.join('\u0000')) {
      numberingOrder.value = next
    }
    if (typeof hp === 'string' && hp.length > 0 && roleByPeerId.value[hp] != null) {
      const nextR = { ...roleByPeerId.value }
      delete nextR[hp]
      roleByPeerId.value = nextR
    }
  }

  function setActiveNightActionRole(k: MafiaNightActionKey): void {
    activeNightActionRole.value = k
  }

  


  function setNightAction(role: MafiaNightActionKey, seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    const maxSeat = mafiaNightActionMaxSeatForOrder(numberingOrder.value, mafiaHostPeerId.value)
    if (maxSeat >= 1 && seat > maxSeat) {
      return
    }
    nightActions.value = { ...nightActions.value, [role]: seat }
    mafiaGameLog.info('night action set', { role, seat })
    void nextTick()
  }

  



  function assignNightActionForSeat(seat: number): void {
    if (!isMafiaHost.value) {
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    setNightAction(activeNightActionRole.value, seat)
  }

  


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
    if (mode !== 'speaking') {
      clearSpeakingNominationDraft()
    }
  }

  function setOldMafiaMode(value: boolean): void {
    if (oldMafiaMode.value === value) {
      return
    }
    oldMafiaMode.value = value
    if (value) {
      mafiaTimer.value = null
      timerStopBroadcastPayload.value = TIMER_STOP_SENTINEL
    }
    if (isMafiaHost.value) {
      modeUpdateBroadcastPayload.value = { mode: value ? 'old' : 'new' }
    }
  }

  function normalizeEliminationBackground(value: MafiaEliminationBackground): MafiaEliminationBackground {
    return MAFIA_ELIMINATION_BACKGROUNDS.has(value) ? value : 'dark'
  }

  function normalizeLifeState(value: unknown): MafiaPlayerLifeState {
    return value === 'dead' || value === 'ghost' ? value : 'alive'
  }

  function lifeStateForPeer(peerId: string): MafiaPlayerLifeState {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return 'alive'
    }
    return playerOverlayStateByPeerId.value[peerId]?.lifeState ?? 'alive'
  }

  function setPeerLifeState(peerId: string, lifeState: MafiaPlayerLifeState): void {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return
    }
    if (lifeStateForPeer(peerId) === lifeState) {
      return
    }
    if (lifeState === 'alive') {
      if (playerOverlayStateByPeerId.value[peerId] == null) {
        return
      }
      const next = { ...playerOverlayStateByPeerId.value }
      delete next[peerId]
      playerOverlayStateByPeerId.value = next
      return
    }
    playerOverlayStateByPeerId.value = {
      ...playerOverlayStateByPeerId.value,
      [peerId]: { lifeState },
    }
  }

  function setDefaultEliminationBackground(value: MafiaEliminationBackground): void {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return
    }
    const next = normalizeEliminationBackground(value)
    setActiveDeadBackgroundId(`preset-${next}`)
  }

  function normalizeDeadBackgroundUrl(value: string | null): string | null {
    if (value == null) {
      return null
    }
    const next = value.trim()
    if (next.length < 1) {
      return null
    }
    if (next.length > MAFIA_CUSTOM_BACKGROUND_MAX_URL_LENGTH) {
      return null
    }
    return next
  }

  function normalizePageBackgroundItems(items: BackgroundItem[]): BackgroundItem[] {
    const out: BackgroundItem[] = [...MAFIA_PAGE_BACKGROUND_ITEMS]
    const seen = new Set(out.map((item) => item.id))
    for (const item of items) {
      if (!item || item.type !== 'custom') {
        continue
      }
      if (typeof item.id !== 'string' || item.id.length < 1 || seen.has(item.id)) {
        continue
      }
      const url = normalizeDeadBackgroundUrl(item.url)
      if (url == null) {
        continue
      }
      seen.add(item.id)
      out.push({ id: item.id, url, type: 'custom' })
    }
    return out
  }

  function pageBackgroundExists(backgroundId: string | null, items = pageBackgrounds.value): boolean {
    return backgroundId != null && items.some((item) => item.id === backgroundId)
  }

  function pageBackgroundSettingsStorageKey(): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    return MAFIA_PAGE_BACKGROUND_STORAGE_KEY
  }

  function legacyRoomPageBackgroundSettingsStorageKey(): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    const roomId = String(callSession.roomId ?? '').trim() || 'demo'
    return `${MAFIA_PAGE_BACKGROUND_STORAGE_PREFIX}:${roomId}`
  }

  function persistPageBackgroundSettingsForCurrentRoom(): void {
    const key = pageBackgroundSettingsStorageKey()
    if (key == null) {
      return
    }
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          v: 1,
          backgrounds: pageBackgrounds.value,
          selectedBackgroundId: selectedPageBackgroundId.value,
        }),
      )
    } catch (err) {
      mafiaGameLog.info('page background settings persist failed', { err })
    }
  }

  function readPersistedPageBackgroundSettings(): Pick<MafiaPageBackgroundSettings, 'backgrounds' | 'selectedBackgroundId'> | null {
    const key = pageBackgroundSettingsStorageKey()
    if (key == null) {
      return null
    }
    try {
      const legacyKey = legacyRoomPageBackgroundSettingsStorageKey()
      const globalRaw = window.localStorage.getItem(key)
      const legacyRaw = legacyKey != null ? window.localStorage.getItem(legacyKey) : null
      const raw = globalRaw ?? legacyRaw
      if (!raw) {
        return null
      }
      if (globalRaw == null && legacyRaw != null) {
        window.localStorage.setItem(key, legacyRaw)
      }
      const parsed = JSON.parse(raw) as { backgrounds?: unknown; selectedBackgroundId?: unknown }
      if (!Array.isArray(parsed.backgrounds)) {
        return null
      }
      return {
        backgrounds: parsed.backgrounds as BackgroundItem[],
        selectedBackgroundId: typeof parsed.selectedBackgroundId === 'string' ? parsed.selectedBackgroundId : null,
      }
    } catch {
      return null
    }
  }

  function persistAppHubPageBackgroundSettings(): void {
    const key = typeof window === 'undefined' ? null : APP_HUB_PAGE_BACKGROUND_STORAGE_KEY
    if (key == null) {
      return
    }
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          v: 1,
          backgrounds: appHubPageBackgrounds.value,
          selectedBackgroundId: appHubSelectedPageBackgroundId.value,
        }),
      )
    } catch (err) {
      mafiaGameLog.info('app hub page background settings persist failed', { err })
    }
  }

  function readPersistedAppHubPageBackgroundSettings(): Pick<
    MafiaPageBackgroundSettings,
    'backgrounds' | 'selectedBackgroundId'
  > | null {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const raw = window.localStorage.getItem(APP_HUB_PAGE_BACKGROUND_STORAGE_KEY)
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as { backgrounds?: unknown; selectedBackgroundId?: unknown }
      if (!Array.isArray(parsed.backgrounds)) {
        return null
      }
      return {
        backgrounds: parsed.backgrounds as BackgroundItem[],
        selectedBackgroundId: typeof parsed.selectedBackgroundId === 'string' ? parsed.selectedBackgroundId : null,
      }
    } catch {
      return null
    }
  }

  function hydratePersistedAppHubPageBackgroundSettings(): void {
    const persisted = readPersistedAppHubPageBackgroundSettings()
    if (persisted == null) {
      appHubSelectedPageBackgroundId.value = MAFIA_DEFAULT_PAGE_BACKGROUND_ID
      persistAppHubPageBackgroundSettings()
      return
    }
    const items = normalizePageBackgroundItems(persisted.backgrounds)
    appHubPageBackgrounds.value = items
    let sid = persisted.selectedBackgroundId
    if (sid != null && !pageBackgroundExists(sid, items)) {
      sid = MAFIA_DEFAULT_PAGE_BACKGROUND_ID
    }
    if (sid == null) {
      sid = MAFIA_DEFAULT_PAGE_BACKGROUND_ID
    }
    appHubSelectedPageBackgroundId.value = sid
    persistAppHubPageBackgroundSettings()
  }

  function hydratePersistedPageBackgroundSettings(): void {
    const persisted = readPersistedPageBackgroundSettings()
    if (persisted == null) {
      selectedPageBackgroundId.value = SHELL_FALLBACK_PAGE_BACKGROUND_ID
      persistPageBackgroundSettingsForCurrentRoom()
      return
    }
    const items = normalizePageBackgroundItems(persisted.backgrounds)
    pageBackgrounds.value = items
    let selectedId = persisted.selectedBackgroundId
    if (selectedId != null && !pageBackgroundExists(selectedId, items)) {
      selectedId = SHELL_FALLBACK_PAGE_BACKGROUND_ID
    }
    if (selectedId == null) {
      selectedId = SHELL_FALLBACK_PAGE_BACKGROUND_ID
    }
    selectedPageBackgroundId.value = selectedId
    persistPageBackgroundSettingsForCurrentRoom()
  }

  function pageBackgroundSettingsSnapshot(): MafiaPageBackgroundSettings {
    return {
      backgrounds: [...pageBackgrounds.value],
      selectedBackgroundId: selectedPageBackgroundId.value,
      forcedBackgroundId: forcedPageBackgroundId.value,
    }
  }

  function emitPageBackgroundSettingsUpdate(): void {
    persistPageBackgroundSettingsForCurrentRoom()
    pageBackgroundSettingsBroadcastPayload.value = pageBackgroundSettingsSnapshot()
  }

  hydratePersistedPageBackgroundSettings()
  hydratePersistedAppHubPageBackgroundSettings()

  watch(
    () => callSession.roomId,
    () => {
      forcedPageBackgroundId.value = null
      hydratePersistedPageBackgroundSettings()
    },
  )

  function normalizeBackgroundItems(items: MafiaBackgroundItem[]): MafiaBackgroundItem[] {
    const out: MafiaBackgroundItem[] = [...MAFIA_PRESET_BACKGROUND_ITEMS]
    const seen = new Set(out.map((item) => item.id))
    for (const item of items) {
      if (!item || item.type !== 'custom') {
        continue
      }
      if (typeof item.id !== 'string' || item.id.length < 1 || seen.has(item.id)) {
        continue
      }
      const url = normalizeDeadBackgroundUrl(item.url)
      if (url == null) {
        continue
      }
      seen.add(item.id)
      out.push({ id: item.id, url, type: 'custom' })
    }
    return out
  }

  function backgroundSettingsStorageKey(): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    return MAFIA_BACKGROUND_STORAGE_KEY
  }

  function legacyRoomBackgroundSettingsStorageKey(): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    const roomId = String(callSession.roomId ?? '').trim() || 'demo'
    return `${MAFIA_BACKGROUND_STORAGE_PREFIX}:${roomId}`
  }

  function persistBackgroundSettingsForCurrentRoom(): void {
    const key = backgroundSettingsStorageKey()
    if (key == null) {
      return
    }
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          v: 1,
          deadBackgrounds: deadBackgrounds.value,
          activeBackgroundId: activeBackgroundId.value,
        }),
      )
    } catch (err) {
      mafiaGameLog.info('dead background settings persist failed', { err })
    }
  }

  function readPersistedBackgroundSettings(): MafiaSettingsUpdatePayload | null {
    const key = backgroundSettingsStorageKey()
    if (key == null) {
      return null
    }
    try {
      const legacyKey = legacyRoomBackgroundSettingsStorageKey()
      const globalRaw = window.localStorage.getItem(key)
      const legacyRaw = legacyKey != null ? window.localStorage.getItem(legacyKey) : null
      const raw = globalRaw ?? legacyRaw
      if (!raw) {
        return null
      }
      if (globalRaw == null && legacyRaw != null) {
        window.localStorage.setItem(key, legacyRaw)
      }
      const parsed = JSON.parse(raw) as {
        deadBackgrounds?: unknown
        activeBackgroundId?: unknown
      }
      if (!Array.isArray(parsed.deadBackgrounds)) {
        return null
      }
      return {
        deadBackgrounds: parsed.deadBackgrounds as MafiaBackgroundItem[],
        activeBackgroundId: typeof parsed.activeBackgroundId === 'string' ? parsed.activeBackgroundId : null,
      }
    } catch {
      return null
    }
  }

  function hydratePersistedBackgroundSettingsForHost(): void {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return
    }
    const persisted = readPersistedBackgroundSettings()
    if (persisted == null) {
      return
    }
    const items = normalizeBackgroundItems(persisted.deadBackgrounds)
    deadBackgrounds.value = items
    activeBackgroundId.value = backgroundExists(persisted.activeBackgroundId, items)
      ? persisted.activeBackgroundId
      : null
    defaultEliminationBackground.value = activePresetBackground()
    emitSettingsUpdate()
  }

  function backgroundExists(backgroundId: string | null, items = deadBackgrounds.value): boolean {
    return backgroundId != null && items.some((item) => item.id === backgroundId)
  }

  function activePresetBackground(): MafiaEliminationBackground {
    const item = deadBackgrounds.value.find((background) => background.id === activeBackgroundId.value)
    if (item?.type !== 'preset') {
      return 'dark'
    }
    const raw = item.url.startsWith('preset:') ? item.url.slice('preset:'.length) : item.id.replace(/^preset-/, '')
    return normalizeEliminationBackground(raw as MafiaEliminationBackground)
  }

  function emitSettingsUpdate(): void {
    persistBackgroundSettingsForCurrentRoom()
    settingsUpdateBroadcastPayload.value = {
      deadBackgrounds: [...deadBackgrounds.value],
      activeBackgroundId: activeBackgroundId.value,
    }
  }

  function setActiveDeadBackgroundId(backgroundId: string | null): void {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return
    }
    const next = backgroundExists(backgroundId) ? backgroundId : null
    activeBackgroundId.value = next
    defaultEliminationBackground.value = activePresetBackground()
    emitSettingsUpdate()
  }

  function addCustomDeadBackground(url: string): MafiaBackgroundItem | null {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return null
    }
    const normalizedUrl = normalizeDeadBackgroundUrl(url)
    if (normalizedUrl == null) {
      return null
    }
    const item: MafiaBackgroundItem = {
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      url: normalizedUrl,
      type: 'custom',
    }
    deadBackgrounds.value = normalizeBackgroundItems([...deadBackgrounds.value, item])
    activeBackgroundId.value = item.id
    defaultEliminationBackground.value = activePresetBackground()
    emitSettingsUpdate()
    return item
  }

  function deleteCustomDeadBackground(backgroundId: string): void {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return
    }
    const item = deadBackgrounds.value.find((background) => background.id === backgroundId)
    if (item?.type !== 'custom') {
      return
    }
    deadBackgrounds.value = normalizeBackgroundItems(
      deadBackgrounds.value.filter((background) => background.id !== backgroundId),
    )
    if (activeBackgroundId.value === backgroundId) {
      activeBackgroundId.value = null
    }
    defaultEliminationBackground.value = activePresetBackground()
    emitSettingsUpdate()
  }

  function activeDeadBackgroundUrl(): string | null {
    const item = deadBackgrounds.value.find((background) => background.id === activeBackgroundId.value)
    return item?.type === 'custom' ? item.url : null
  }

  function selectPageBackground(backgroundId: string | null, allowAnyParticipant = false): void {
    const next = pageBackgroundExists(backgroundId) ? backgroundId : null
    selectedPageBackgroundId.value = next
    persistPageBackgroundSettingsForCurrentRoom()
    if (forcedPageBackgroundId.value != null && (allowAnyParticipant || isMafiaHost.value)) {
      forcedPageBackgroundId.value = next ?? SHELL_FALLBACK_PAGE_BACKGROUND_ID
      emitPageBackgroundSettingsUpdate()
    }
  }

  function addCustomPageBackground(url: string, allowAnyParticipant = false): BackgroundItem | null {
    const normalizedUrl = normalizeDeadBackgroundUrl(url)
    if (normalizedUrl == null) {
      return null
    }
    const item: BackgroundItem = {
      id: `page-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      url: normalizedUrl,
      type: 'custom',
    }
    pageBackgrounds.value = normalizePageBackgroundItems([...pageBackgrounds.value, item])
    selectedPageBackgroundId.value = item.id
    persistPageBackgroundSettingsForCurrentRoom()
    if (forcedPageBackgroundId.value != null && (allowAnyParticipant || isMafiaHost.value)) {
      forcedPageBackgroundId.value = item.id
      emitPageBackgroundSettingsUpdate()
    }
    return item
  }

  function deleteCustomPageBackground(backgroundId: string, allowAnyParticipant = false): void {
    const item = pageBackgrounds.value.find((background) => background.id === backgroundId)
    if (item?.type !== 'custom') {
      return
    }
    pageBackgrounds.value = normalizePageBackgroundItems(
      pageBackgrounds.value.filter((background) => background.id !== backgroundId),
    )
    if (selectedPageBackgroundId.value === backgroundId) {
      selectedPageBackgroundId.value = null
    }
    if (forcedPageBackgroundId.value === backgroundId) {
      forcedPageBackgroundId.value = null
      if (allowAnyParticipant || isMafiaHost.value) {
        emitPageBackgroundSettingsUpdate()
      }
    }
    persistPageBackgroundSettingsForCurrentRoom()
  }

  function setPageBackgroundForcedForRoom(enabled: boolean, allowAnyParticipant = false): void {
    if (!allowAnyParticipant && !isMafiaHost.value) {
      return
    }
    forcedPageBackgroundId.value = enabled
      ? pageBackgroundExists(selectedPageBackgroundId.value)
        ? selectedPageBackgroundId.value
        : SHELL_FALLBACK_PAGE_BACKGROUND_ID
      : null
    emitPageBackgroundSettingsUpdate()
  }

  function applyMafiaPageBackgroundSettingsFromSignaling(payload: MafiaPageBackgroundSettings): void {
    const items = normalizePageBackgroundItems(payload.backgrounds)
    pageBackgrounds.value = normalizePageBackgroundItems([...pageBackgrounds.value, ...items])
    forcedPageBackgroundId.value = pageBackgroundExists(payload.forcedBackgroundId, pageBackgrounds.value)
      ? payload.forcedBackgroundId
      : null
    if (!pageBackgroundExists(selectedPageBackgroundId.value, pageBackgrounds.value)) {
      selectedPageBackgroundId.value = null
    }
  }

  function resolvedAppHubPageBackgroundItem(): BackgroundItem {
    const id =
      appHubSelectedPageBackgroundId.value != null &&
      pageBackgroundExists(appHubSelectedPageBackgroundId.value, appHubPageBackgrounds.value)
        ? appHubSelectedPageBackgroundId.value
        : MAFIA_DEFAULT_PAGE_BACKGROUND_ID
    return appHubPageBackgrounds.value.find((background) => background.id === id) ?? MAFIA_PAGE_BACKGROUND_ITEMS[0]!
  }

  function selectAppHubPageBackground(backgroundId: string | null): void {
    if (backgroundId != null && pageBackgroundExists(backgroundId, appHubPageBackgrounds.value)) {
      appHubSelectedPageBackgroundId.value = backgroundId
    } else {
      appHubSelectedPageBackgroundId.value = MAFIA_DEFAULT_PAGE_BACKGROUND_ID
    }
    persistAppHubPageBackgroundSettings()
  }

  function addCustomAppHubPageBackground(url: string): BackgroundItem | null {
    const normalizedUrl = normalizeDeadBackgroundUrl(url)
    if (normalizedUrl == null) {
      return null
    }
    const item: BackgroundItem = {
      id: `app-hub-page-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      url: normalizedUrl,
      type: 'custom',
    }
    appHubPageBackgrounds.value = normalizePageBackgroundItems([...appHubPageBackgrounds.value, item])
    appHubSelectedPageBackgroundId.value = item.id
    persistAppHubPageBackgroundSettings()
    return item
  }

  function deleteCustomAppHubPageBackground(backgroundId: string): void {
    const item = appHubPageBackgrounds.value.find((background) => background.id === backgroundId)
    if (item?.type !== 'custom') {
      return
    }
    appHubPageBackgrounds.value = normalizePageBackgroundItems(
      appHubPageBackgrounds.value.filter((background) => background.id !== backgroundId),
    )
    if (appHubSelectedPageBackgroundId.value === backgroundId) {
      appHubSelectedPageBackgroundId.value = MAFIA_DEFAULT_PAGE_BACKGROUND_ID
    }
    persistAppHubPageBackgroundSettings()
  }

  function resolvedPageBackgroundItem(): BackgroundItem {
    const resolvedId =
      forcedPageBackgroundId.value ??
      selectedPageBackgroundId.value ??
      SHELL_FALLBACK_PAGE_BACKGROUND_ID
    return pageBackgrounds.value.find((background) => background.id === resolvedId) ?? MAFIA_PAGE_BACKGROUND_ITEMS[0]!
  }

  function setPeerEliminationBackground(peerId: string, value: MafiaEliminationBackground): void {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return
    }
    eliminationBackgroundByPeerId.value = {
      ...eliminationBackgroundByPeerId.value,
      [peerId]: normalizeEliminationBackground(value),
    }
  }

  function clearPeerEliminationBackground(peerId: string): void {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return
    }
    if (eliminationBackgroundByPeerId.value[peerId] == null) {
      return
    }
    const next = { ...eliminationBackgroundByPeerId.value }
    delete next[peerId]
    eliminationBackgroundByPeerId.value = next
  }

  function eliminationBackgroundForPeer(peerId: string): MafiaEliminationBackground {
    return eliminationBackgroundByPeerId.value[peerId] ?? defaultEliminationBackground.value
  }

  function applyMafiaModeFromSignaling(payload: MafiaModeUpdatePayload): void {
    const nextOld = payload.mode === 'old'
    oldMafiaMode.value = nextOld
    if (nextOld && !isMafiaHost.value) {
      mafiaTimer.value = null
    }
  }

  function applyMafiaSettingsUpdateFromSignaling(payload: MafiaSettingsUpdatePayload): void {
    const items = normalizeBackgroundItems(payload.deadBackgrounds)
    deadBackgrounds.value = items
    activeBackgroundId.value = backgroundExists(payload.activeBackgroundId, items) ? payload.activeBackgroundId : null
    defaultEliminationBackground.value = activePresetBackground()
  }

  function setSeatSwapSelectionPeerId(peerId: string | null): void {
    if (!isMafiaHost.value) {
      return
    }
    hostSeatSwapSelectionPeerId.value = peerId
  }

  


  function ensureNumberingOrderMaterialized(joinOrder: string[]): void {
    if (numberingOrder.value.length > 0) {
      return
    }
    if (joinOrder.length < 1) {
      return
    }
    numberingOrder.value = [...joinOrder]
    pinMafiaHostPeerToEndOfNumberingOrder()
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
    // Delegate to the shared `speakingNominationController` so Mafia / Game
    // Template / Eat First share one remap implementation. The shared
    // helper is identity-preserving when no entries reference either seat;
    // Mafia's original used `.map()` which always allocates, so callers
    // (specifically the `playersUpdateBroadcastPayload`-gated swap path)
    // could rely on `speakingQueue.value` always changing identity per
    // remap call. Spread the result unconditionally to preserve that
    // identity-changing semantic.
    speakingQueue.value = [
      ...remapSpeakingQueueForSeatSwapShared(speakingQueue.value, seatA, seatB),
    ]
  }

  function buildPlayersUpdatePayloadFromState(): MafiaPlayersUpdatePayload {
    return {
      order: [...numberingOrder.value],
      nightActions: { ...nightActions.value },
      speakingQueue: [...speakingQueue.value],
    }
  }

  



  function swapSeatsByPeerId(peerA: string, peerB: string): void {
    if (!isMafiaHost.value) {
      return
    }
    if (peerA === peerB) {
      return
    }
    const hp = mafiaHostPeerId.value
    if (typeof hp === 'string' && hp.length > 0 && (peerA === hp || peerB === hp)) {
      mafiaGameLog.info('swap seats: host peer cannot be swapped')
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
    numberingOrderAuthoritative.value = true
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
    numberingOrderAuthoritative.value = true
    numberingOrder.value = [...payload.order]
    pinMafiaHostPeerToEndOfNumberingOrder()
    if (payload.clearRoles === true) {
      roleByPeerId.value = {}
      playerOverlayStateByPeerId.value = {}
      eliminationBackgroundByPeerId.value = {}
    }
    if (typeof payload.oldMafiaMode === 'boolean') {
      oldMafiaMode.value = payload.oldMafiaMode
      if (payload.oldMafiaMode && !isMafiaHost.value) {
        mafiaTimer.value = null
      }
    }
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

  function clearModeUpdateBroadcastPayload(): void {
    modeUpdateBroadcastPayload.value = null
  }

  function clearSettingsUpdateBroadcastPayload(): void {
    settingsUpdateBroadcastPayload.value = null
  }

  function clearPageBackgroundSettingsBroadcastPayload(): void {
    pageBackgroundSettingsBroadcastPayload.value = null
  }

  


  function setSpeakingNominationDraftBySeat(seat: number | null): void {
    if (!isMafiaHost.value) {
      return
    }
    if (seat == null) {
      clearSpeakingNominationDraft()
      return
    }
    if (!Number.isInteger(seat) || seat < 1) {
      return
    }
    speakingNominationDraftBySeat.value = seat
  }

  function appendSpeakingNominationPair(by: number, target: number): void {
    if (!isMafiaHost.value) {
      return
    }
    // Delegate to the shared controller. `appendSpeakingPair` returns the
    // input reference on invalid seat numbers (matching the original
    // `!Number.isInteger || < 1` early-return); on success it returns a
    // new array which we spread into `speakingQueue.value` so the Pinia
    // ref identity changes and Mafia's outbound queue watcher fires.
    const next = appendSpeakingPair(speakingQueue.value, by, target)
    if (next === speakingQueue.value) {
      return
    }
    speakingQueue.value = [...next]
    clearSpeakingNominationDraft()
    mafiaGameLog.info('speaking queue nomination pair', { by, target, order: speakingQueue.value })
  }

  function removeSpeakingNominationPairAt(pairIndex: number): void {
    if (!isMafiaHost.value) {
      return
    }
    // Delegate to the shared controller. `removeSpeakingPairAt` handles
    // even-length (canonical pair splice) and odd-length (legacy
    // single-entry filter) identically to the previous inline branches and
    // returns the input reference for invalid / out-of-range indices —
    // which matches the original `return` paths.
    const next = removeSpeakingPairAt(speakingQueue.value, pairIndex)
    if (next === speakingQueue.value) {
      return
    }
    speakingQueue.value = [...next]
  }

  function clearSpeakingQueue(): void {
    if (!isMafiaHost.value) {
      return
    }
    if (speakingQueue.value.length === 0) {
      return
    }
    speakingQueue.value = []
    clearSpeakingNominationDraft()
    mafiaGameLog.info('speaking queue cleared')
  }

  function clearNightActions(): void {
    if (!isMafiaHost.value) {
      return
    }
    if (Object.keys(nightActions.value).length === 0) {
      return
    }
    nightActions.value = {}
    mafiaGameLog.info('night actions cleared')
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
    clearSpeakingNominationDraft()
    mafiaGameLog.info('host toolbar: clear all selections')
  }

  function pruneSpeakingQueueToMaxSeat(maxSeat: number): void {
    if (maxSeat < 1) {
      speakingQueue.value = []
      clearSpeakingNominationDraft()
      return
    }
    const flat = speakingQueue.value
    if (flat.length % 2 === 1) {
      const next = flat.filter((n) => n >= 1 && n <= maxSeat)
      if (next.length !== flat.length) {
        speakingQueue.value = [...next]
      }
      return
    }
    const next: number[] = []
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const a = flat[i]!
      const b = flat[i + 1]!
      if (a >= 1 && a <= maxSeat && b >= 1 && b <= maxSeat) {
        next.push(a, b)
      }
    }
    if (next.length !== flat.length) {
      speakingQueue.value = next
    }
  }

  


  function applySpeakingQueueFromSignaling(seats: number[]): void {
    // Delegate to the shared controller. Identical behavior to the prior
    // inline path:
    //   - non-array → empty queue
    //   - integer filter + ≥1 clamp
    //   - odd-length truncated to even (pair-encoded)
    //   - host preserves its in-flight nomination draft across own echo
    //     (the controller's `shouldClearDraft` is `!isHost`); non-host
    //     clears the draft
    //
    // Mafia is the behavioral source of truth here — the shared controller
    // was extracted from this function, so the migration is a pure
    // refactor.
    const { nextQueue, shouldClearDraft } = applySpeakingQueueFromSignalingShared(seats, {
      isHost: isMafiaHost.value,
    })
    speakingQueue.value = nextQueue
    if (shouldClearDraft) {
      clearSpeakingNominationDraft()
    }
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
        role: roles[peerId] ?? null,
      })),
    }
  }

  


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
      const isLast = i === list.length - 1
      if (p.role == null) {
        if (!isLast) {
          return
        }
        continue
      }
      if (typeof p.role !== 'string' || !MAFIA_ROLES.has(p.role as MafiaRole)) {
        return
      }
      r[p.peerId] = p.role as MafiaRole
    }
    beginMafiaReshuffleApply()
    numberingOrderAuthoritative.value = true
    numberingOrder.value = order
    roleByPeerId.value = r
    pinMafiaHostPeerToEndOfNumberingOrder()
    playerOverlayStateByPeerId.value = {}
    eliminationBackgroundByPeerId.value = {}
    phase.value = 'night'
    nightActions.value = {}
    activeNightActionRole.value = 'mafia'
    speakingQueue.value = []
    hostInteractionMode.value = 'night'
    clearSpeakingNominationDraft()
    mafiaTimer.value = null
  }

  function reshuffleGame(): ReshuffleResult {
    if (!isMafiaHost.value) {
      mafiaGameLog.info('reshuffle ignored: not mafia host')
      return { ok: false, error: 'message', messageKey: 'mafiaPage.reshuffleNotHost' }
    }
    const now = Date.now()
    if (now - lastReshuffleStartedAtMs.value < MAFIA_RESHUFFLE_MIN_INTERVAL_MS) {
      mafiaGameLog.info('reshuffle ignored: throttled duplicate click')
      return { ok: false, error: 'message' }
    }
    lastReshuffleStartedAtMs.value = now
    const mafia = useMafiaPlayersStore()
    const ids = mafia.joinOrder
    if (ids.length < 2) {
      return { ok: false, error: 'empty' }
    }
    if (oldMafiaMode.value) {
      beginMafiaReshuffleApply()
      const shuffledIds = fisherYatesShuffle([...ids])
      const orderedIds = pinHostPeerToEndOfOrder(shuffledIds, mafiaHostPeerId.value)
      numberingOrderAuthoritative.value = true
      numberingOrder.value = orderedIds
      pinMafiaHostPeerToEndOfNumberingOrder()
      roleByPeerId.value = {}
      playerOverlayStateByPeerId.value = {}
      eliminationBackgroundByPeerId.value = {}
      phase.value = 'night'
      nightActions.value = {}
      activeNightActionRole.value = 'mafia'
      speakingQueue.value = []
      hostInteractionMode.value = 'night'
      clearSpeakingNominationDraft()
      mafiaTimer.value = null
      timerStopBroadcastPayload.value = TIMER_STOP_SENTINEL
      mafiaGameLog.info('reshuffle: players shuffled, roles cleared (old mafia)', { n: ids.length, phase: phase.value })
      playersUpdateBroadcastPayload.value = {
        order: [...orderedIds],
        nightActions: {},
        speakingQueue: [],
        clearRoles: true,
        oldMafiaMode: true,
      }
      return { ok: true }
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
    const orderedIds = pinHostPeerToEndOfOrder(shuffledIds, mafiaHostPeerId.value)
    numberingOrderAuthoritative.value = true
    numberingOrder.value = orderedIds
    pinMafiaHostPeerToEndOfNumberingOrder()

    const shuffledRoles = fisherYatesShuffle([...deck])
    const r: Record<string, MafiaRole> = {}
    for (let i = 0; i < orderedIds.length; i += 1) {
      r[orderedIds[i]!] = shuffledRoles[i]!
    }
    roleByPeerId.value = r
    pinMafiaHostPeerToEndOfNumberingOrder()

    playerOverlayStateByPeerId.value = {}
    eliminationBackgroundByPeerId.value = {}

    phase.value = 'night'
    nightActions.value = {}
    activeNightActionRole.value = 'mafia'
    speakingQueue.value = []
    hostInteractionMode.value = 'night'
    clearSpeakingNominationDraft()
    mafiaTimer.value = null
    timerStopBroadcastPayload.value = TIMER_STOP_SENTINEL
    mafiaGameLog.info('reshuffle: players shuffled, roles assigned', { n: ids.length, phase: phase.value })
    reshuffleBroadcastPayload.value = buildReshufflePayloadFromState(orderedIds, r)
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
      Object.keys(playerOverlayStateByPeerId.value).length === 0 &&
      nightActionsCleared(nightActions.value) &&
      activeNightActionRole.value === 'mafia' &&
      speakingQueue.value.length === 0 &&
      hostInteractionMode.value === 'night' &&
      hostSeatSwapSelectionPeerId.value === null &&
      playersUpdateBroadcastPayload.value === null &&
      settingsUpdateBroadcastPayload.value === null &&
      pageBackgroundSettingsBroadcastPayload.value === null &&
      forcedPageBackgroundId.value === null &&
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
    numberingOrderAuthoritative.value = false
    roleByPeerId.value = {}
    playerOverlayStateByPeerId.value = {}
    eliminationBackgroundByPeerId.value = {}
    nightActions.value = {}
    activeNightActionRole.value = 'mafia'
    speakingQueue.value = []
    hostInteractionMode.value = 'night'
    clearSpeakingNominationDraft()
    hostSeatSwapSelectionPeerId.value = null
    playersUpdateBroadcastPayload.value = null
    settingsUpdateBroadcastPayload.value = null
    pageBackgroundSettingsBroadcastPayload.value = null
    forcedPageBackgroundId.value = null
    mafiaTimer.value = null
    timerStartBroadcastPayload.value = null
    timerStopBroadcastPayload.value = null
    kickBroadcastPayload.value = null
    reviveBroadcastPayload.value = null
    isApplyingMafiaReshuffle.value = false
    phase.value = null
    eatFirstCallEliminationHost.value = false
  }

  function prunePlayerOverlayStateToPeerIds(peerIds: string[]): void {
    const allowed = new Set(peerIds.filter((id) => typeof id === 'string' && id.length > 0))
    const nextOver: Record<string, MafiaPlayerOverlayState> = { ...playerOverlayStateByPeerId.value }
    for (const id of Object.keys(nextOver)) {
      if (!allowed.has(id)) {
        delete nextOver[id]
      }
    }
    playerOverlayStateByPeerId.value = nextOver
    const nextBg: Record<string, MafiaEliminationBackground> = { ...eliminationBackgroundByPeerId.value }
    for (const id of Object.keys(nextBg)) {
      if (!allowed.has(id)) {
        delete nextBg[id]
      }
    }
    eliminationBackgroundByPeerId.value = nextBg
  }

  function fullReset(): void {
    clearWhenLeavingMafiaRoute()
    mafiaHostPeerId.value = null
    mafiaHostUserId.value = null
    mafiaHostSessionId.value = null
  }

  



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
    if (oldMafiaMode.value && !isMafiaHost.value) {
      mafiaTimer.value = null
      return
    }
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
   * Live host-selected preset write — used by both the host's own click
   * and by inbound `mafia:timer-preset-select` from the server. Validates
   * against `MAFIA_TIMER_PRESET_MS` so a stale frame can't smuggle in an
   * out-of-band duration. The host path additionally queues the WS
   * broadcast via `timerPresetSelectBroadcastPayload`.
   */
  function selectTimerPreset(durationMs: number): void {
    if (!isMafiaHost.value) return
    if (!Number.isFinite(durationMs)) return
    const ms = Math.floor(durationMs)
    if (!MAFIA_TIMER_PRESET_MS.includes(ms as (typeof MAFIA_TIMER_PRESET_MS)[number])) return
    mafiaSelectedTimerDurationMs.value = ms
    timerPresetSelectBroadcastPayload.value = ms
  }

  function applyMafiaTimerPresetSelectFromSignaling(durationMs: number): void {
    if (!Number.isFinite(durationMs)) return
    const ms = Math.floor(durationMs)
    if (!MAFIA_TIMER_PRESET_MS.includes(ms as (typeof MAFIA_TIMER_PRESET_MS)[number])) return
    mafiaSelectedTimerDurationMs.value = ms
  }

  function clearTimerPresetSelectBroadcastPayload(): void {
    timerPresetSelectBroadcastPayload.value = null
  }

  
  function isMafiaPeerEliminated(peerId: string): boolean {
    return lifeStateForPeer(peerId) === 'dead'
  }

  type KickResult = { ok: true } | { ok: false; reason: 'not-host' | 'bad-peer' | 'self' | 'already' }

  


  function kickPlayer(peerId: string): KickResult {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return { ok: false, reason: 'not-host' }
    }
    const self = callSession.selfPeerId
    if (typeof self === 'string' && peerId === self) {
      return { ok: false, reason: 'self' }
    }
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return { ok: false, reason: 'bad-peer' }
    }
    if (lifeStateForPeer(peerId) === 'dead') {
      return { ok: false, reason: 'already' }
    }
    setPeerLifeState(peerId, 'dead')
    kickBroadcastPayload.value = { peerId }
    mafiaGameLog.info('player kicked', { peerId })
    return { ok: true }
  }

  function applyMafiaKickFromSignaling(payload: MafiaPlayerKickPayload): void {
    if (!payload || typeof payload.peerId !== 'string' || payload.peerId.length < 1) {
      return
    }
    setPeerLifeState(payload.peerId, 'dead')
  }

  function applyMafiaReviveFromSignaling(payload: MafiaPlayerRevivePayload): void {
    if (!payload || typeof payload.peerId !== 'string' || payload.peerId.length < 1) {
      return
    }
    setPeerLifeState(payload.peerId, 'ghost')
    clearPeerEliminationBackground(payload.peerId)
  }

  function applyMafiaPlayerLifeStateSnapshotFromSignaling(payload: MafiaPlayerLifeStateSnapshotPayload): void {
    if (!payload || !payload.states || typeof payload.states !== 'object') {
      return
    }
    const next: Record<string, MafiaPlayerOverlayState> = {}
    for (const [peerId, rawState] of Object.entries(payload.states)) {
      if (typeof peerId !== 'string' || peerId.length < 1) {
        continue
      }
      const lifeState = normalizeLifeState(rawState)
      if (lifeState !== 'alive') {
        next[peerId] = { lifeState }
      }
    }
    playerOverlayStateByPeerId.value = next
  }

  function clearKickBroadcastPayload(): void {
    kickBroadcastPayload.value = null
  }

  function clearReviveBroadcastPayload(): void {
    reviveBroadcastPayload.value = null
  }

  type ReviveResult = { ok: true } | { ok: false; reason: 'not-host' | 'bad-peer' | 'not-dead' | 'self' }

  


  function revivePlayer(peerId: string): ReviveResult {
    if (!isMafiaHost.value && !eatFirstCallEliminationHost.value) {
      return { ok: false, reason: 'not-host' }
    }
    const self = callSession.selfPeerId
    if (typeof self === 'string' && peerId === self) {
      return { ok: false, reason: 'self' }
    }
    if (typeof peerId !== 'string' || peerId.length < 1) {
      return { ok: false, reason: 'bad-peer' }
    }
    if (lifeStateForPeer(peerId) !== 'dead') {
      return { ok: false, reason: 'not-dead' }
    }
    setPeerLifeState(peerId, 'ghost')
    clearPeerEliminationBackground(peerId)
    reviveBroadcastPayload.value = { peerId }
    mafiaGameLog.info('player soft revived', { peerId })
    return { ok: true }
  }

  
  function hostToggleMafiaPlayerLife(peerId: string): KickResult | ReviveResult {
    if (lifeStateForPeer(peerId) === 'dead') {
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
    oldMafiaMode,
    modeUpdateBroadcastPayload,
    settingsUpdateBroadcastPayload,
    nightActions,
    lastNightResult,
    activeNightActionRole,
    hostInteractionMode,
    speakingQueue,
    numberingOrder,
    numberingKey,
    roleByPeerId,
    playerOverlayStateByPeerId,
    deadBackgrounds,
    activeBackgroundId,
    pageBackgrounds,
    selectedPageBackgroundId,
    forcedPageBackgroundId,
    pageBackgroundSettingsBroadcastPayload,
    appHubPageBackgrounds,
    appHubSelectedPageBackgroundId,
    defaultEliminationBackground,
    eliminationBackgroundByPeerId,
    mafiaHostPeerId,
    mafiaHostUserId,
    mafiaHostSessionId,
    localMafiaSessionId,
    localMafiaUserId,
    isMafiaHost,
    setLocalMafiaUserId,
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
    setOldMafiaMode,
    setActiveDeadBackgroundId,
    addCustomDeadBackground,
    deleteCustomDeadBackground,
    activeDeadBackgroundUrl,
    selectPageBackground,
    selectAppHubPageBackground,
    addCustomPageBackground,
    addCustomAppHubPageBackground,
    deleteCustomPageBackground,
    deleteCustomAppHubPageBackground,
    setPageBackgroundForcedForRoom,
    applyMafiaPageBackgroundSettingsFromSignaling,
    resolvedPageBackgroundItem,
    resolvedAppHubPageBackgroundItem,
    setDefaultEliminationBackground,
    setPeerEliminationBackground,
    clearPeerEliminationBackground,
    eliminationBackgroundForPeer,
    applyMafiaModeFromSignaling,
    applyMafiaSettingsUpdateFromSignaling,
    speakingNominationDraftBySeat,
    setSpeakingNominationDraftBySeat,
    appendSpeakingNominationPair,
    removeSpeakingNominationPairAt,
    clearSpeakingQueue,
    clearNightActions,
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
    clearModeUpdateBroadcastPayload,
    clearSettingsUpdateBroadcastPayload,
    clearPageBackgroundSettingsBroadcastPayload,
    mafiaTimer,
    startTimer,
    stopTimer,
    applyMafiaTimerFromSignaling,
    applyMafiaTimerStopFromSignaling,
    timerStartBroadcastPayload,
    clearTimerStartBroadcastPayload,
    timerStopBroadcastPayload,
    clearTimerStopBroadcastPayload,
    mafiaSelectedTimerDurationMs,
    selectTimerPreset,
    applyMafiaTimerPresetSelectFromSignaling,
    timerPresetSelectBroadcastPayload,
    clearTimerPresetSelectBroadcastPayload,
    kickBroadcastPayload,
    kickPlayer,
    applyMafiaKickFromSignaling,
    clearKickBroadcastPayload,
    reviveBroadcastPayload,
    revivePlayer,
    applyMafiaReviveFromSignaling,
    applyMafiaPlayerLifeStateSnapshotFromSignaling,
    clearReviveBroadcastPayload,
    eatFirstCallEliminationHost,
    setEatFirstCallEliminationHost,
    prunePlayerOverlayStateToPeerIds,
    hostToggleMafiaPlayerLife,
    isMafiaPeerEliminated,
    lifeStateForPeer,
    mafiaForceMuteAllActive,
    setMafiaForceMuteAllActiveFromSignaling,
    peerEffectiveMutedByPeerId,
    replacePeerEffectiveMutedSnapshot,
    setPeerEffectiveMuted,
    clearPeerEffectiveMuted,
    nonHostPeerIds,
    setNonHostPeerIds,
    everyNonHostEffectivelyMuted,
  }
})
