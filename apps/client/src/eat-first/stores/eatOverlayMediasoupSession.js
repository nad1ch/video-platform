import { defineStore } from 'pinia'
import { ref } from 'vue'

function randomPeerId() {
  return `peer-${Math.random().toString(36).slice(2, 10)}`
}

/** Окремий session slice для Eat overlay — не змішується з Video call (`callSession`). */
export const useEatOverlayMediasoupSession = defineStore('eatOverlayMediasoup', () => {
  const roomId = ref('')
  const selfPeerId = ref(randomPeerId())
  const selfDisplayName = ref('Spectator')
  const inCall = ref(false)
  const remoteDisplayNames = ref(/** @type {Record<string, string>} */ ({}))

  function replaceRemoteDisplayNames(peers) {
    const next = {}
    for (const p of peers) {
      if (p.peerId === selfPeerId.value) continue
      next[p.peerId] = p.displayName
    }
    remoteDisplayNames.value = next
  }

  function upsertRemoteDisplayName(peerId, displayName) {
    if (peerId === selfPeerId.value) return
    remoteDisplayNames.value = { ...remoteDisplayNames.value, [peerId]: displayName }
  }

  function removeRemoteDisplayName(peerId) {
    const next = { ...remoteDisplayNames.value }
    delete next[peerId]
    remoteDisplayNames.value = next
  }

  function clearRemoteDisplayNames() {
    remoteDisplayNames.value = {}
  }

  function labelFor(peerId) {
    if (peerId === selfPeerId.value) {
      const dn = selfDisplayName.value
      const t = typeof dn === 'string' ? dn.trim() : String(dn ?? '').trim()
      return t || 'You'
    }
    const fromServer = remoteDisplayNames.value[peerId]
    if (fromServer) return fromServer
    return `Guest ${peerId.length > 6 ? peerId.slice(-6) : peerId}`
  }

  function setInCall(v) {
    inCall.value = v
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
  }
})
