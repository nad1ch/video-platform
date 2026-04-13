import { defineStore } from 'pinia'
import { ref } from 'vue'

function randomPeerId(): string {
  return `peer-${Math.random().toString(36).slice(2, 10)}`
}

export type RoomPeerEntry = { peerId: string; displayName: string }

export const useCallSessionStore = defineStore('callSession', () => {
  const roomId = ref('demo')
  const selfPeerId = ref(randomPeerId())
  const selfDisplayName = ref('You')
  const inCall = ref(false)
  /** displayName from server (room-state / peer-joined / peer-display-name). */
  const remoteDisplayNames = ref<Record<string, string>>({})

  /** Replace remote name map from server peer list (excludes self). */
  function replaceRemoteDisplayNames(peers: RoomPeerEntry[]): void {
    const next: Record<string, string> = {}
    for (const p of peers) {
      if (p.peerId === selfPeerId.value) {
        continue
      }
      next[p.peerId] = p.displayName
    }
    remoteDisplayNames.value = next
  }

  function upsertRemoteDisplayName(peerId: string, displayName: string): void {
    if (peerId === selfPeerId.value) {
      return
    }
    remoteDisplayNames.value = { ...remoteDisplayNames.value, [peerId]: displayName }
  }

  function removeRemoteDisplayName(peerId: string): void {
    const next = { ...remoteDisplayNames.value }
    delete next[peerId]
    remoteDisplayNames.value = next
  }

  function clearRemoteDisplayNames(): void {
    remoteDisplayNames.value = {}
  }

  function labelFor(peerId: string): string {
    if (peerId === selfPeerId.value) {
      return selfDisplayName.value.trim() || 'You'
    }
    const fromServer = remoteDisplayNames.value[peerId]
    if (fromServer) {
      return fromServer
    }
    return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`
  }

  function setInCall(v: boolean): void {
    inCall.value = v
  }

  function resetSessionIdentity(): void {
    selfPeerId.value = randomPeerId()
  }

  return {
    roomId,
    selfPeerId,
    selfDisplayName,
    inCall,
    remoteDisplayNames,
    replaceRemoteDisplayNames,
    upsertRemoteDisplayName,
    removeRemoteDisplayName,
    clearRemoteDisplayNames,
    labelFor,
    setInCall,
    resetSessionIdentity,
  }
})
