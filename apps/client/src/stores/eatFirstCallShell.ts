import { defineStore } from 'pinia'
import { ref } from 'vue'
import { efHostReshuffle } from '@/eat-first/services/eatFirstTransport'

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
   * peer→slot map broadcast in `eat:trait-state-sync`.
   */
  const traitsBySlot = ref<Record<string, string[]>>({})
  /** Action card snapshot per slot — host-only display in call tiles + host panel. */
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

  /** Speaking queue: ordered array of 1-based player seat numbers. Local-only state (no server sync). */
  const speakingQueue = ref<number[]>([])

  /** When true tile clicks in EatFirst call add seats to the speaking queue. */
  const speakingMode = ref(false)

  function setEatFirstCallShellHost(isHost: boolean): void {
    isEatFirstRoomHost.value = isHost
    if (!isHost) {
      speakingQueue.value = []
      speakingMode.value = false
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
    }
  }

  function setGameId(id: string): void {
    currentGameId.value = id
  }

  function setPlayerOrder(order: string[]): void {
    playerOrder.value = order
  }

  function setTraitsBySeat(next: Record<number, string[]>): void {
    traitsBySeat.value = next
  }

  function setTraitsBySlot(next: Record<string, string[]>): void {
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
  }

  function addSpeakingSeat(seat: number): void {
    if (!Number.isInteger(seat) || seat < 1) return
    if (speakingQueue.value.includes(seat)) return
    speakingQueue.value = [...speakingQueue.value, seat]
  }

  function removeSpeakingSeat(seat: number): void {
    speakingQueue.value = speakingQueue.value.filter((s) => s !== seat)
  }

  function clearSpeakingQueue(): void {
    speakingQueue.value = []
  }

  async function reshufflePlayerOrder(): Promise<{ ok: boolean; reason?: string }> {
    const gid = currentGameId.value
    if (!gid) return { ok: false, reason: 'no-game-id' }
    try {
      const out = await efHostReshuffle(gid, { participantCount: connectedPlayerCount.value })
      const nextOrder = Array.isArray(out?.playerOrder)
        ? out.playerOrder.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
        : []
      const traitsRaw =
        out?.traitsBySeat && typeof out.traitsBySeat === 'object' && !Array.isArray(out.traitsBySeat)
          ? (out.traitsBySeat as Record<string, unknown>)
          : {}
      const nextTraits: Record<number, string[]> = {}
      for (const [k, v] of Object.entries(traitsRaw)) {
        const seat = Number(k)
        if (!Number.isFinite(seat) || seat < 1) continue
        if (!Array.isArray(v)) continue
        nextTraits[seat] = v.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      }
      if (nextOrder.length > 0) {
        playerOrder.value = nextOrder
      }
      if (Object.keys(nextTraits).length > 0) {
        traitsBySeat.value = nextTraits
      }
      return { ok: true }
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'reshuffle-failed'
      return { ok: false, reason }
    }
  }

  return {
    isEatFirstRoomHost,
    hostPeerId,
    currentGameId,
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
    setEatFirstCallShellHost,
    setEatFirstHostPeer,
    setGameId,
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
    addSpeakingSeat,
    removeSpeakingSeat,
    clearSpeakingQueue,
    reshufflePlayerOrder,
  }
})
