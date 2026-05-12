import { computed, reactive, ref, watch, type Ref } from 'vue'
import {
  decodeSpeakingNominationFlat,
  nominationTargetSeatsFromSpeakingFlat,
} from '@/utils/speakingNominationQueue'
import { sortPeerIdsHostLast } from '@/components/call/callTileOrderRules'

/**
 * Game-room **temporary local adapter** — single-browser fallback behind the
 * generic `useGameRoomSession` boundary.
 *
 * This file is the *implementation* used while a server-backed
 * `useGameRoomServerAdapter` does not yet exist. It must NEVER be imported
 * directly by pages or components — consume `useGameRoomSession` instead.
 *
 * Scope of "temporary local":
 *   - host identity, seats, speaking queue, timer, mute-all all live in
 *     local Vue refs;
 *   - persistence is `sessionStorage` keyed by `roomBase`, so reload-recovery
 *     works inside a single browser tab and a single room;
 *   - cross-tab and cross-user coordination is **out of scope** — that
 *     requires a server-side game-room state block (mirroring the
 *     Mafia `claim-host` + owner-lock + snapshot stack).
 *
 * Behaviour vs. production Mafia (intentional differences in this fallback):
 *   - **No auto-promotion of `selfPeerId` to host.** Becoming host requires
 *     an explicit `claimHost()` call (UI button on the page). The claim
 *     succeeds only when `hostPeerId == null`. This mirrors the production
 *     `mafia:claim-host` contract on the client side.
 *   - **No cross-user truth.** Two tabs opening the same room each maintain
 *     their own local state. The page must surface this with a banner.
 *
 * Production-isolation guarantees:
 *   - no imports from `@/stores/mafiaGame`, `useMafiaPlayersStore`,
 *     `useMafiaHostSignaling`, `useMafiaAudioMixSignaling`,
 *     `useMafiaCallHostUi`, `useMafiaSpeakingHint`, or `MafiaWs`.
 *
 * Pure helpers reused (game-agnostic):
 *   - `sortPeerIdsHostLast`              (`callTileOrderRules.ts`)
 *   - `decodeSpeakingNominationFlat`,
 *     `nominationTargetSeatsFromSpeakingFlat` (`speakingNominationQueue.ts`)
 */

// ---- Types ----

export type GameTileRole = 'civilian' | 'sheriff' | 'doctor' | 'mafia' | 'don'
export type GameTileLifeState = 'alive' | 'dead'
export type GameInteractionMode = 'idle' | 'swap' | 'speaking'

export interface GameTileEntry {
  /** 1-based seat number among non-host peers (null for the room host). */
  seat: number | null
  role: GameTileRole
  lifeState: GameTileLifeState
  /** Per-peer mute state — toggled by mute-all or per-peer action. */
  muted: boolean
  /** Removed from the table (visually skipped; not auto-restored on rejoin). */
  kicked: boolean
}

export interface GameTimerState {
  /** epoch ms when the timer started. */
  startedAt: number
  /** total duration in ms. */
  durationMs: number
}

export interface UseGameRoomTemporaryLocalAdapterDeps {
  /** Live peerId from call-core (`useCallSessionStore().selfPeerId`). */
  selfPeerId: Ref<string | null | undefined>
  /**
   * Lab room base (the part after the `gamecall-lab:` prefix). Used as the
   * sessionStorage key. Changing this resets the local state to defaults.
   */
  roomBase: Ref<string>
}

const ROLE_CYCLE: readonly GameTileRole[] = ['civilian', 'sheriff', 'doctor', 'mafia', 'don']
const STORAGE_PREFIX = 'streamassist-game-template-state'
const STORAGE_VERSION = 1
const SAVE_DEBOUNCE_MS = 250

interface PersistedState {
  v: number
  hostPeerId: string | null
  byPeerId: Record<string, GameTileEntry>
  speakingQueue: number[]
  speakingDraftSeat: number | null
  forceMuteAllActive: boolean
  timer: GameTimerState | null
  interactionMode: GameInteractionMode
  swapSelectionPeerId: string | null
}

/**
 * Legacy persisted-payload shape used before Phase 5d's renames. We still
 * read it on hydrate so an existing browser session does not lose its host
 * + seats after upgrading.
 */
interface LegacyPersistedState {
  v: number
  mockHostPeerId?: string | null
  byPeerId?: Record<string, GameTileEntry>
  speakingQueue?: number[]
  speakingDraftSeat?: number | null
  forceMuteAllActive?: boolean
  timer?: GameTimerState | null
  interactionMode?: GameInteractionMode
  swapSelectionPeerId?: string | null
}

