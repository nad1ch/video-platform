import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { normalizeDisplayName } from 'call-core'
import { syncMafiaJoinOrder } from '@/utils/mafiaPlayerOrderSync'

export type MafiaPlayerRow = {
  peerId: string
  number: number
  displayName: string
}

/**
 * Mafia: stable player numbers 1..N and mirror list `{ peerId, number, displayName }`.
 * Join order is driven from `syncMafiaJoinOrder` in engine tile order; display names are filled from CallPage.
 */
export const useMafiaPlayersStore = defineStore('mafiaPlayers', () => {
  const roomKey = ref('')
  const joinOrder = ref<string[]>([])
  const players = shallowRef<MafiaPlayerRow[]>([])

  function buildRoomKey(raw: unknown): string {
    return normalizeDisplayName(String(raw ?? '')) || 'demo'
  }

  /**
   * @param enginePeerOrder — `tiles.map(t => t.peerId)` in orchestrator order (not grid order).
   */
  function syncWithPeers(rawRoomId: unknown, enginePeerOrder: string[]): void {
    const key = buildRoomKey(rawRoomId)
    const next = syncMafiaJoinOrder({
      roomKey: key,
      previousRoomKey: roomKey.value,
      previousOrder: joinOrder.value,
      enginePeerOrder,
    })
    const nextJoinKey = next.joinOrder.join('\u0000')
    const curJoinKey = joinOrder.value.join('\u0000')
    if (next.roomKey === roomKey.value && nextJoinKey === curJoinKey) {
      return
    }
    roomKey.value = next.roomKey
    joinOrder.value = next.joinOrder
  }

  function setPlayerRowsDisplay(rows: MafiaPlayerRow[]): void {
    players.value = rows
  }

  function clearPlayerRowsForUi(): void {
    if (players.value.length === 0) {
      return
    }
    players.value = []
  }

  function numberForPeer(peerId: string): number | undefined {
    const i = joinOrder.value.indexOf(peerId)
    return i === -1 ? undefined : i + 1
  }

  function reset(): void {
    roomKey.value = ''
    joinOrder.value = []
    players.value = []
  }

  return {
    roomKey,
    joinOrder,
    players,
    syncWithPeers,
    setPlayerRowsDisplay,
    clearPlayerRowsForUi,
    numberForPeer,
    reset,
  }
})
