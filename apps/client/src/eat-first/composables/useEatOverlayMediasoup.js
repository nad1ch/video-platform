import { computed, watch, nextTick, shallowRef, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { useCallEngine, playAllPageAudio } from 'call-core'
import { useEatOverlayMediasoupSession } from '../stores/eatOverlayMediasoupSession.js'
import { mediasoupSignalingAvailable } from '../config/mediasoup.js'

/**
 * Підключення OBS overlay до mediasoup (той самий сервер, що Video call).
 * Кімната = `gameId`; peerId = identity слота / spectator-*.
 */
export function useEatOverlayMediasoup(options) {
  const { gameId, overlayReady, canPublish, identity, displayName, playerLabels } = options

  const session = useEatOverlayMediasoupSession()
  const { inCall } = storeToRefs(session)

  const roleRef = computed(() => (canPublish.value ? 'participant' : 'viewer'))

  const engine = useCallEngine({ session, role: roleRef })

  const {
    joinCall,
    leaveCall,
    joining,
    joinError,
    wsStatus,
    tiles,
    activeSpeakerPeerId,
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
  } = engine

  const tileMapRef = shallowRef(new Map())
  const orderTilesRef = shallowRef([])

  watch(
    [tiles, activeSpeakerPeerId, playerLabels],
    () => {
      const speaker = activeSpeakerPeerId.value
      const m = new Map()
      const order = []
      for (const t of tiles.value) {
        const stream = t.stream
        if (!stream) continue
        const id = t.peerId
        const v = stream.getVideoTracks()[0]
        const a = stream.getAudioTracks()[0]
        const pl = playerLabels.value
        const labels = pl && typeof pl === 'object' ? pl : {}
        const entry = {
          identity: id,
          label: labels[id] ?? id,
          mediaStream: stream,
          isLocal: t.isLocal,
          showVideo: v ? v.enabled : false,
          isMuted: a ? !a.enabled : true,
          isSpeaking: speaker === id,
        }
        m.set(id, entry)
        order.push({ identity: id, isSpeaking: entry.isSpeaking })
      }
      tileMapRef.value = m
      orderTilesRef.value = order
    },
    { deep: true, immediate: true },
  )

  const connectionState = computed(() => {
    if (joining.value) return 'connecting'
    if (joinError.value && !inCall.value) return 'error'
    if (inCall.value) return 'connected'
    if (wsStatus.value === 'connecting') return 'connecting'
    return 'idle'
  })

  const voiceUi = reactive({
    configured: false,
    connectionState: 'idle',
    joinError: /** @type {string | null} */ (null),
    inCall: false,
    joining: false,
    micEnabled: false,
    camEnabled: false,
    canPublish: false,
    unlockAudio: () => {
      playAllPageAudio()
    },
    toggleMic,
    toggleCam,
  })

  watch(
    [
      () => mediasoupSignalingAvailable(),
      () => connectionState.value,
      () => joinError.value,
      () => inCall.value,
      () => joining.value,
      () => micEnabled.value,
      () => camEnabled.value,
      () => canPublish.value,
    ],
    () => {
      voiceUi.configured = mediasoupSignalingAvailable()
      voiceUi.connectionState = connectionState.value
      voiceUi.joinError = joinError.value
      voiceUi.inCall = inCall.value
      voiceUi.joining = joining.value
      voiceUi.micEnabled = micEnabled.value
      voiceUi.camEnabled = camEnabled.value
      voiceUi.canPublish = canPublish.value
    },
    { immediate: true },
  )

  let joinSeq = 0
  watch(
    () => ({
      ready: overlayReady.value && mediasoupSignalingAvailable(),
      game: String(gameId.value || '').trim(),
      id: String(identity.value || '').trim(),
      pub: canPublish.value,
    }),
    async () => {
      const seq = ++joinSeq
      leaveCall()
      await nextTick()
      if (seq !== joinSeq) return
      const ready = overlayReady.value && mediasoupSignalingAvailable()
      const g = String(gameId.value || '').trim()
      const id = String(identity.value || '').trim()
      if (!ready || !g || !id) return
      const dn = String(displayName.value || '').trim()
      session.$patch({
        roomId: g,
        selfPeerId: id,
        selfDisplayName: dn || (canPublish.value ? 'Player' : 'Spectator'),
      })
      await joinCall()
    },
    { flush: 'post', immediate: true },
  )

  return {
    ...engine,
    connectionState,
    tileMapRef,
    orderTilesRef,
    voiceUi,
    mediaActive: computed(() => mediasoupSignalingAvailable()),
  }
}
