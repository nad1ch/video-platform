import { defineStore } from 'pinia'
import { ref } from 'vue'

type EatFirstTraitKey =
  | 'gender'
  | 'age'
  | 'profession'
  | 'health'
  | 'hobby'
  | 'phobia'
  | 'fact'
  | 'baggage'

type EatFirstTraitsByKey = Record<EatFirstTraitKey, string>

/** Eat First speaking timer from `eat:table-state-sync` (server authoritative). */
export type EatFirstCallTimerFromTableSync = {
  startedAt: number
  durationMs: number
  isRunning: boolean
}

/**
 * Minimal shell/header bridge for `/app/eat` call mode only.
 * Set from `EatFirstCallPage`; cleared on unmount so Mafia/header never reads stale host state.
 */
export const useEatFirstCallShellStore = defineStore('eatFirstCallShell', () => {
  const isEatFirstRoomHost = ref(false)
  const hostPeerId = ref<string | null>(null)
  const currentGameId = ref('')
  const playerOrder = ref<string[]>([])
  /** Legacy seat-keyed mirror; the canonical lookup is `traitsBySlot[slotId]`. */
  const traitsBySeat = ref<Record<number, string[]>>({})
  const revealedTraitsBySeat = ref<Record<number, Record<string, boolean>>>({})
  const traitOverridesBySeat = ref<Record<number, Record<string, string>>>({})
  /**
   * Authoritative trait list per slot id (`p1`..`p11`). Populated from the
   * Eat First snapshot polling; consumed by call-tile overlay through the
   * peer→slot map and `playerOrder` from signaling (`eat:trait-state-sync` /
   * `eat:table-state-sync`).
   */
  const traitsBySlot = ref<Record<string, EatFirstTraitsByKey>>({})
  /** Action card snapshot per slot — host sees all seated players; each player sees own tile only (call UI). */
  const actionCardBySlot = ref<
    Record<
      string,
      {
        title: string
        description: string
        templateId: string
        effectId: string
        used: boolean
      }
    >
  >({})
  /**
   * Last used action card (host panel "Останньо використано"). Snapshot picks
   * the player with `activeCard.used === true` whose patch was most recently
   * persisted; pure UI hint, never authoritative game state.
   */
  const lastUsedActionCard = ref<{
    slotId: string
    title: string
    description: string
  } | null>(null)
  const playerCount = ref(0)
  const connectedPlayerCount = ref(0)

  /**
   * Nomination queue: pair-encoded when even length `[by1, target1, ...]` (same as Mafia call).
   * Odd length is legacy target-only when decoding. Local-only (no server sync).
   */
  const speakingQueue = ref<number[]>([])

  /** When true, tile clicks use two-step nomination (nominator, then nominated). */
  const speakingMode = ref(false)

  /** First click in speaking mode: nominator seat; second click completes the pair. */
  const speakingNominationDraftBySeat = ref<number | null>(null)

  function clearSpeakingNominationDraft(): void {
    speakingNominationDraftBySeat.value = null
  }

  /** Speaking countdown from signaling (`eat:table-state-sync`). Snapshot polling must not replace this. */
  const eatFirstCallTimerFromTableSync = ref<EatFirstCallTimerFromTableSync | null>(null)

  function setEatFirstCallShellHost(isHost: boolean): void {
    isEatFirstRoomHost.value = isHost
    if (!isHost) {
      speakingQueue.value = []
      speakingMode.value = false
      clearSpeakingNominationDraft()
    }
  }

  function setEatFirstHostPeer(hostPeer: string | null, selfPeerId: string | null): void {
    hostPeerId.value = hostPeer
    isEatFirstRoomHost.value =
      typeof hostPeer === 'string' &&
      hostPeer.length > 0 &&
      typeof selfPeerId === 'string' &&
      selfPeerId.length > 0 &&
      hostPeer === selfPeerId
    if (!isEatFirstRoomHost.value) {
      speakingQueue.value = []
      speakingMode.value = false
      clearSpeakingNominationDraft()
    }
  }

  function setGameId(id: string): void {
    const next = typeof id === 'string' ? id.trim() : ''
    if (next !== currentGameId.value) {
      eatFirstCallTimerFromTableSync.value = null
    }
    currentGameId.value = next
  }

  function setEatFirstCallTimerFromTableSync(next: EatFirstCallTimerFromTableSync | null): void {
    eatFirstCallTimerFromTableSync.value = next
  }

  function setPlayerOrder(order: string[]): void {
    playerOrder.value = order
  }

  function setTraitsBySeat(next: Record<number, string[]>): void {
    traitsBySeat.value = next
  }

  function setTraitsBySlot(next: Record<string, EatFirstTraitsByKey>): void {
    traitsBySlot.value = next
  }

  function setActionCardBySlot(
    next: Record<
      string,
      {
        title: string
        description: string
        templateId: string
        effectId: string
        used: boolean
      }
    >,
  ): void {
    actionCardBySlot.value = next
  }

  /**
   * Patch a single slot's action card without dropping cards we already
   * hydrated for other slots — used by the `eat:action-card-rerolled`
   * signaling fast-path so the host UI updates before the next snapshot poll.
   */
  function setActionCardForSlot(
    slotId: string,
    card: {
      title: string
      description: string
      templateId: string
      effectId: string
      used: boolean
    },
  ): void {
    const sid = String(slotId ?? '').trim()
    if (sid.length < 1) return
    actionCardBySlot.value = { ...actionCardBySlot.value, [sid]: card }
  }

  function setLastUsedActionCard(
    next: { slotId: string; title: string; description: string } | null,
  ): void {
    lastUsedActionCard.value = next
  }

  function setRevealedTraitsBySeat(next: Record<number, Record<string, boolean>>): void {
    revealedTraitsBySeat.value = next
  }

  function setTraitOverridesBySeat(next: Record<number, Record<string, string>>): void {
    traitOverridesBySeat.value = next
  }

  function markTraitRevealedBySeat(seat: number, traitKey: string): void {
    if (!Number.isFinite(seat) || seat < 1 || typeof traitKey !== 'string' || traitKey.trim().length < 1) return
    const key = traitKey.trim()
    const prevSeat = revealedTraitsBySeat.value[seat] ?? {}
    revealedTraitsBySeat.value = {
      ...revealedTraitsBySeat.value,
      [seat]: { ...prevSeat, [key]: true },
    }
  }

  function setTraitOverrideBySeat(seat: number, traitKey: string, value: string): void {
    if (!Number.isFinite(seat) || seat < 1 || typeof traitKey !== 'string' || traitKey.trim().length < 1) return
    const key = traitKey.trim()
    const val = typeof value === 'string' ? value.trim() : ''
    if (!val) return
    const prevSeat = traitOverridesBySeat.value[seat] ?? {}
    traitOverridesBySeat.value = {
      ...traitOverridesBySeat.value,
      [seat]: { ...prevSeat, [key]: val },
    }
  }

  function setPlayerCount(count: number): void {
    playerCount.value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  }

  function setConnectedPlayerCount(count: number): void {
    connectedPlayerCount.value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  }

  function toggleSpeakingMode(): void {
    speakingMode.value = !speakingMode.value
    if (!speakingMode.value) {
      clearSpeakingNominationDraft()
    }
  }

  function setSpeakingNominationDraftBySeat(seat: number | null): void {
    if (!isEatFirstRoomHost.value) return
    if (seat == null) {
      clearSpeakingNominationDraft()
      return
    }
    if (!Number.isInteger(seat) || seat < 1) return
    speakingNominationDraftBySeat.value = seat
  }

  function appendSpeakingNominationPair(by: number, target: number): void {
    if (!isEatFirstRoomHost.value) return
    if (!Number.isInteger(by) || by < 1 || !Number.isInteger(target) || target < 1) return
    speakingQueue.value = [...speakingQueue.value, by, target]
    clearSpeakingNominationDraft()
  }

  function removeSpeakingNominationPairAt(pairIndex: number): void {
    if (!isEatFirstRoomHost.value) return
    if (!Number.isInteger(pairIndex) || pairIndex < 0) return
    const flat = speakingQueue.value
    if (flat.length % 2 === 1) {
      if (pairIndex >= flat.length) return
      speakingQueue.value = flat.filter((_, i) => i !== pairIndex)
      return
    }
    const i = pairIndex * 2
    if (i + 1 >= flat.length) return
    speakingQueue.value = [...flat.slice(0, i), ...flat.slice(i + 2)]
  }

  function clearSpeakingQueue(): void {
    speakingQueue.value = []
    clearSpeakingNominationDraft()
  }

  function applySpeakingQueueFromSignaling(seats: unknown): void {
    if (!Array.isArray(seats)) {
      speakingQueue.value = []
      clearSpeakingNominationDraft()
      return
    }
    const next: number[] = []
    for (const x of seats) {
      if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
        next.push(x)
      }
    }
    speakingQueue.value = next
    clearSpeakingNominationDraft()
  }

  return {
    isEatFirstRoomHost,
    hostPeerId,
    currentGameId,
    eatFirstCallTimerFromTableSync,
    playerOrder,
    traitsBySeat,
    traitsBySlot,
    actionCardBySlot,
    lastUsedActionCard,
    revealedTraitsBySeat,
    traitOverridesBySeat,
    playerCount,
    connectedPlayerCount,
    speakingQueue,
    speakingMode,
    speakingNominationDraftBySeat,
    setEatFirstCallShellHost,
    setEatFirstHostPeer,
    setGameId,
    setEatFirstCallTimerFromTableSync,
    setPlayerOrder,
    setTraitsBySeat,
    setTraitsBySlot,
    setActionCardBySlot,
    setActionCardForSlot,
    setLastUsedActionCard,
    setRevealedTraitsBySeat,
    setTraitOverridesBySeat,
    markTraitRevealedBySeat,
    setTraitOverrideBySeat,
    setPlayerCount,
    setConnectedPlayerCount,
    toggleSpeakingMode,
    setSpeakingNominationDraftBySeat,
    appendSpeakingNominationPair,
    removeSpeakingNominationPairAt,
    clearSpeakingQueue,
    applySpeakingQueueFromSignaling,
  }
})