function storageKey(roomBase: string): string {
  return `${STORAGE_PREFIX}:${roomBase}`
}

function safeLoad(roomBase: string): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(roomBase))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    // Forward-compatible read: accept either the new `hostPeerId` field or
    // the legacy `mockHostPeerId` (Phase 5d rename). The two-step
    // `as unknown as ...` cast is required because the persisted JSON has
    // no statically-known shape.
    const cur = parsed as unknown as Partial<PersistedState>
    const legacy = parsed as unknown as LegacyPersistedState
    if (cur.v !== STORAGE_VERSION && legacy.v !== STORAGE_VERSION) return null
    const hostPeerId: string | null =
      typeof cur.hostPeerId === 'string'
        ? cur.hostPeerId
        : typeof legacy.mockHostPeerId === 'string'
        ? legacy.mockHostPeerId
        : null
    return {
      v: STORAGE_VERSION,
      hostPeerId,
      byPeerId: cur.byPeerId ?? legacy.byPeerId ?? {},
      speakingQueue: cur.speakingQueue ?? legacy.speakingQueue ?? [],
      speakingDraftSeat: cur.speakingDraftSeat ?? legacy.speakingDraftSeat ?? null,
      forceMuteAllActive: Boolean(
        cur.forceMuteAllActive ?? legacy.forceMuteAllActive ?? false,
      ),
      timer: cur.timer ?? legacy.timer ?? null,
      interactionMode:
        (cur.interactionMode as GameInteractionMode | undefined) ??
        legacy.interactionMode ??
        'idle',
      swapSelectionPeerId:
        cur.swapSelectionPeerId ?? legacy.swapSelectionPeerId ?? null,
    }
  } catch {
    return null
  }
}

function safeSave(roomBase: string, state: PersistedState): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey(roomBase), JSON.stringify(state))
  } catch {
    /* private mode / quota — ignore */
  }
}

function safeClear(roomBase: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(storageKey(roomBase))
  } catch {
    /* ignore */
  }
}

