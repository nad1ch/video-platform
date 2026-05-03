import { defineStore } from 'pinia'
import { ref } from 'vue'
import { newCallTabPeerId } from 'call-core'
import { resolveOverlayPeerDisplayName } from '../utils/overlayParticipantDisplay.js'


export const useEatOverlayMediasoupSession = defineStore('eatOverlayMediasoup', () => {
  const roomId = ref('')
  const selfPeerId = ref(newCallTabPeerId())
  const selfDisplayName = ref('Spectator')
  const inCall = ref(false)
  const remoteDisplayNames = ref( ({}))

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
    return resolveOverlayPeerDisplayName(peerId, remoteDisplayNames.value, {
      selfPeerId: selfPeerId.value,
      selfDisplayName: selfDisplayName.value,
    })
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