export function useGameRoomTemporaryLocalAdapter(deps: UseGameRoomTemporaryLocalAdapterDeps) {
  const { selfPeerId, roomBase } = deps

  // ---- Reactive state ----

  const hostPeerId = ref<string | null>(null)
  const byPeerId = reactive<Record<string, GameTileEntry>>({})
  const speakingQueue = ref<number[]>([])
  const speakingDraftSeat = ref<number | null>(null)
  const forceMuteAllActive = ref<boolean>(false)
  const timer = ref<GameTimerState | null>(null)
  const interactionMode = ref<GameInteractionMode>('idle')
  const swapSelectionPeerId = ref<string | null>(null)

  // Internal: counter for assigning new seat numbers; recomputed when seats
  // are reassigned via reshuffle/swap.
  let nextSeatCounter = 0

  function recomputeNextSeatCounter(): void {
    let maxSeat = 0
    for (const id of Object.keys(byPeerId)) {
      const s = byPeerId[id]?.seat
      if (typeof s === 'number' && s > maxSeat) maxSeat = s
    }
    nextSeatCounter = maxSeat
  }

  // ---- Hydration ----

  function hydrateFromSession(): void {
    const persisted = safeLoad(roomBase.value)
    if (!persisted) {
      nextSeatCounter = 0
      return
    }
    hostPeerId.value = persisted.hostPeerId ?? null
    speakingQueue.value = Array.isArray(persisted.speakingQueue)
      ? [...persisted.speakingQueue]
      : []
    speakingDraftSeat.value = persisted.speakingDraftSeat ?? null
    forceMuteAllActive.value = Boolean(persisted.forceMuteAllActive)
    timer.value = persisted.timer ?? null
    interactionMode.value = (persisted.interactionMode as GameInteractionMode) ?? 'idle'
    swapSelectionPeerId.value = persisted.swapSelectionPeerId ?? null
    for (const id of Object.keys(byPeerId)) {
      delete byPeerId[id]
    }
    if (persisted.byPeerId && typeof persisted.byPeerId === 'object') {
      for (const [pid, entry] of Object.entries(persisted.byPeerId)) {
        if (entry && typeof entry === 'object') {
          byPeerId[pid] = {
            seat: typeof entry.seat === 'number' ? entry.seat : null,
            role: typeof entry.role === 'string' ? (entry.role as GameTileRole) : 'civilian',
            lifeState: entry.lifeState === 'dead' ? 'dead' : 'alive',
            muted: Boolean(entry.muted),
            kicked: Boolean(entry.kicked),
          }
        }
      }
    }
    recomputeNextSeatCounter()
  }

  // Initial hydrate
  hydrateFromSession()

  // Re-hydrate when roomBase changes (switching rooms)
  watch(roomBase, (next, prev) => {
    if (next === prev) return
    for (const id of Object.keys(byPeerId)) {
      delete byPeerId[id]
    }
    hostPeerId.value = null
    speakingQueue.value = []
    speakingDraftSeat.value = null
    forceMuteAllActive.value = false
    timer.value = null
    interactionMode.value = 'idle'
    swapSelectionPeerId.value = null
    nextSeatCounter = 0
    hydrateFromSession()
  })

  // ---- Debounced persistence ----

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleSave(): void {
    if (saveTimer != null) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      const snapshot: PersistedState = {
        v: STORAGE_VERSION,
        hostPeerId: hostPeerId.value,
        byPeerId: JSON.parse(JSON.stringify(byPeerId)) as Record<string, GameTileEntry>,
        speakingQueue: [...speakingQueue.value],
        speakingDraftSeat: speakingDraftSeat.value,
        forceMuteAllActive: forceMuteAllActive.value,
        timer: timer.value ? { ...timer.value } : null,
        interactionMode: interactionMode.value,
        swapSelectionPeerId: swapSelectionPeerId.value,
      }
      safeSave(roomBase.value, snapshot)
    }, SAVE_DEBOUNCE_MS)
  }

  watch(
    [
      hostPeerId,
      byPeerId,
      speakingQueue,
      speakingDraftSeat,
      forceMuteAllActive,
      timer,
      interactionMode,
      swapSelectionPeerId,
    ],
    () => scheduleSave(),
    { deep: true },
  )

  // ---- Helpers ----

  function nextSeat(): number {
    nextSeatCounter += 1
    return nextSeatCounter
  }

  function defaultEntry(seat: number | null, role: GameTileRole): GameTileEntry {
    return {
      seat,
      role,
      lifeState: 'alive',
      muted: false,
      kicked: false,
    }
  }

  /**
   * Ensure an entry exists for `peerId`. If the peer is currently the host,
   * seat is null; otherwise the next available seat number is assigned.
   *
   * **Important:** unlike the prior demo composable, this function NEVER
   * auto-promotes `selfPeerId` to host. The host model is now claim-only —
   * `claimHost()` is the single promotion path.
   */
  function ensurePeer(peerId: string): void {
    if (!peerId || byPeerId[peerId] != null) return
    const isHostPeer = hostPeerId.value === peerId
    const seat = isHostPeer ? null : nextSeat()
    const role: GameTileRole = ROLE_CYCLE[(nextSeatCounter - 1) % ROLE_CYCLE.length] ?? 'civilian'
    byPeerId[peerId] = defaultEntry(seat, role)
  }

  function forgetPeer(peerId: string): void {
    if (byPeerId[peerId] != null) {
      delete byPeerId[peerId]
    }
  }

  // ---- Identity / role view ----

  const isLocalUserHost = computed(() => {
    const id = selfPeerId.value
    return typeof id === 'string' && id.length > 0 && hostPeerId.value === id
  })

  function isHostPeer(peerId: string): boolean {
    return hostPeerId.value === peerId
  }

  function entryFor(peerId: string): GameTileEntry | null {
    if (!peerId) return null
    if (byPeerId[peerId] == null) {
      ensurePeer(peerId)
    }
    return byPeerId[peerId] ?? null
  }

  function seatFor(peerId: string): number | null {
    return entryFor(peerId)?.seat ?? null
  }

  // ---- Ordering ----

  /**
   * Host-last ordering function for `<GameCallVideoGrid :order-tiles>`.
   * Sorts alphabetically by peerId then pins the host to the end —
   * matches production Mafia's host-last invariant via the same pure helper.
   */
  function orderTilesHostLast<T extends { peerId: string }>(tiles: readonly T[]): readonly T[] {
    const ids = tiles.map((t) => t.peerId)
    const sorted = sortPeerIdsHostLast(ids, hostPeerId.value ?? '')
    const index = new Map<string, number>(sorted.map((id, i) => [id, i]))
    return [...tiles].sort((a, b) => {
      const ai = index.get(a.peerId) ?? Number.MAX_SAFE_INTEGER
      const bi = index.get(b.peerId) ?? Number.MAX_SAFE_INTEGER
      return ai - bi
    })
  }

  // ---- Host actions ----

  /**
   * Force-set host (admin/test affordance). Used by the page's "claim/release"
   * UI buttons via the higher-level `claimHost` / `releaseHost` helpers below.
   * For direct host transfers between known peers.
   */
  function setHost(peerId: string | null): void {
    const prev = hostPeerId.value
    if (prev === peerId) return
    // Restore seat for the previous host (assign next seat)
    if (prev && byPeerId[prev]) {
      byPeerId[prev] = { ...byPeerId[prev], seat: byPeerId[prev].seat ?? nextSeat() }
    }
    hostPeerId.value = peerId
    // Clear seat for the new host
    if (peerId && byPeerId[peerId]) {
      byPeerId[peerId] = { ...byPeerId[peerId], seat: null }
    }
    // Reset interaction mode to idle on host change
    interactionMode.value = 'idle'
    swapSelectionPeerId.value = null
  }

  /**
   * Explicit host claim. Promotes `selfPeerId` to host IFF no host currently
   * exists (i.e. `hostPeerId == null`). Mirrors the production Mafia
   * `mafia:claim-host` contract on the client side.
   */
  function claimHost(): void {
    if (hostPeerId.value != null) return
    const selfId = selfPeerId.value
    if (typeof selfId !== 'string' || selfId.length < 1) return
    setHost(selfId)
  }

  /**
   * Explicit host release. Clears host iff the local user currently holds
   * it. After release, any peer can `claimHost()` again.
   */
  function releaseHost(): void {
    const selfId = selfPeerId.value
    if (typeof selfId !== 'string' || selfId.length < 1) return
    if (hostPeerId.value !== selfId) return
    setHost(null)
  }

  function setInteractionMode(mode: GameInteractionMode): void {
    if (interactionMode.value === mode) {
      interactionMode.value = 'idle'
    } else {
      interactionMode.value = mode
    }
    swapSelectionPeerId.value = null
    speakingDraftSeat.value = null
  }

  function reshuffleSeats(): void {
    // Reassign seats among non-host, non-kicked peers in random order
    const eligible = Object.keys(byPeerId).filter((id) => {
      if (id === hostPeerId.value) return false
      if (byPeerId[id]?.kicked) return false
      return true
    })
    // Fisher–Yates
    const shuffled = [...eligible]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i]!
      shuffled[i] = shuffled[j]!
      shuffled[j] = tmp
    }
    nextSeatCounter = 0
    for (let i = 0; i < shuffled.length; i++) {
      const id = shuffled[i]!
      const seat = i + 1
      nextSeatCounter = seat
      const role: GameTileRole = ROLE_CYCLE[i % ROLE_CYCLE.length] ?? 'civilian'
      byPeerId[id] = { ...byPeerId[id]!, seat, role, lifeState: 'alive' }
    }
    speakingQueue.value = []
    speakingDraftSeat.value = null
    interactionMode.value = 'idle'
    swapSelectionPeerId.value = null
  }

  function swapSeats(peerA: string, peerB: string): void {
    const a = byPeerId[peerA]
    const b = byPeerId[peerB]
    if (!a || !b) return
    if (a.seat == null || b.seat == null) return // can't swap host
    byPeerId[peerA] = { ...a, seat: b.seat }
    byPeerId[peerB] = { ...b, seat: a.seat }
    swapSelectionPeerId.value = null
  }

  function kickPeer(peerId: string): void {
    const cur = byPeerId[peerId]
    if (!cur || peerId === hostPeerId.value) return
    byPeerId[peerId] = { ...cur, kicked: true, seat: null }
    recomputeNextSeatCounter()
  }

  function unkickPeer(peerId: string): void {
    const cur = byPeerId[peerId]
    if (!cur) return
    byPeerId[peerId] = { ...cur, kicked: false, seat: nextSeat() }
  }

  function toggleLifeFor(peerId: string): void {
    const cur = byPeerId[peerId]
    if (!cur) return
    byPeerId[peerId] = {
      ...cur,
      lifeState: cur.lifeState === 'dead' ? 'alive' : 'dead',
    }
  }

  function rotateRoleFor(peerId: string): void {
    const cur = byPeerId[peerId]
    if (!cur) return
    const idx = ROLE_CYCLE.indexOf(cur.role)
    const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length] ?? 'civilian'
    byPeerId[peerId] = { ...cur, role: next }
  }

  function setMuteFor(peerId: string, muted: boolean): void {
    const cur = byPeerId[peerId]
    if (!cur) return
    byPeerId[peerId] = { ...cur, muted }
  }

  function everyNonHostMuted(): boolean {
    const ids = Object.keys(byPeerId).filter(
      (id) => id !== hostPeerId.value && !byPeerId[id]?.kicked,
    )
    if (ids.length === 0) return false
    return ids.every((id) => byPeerId[id]?.muted === true)
  }

  function toggleMuteAll(): void {
    const shouldMute = !(forceMuteAllActive.value && everyNonHostMuted())
    setMuteAll(shouldMute)
  }

  /**
   * Set the mute-all visual + per-peer mute flag to an explicit target value.
   * Mirrors the production Mafia `force-mute-all` event shape: the host bar
   * emits `set-mute-all: [muted: boolean]` with the next target.
   */
  function setMuteAll(muted: boolean): void {
    forceMuteAllActive.value = muted
    for (const id of Object.keys(byPeerId)) {
      if (id === hostPeerId.value) continue
      if (byPeerId[id]?.kicked) continue
      byPeerId[id] = { ...byPeerId[id]!, muted }
    }
  }

  const muteAllVisualActive = computed(
    () => forceMuteAllActive.value && everyNonHostMuted(),
  )

  // ---- Speaking queue ----

  function speakingTileClick(peerId: string): void {
    const seat = seatFor(peerId)
    if (seat == null) return
    const draft = speakingDraftSeat.value
    if (draft == null) {
      speakingDraftSeat.value = seat
    } else if (draft === seat) {
      speakingDraftSeat.value = null
    } else {
      speakingQueue.value = [...speakingQueue.value, draft, seat]
      speakingDraftSeat.value = null
    }
  }

  function removeSpeakingPairAt(pairIndex: number): void {
    const queue = speakingQueue.value
    if (queue.length % 2 !== 0) return
    const start = pairIndex * 2
    if (start < 0 || start >= queue.length) return
    speakingQueue.value = [...queue.slice(0, start), ...queue.slice(start + 2)]
  }

  function clearSpeakingQueue(): void {
    speakingQueue.value = []
    speakingDraftSeat.value = null
  }

  const speakingSegments = computed(() =>
    decodeSpeakingNominationFlat(speakingQueue.value),
  )

  const speakingTargetSeatSet = computed(() =>
    nominationTargetSeatsFromSpeakingFlat(speakingQueue.value),
  )

  // ---- Swap helpers ----

  function swapTileClick(peerId: string): void {
    if (peerId === hostPeerId.value) return
    if (byPeerId[peerId]?.kicked) return
    const sel = swapSelectionPeerId.value
    if (sel == null) {
      swapSelectionPeerId.value = peerId
    } else if (sel === peerId) {
      swapSelectionPeerId.value = null
    } else {
      swapSeats(sel, peerId)
    }
  }

  /** Routes a tile click based on the current interaction mode. */
  function handleTileClick(peerId: string): void {
    switch (interactionMode.value) {
      case 'swap':
        swapTileClick(peerId)
        break
      case 'speaking':
        speakingTileClick(peerId)
        break
      default:
        break
    }
  }

  // ---- Timer ----

  function startTimer(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 1000) return
    timer.value = {
      startedAt: Date.now(),
      durationMs,
    }
  }

  function stopTimer(): void {
    timer.value = null
  }

  // ---- Reset ----

  function resetAll(): void {
    for (const id of Object.keys(byPeerId)) {
      delete byPeerId[id]
    }
    hostPeerId.value = null
    speakingQueue.value = []
    speakingDraftSeat.value = null
    forceMuteAllActive.value = false
    timer.value = null
    interactionMode.value = 'idle'
    swapSelectionPeerId.value = null
    nextSeatCounter = 0
    safeClear(roomBase.value)
  }

  return {
    // Identity
    hostPeerId,
    isLocalUserHost,
    isHostPeer,
    // Per-peer
    byPeerId,
    entryFor,
    seatFor,
    ensurePeer,
    forgetPeer,
    // Ordering
    orderTilesHostLast,
    // Host actions
    setHost,
    claimHost,
    releaseHost,
    reshuffleSeats,
    swapSeats,
    kickPeer,
    unkickPeer,
    toggleLifeFor,
    rotateRoleFor,
    setMuteFor,
    toggleMuteAll,
    setMuteAll,
    forceMuteAllActive,
    muteAllVisualActive,
    // Interaction mode
    interactionMode,
    setInteractionMode,
    swapSelectionPeerId,
    // Speaking queue
    speakingQueue,
    speakingDraftSeat,
    speakingSegments,
    speakingTargetSeatSet,
    removeSpeakingPairAt,
    clearSpeakingQueue,
    speakingTileClick,
    // Combined click handler
    handleTileClick,
    // Swap helpers
    swapTileClick,
    // Timer
    timer,
    startTimer,
    stopTimer,
    // Lifecycle
    resetAll,
  }
}

export type UseGameRoomTemporaryLocalAdapterReturn = ReturnType<
  typeof useGameRoomTemporaryLocalAdapter
>
