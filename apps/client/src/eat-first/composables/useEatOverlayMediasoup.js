import { computed, watch, nextTick, shallowRef, reactive, triggerRef } from 'vue'
import { storeToRefs } from 'pinia'
import {
  buildCallParticipantMap,
  buildDisplayNameUiMap,
  normalizeDisplayName,
  resolvePeerDisplayNameForUi,
  useCallEngine,
  playAllPageAudio,
} from 'call-core'
import { useEatOverlayMediasoupSession } from '../stores/eatOverlayMediasoupSession.js'
import { mediasoupSignalingAvailable } from '../config/mediasoup.js'

/**
 * Підключення OBS overlay до mediasoup (той самий сервер, що Video call).
 * Кімната = `gameId`; peerId = identity слота / spectator-*.
 */
export function useEatOverlayMediasoup(options) {
  const { gameId, overlayReady, canPublish, identity, displayName, playerLabels } = options

  const session = useEatOverlayMediasoupSession()
  const { inCall, selfPeerId, selfDisplayName, remoteDisplayNames } = storeToRefs(session)

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

  /** Same SSOT as Call page: tiles + remote-only peers → single map for names. */
  const participantsByPeerId = computed(() =>
    buildCallParticipantMap(tiles.value, { ...remoteDisplayNames.value }, selfPeerId.value),
  )

  /** One resolve pass per participants change; watch reads `.get(id)` instead of N separate resolves. */
  const displayNameUiByPeerId = computed(() =>
    buildDisplayNameUiMap(participantsByPeerId.value, {
      selfPeerId: selfPeerId.value,
      selfDisplayName: selfDisplayName.value,
    }),
  )

  const tileMapRef = shallowRef(new Map())
  const orderTilesRef = shallowRef([])

  /** DEV: throttled hint when UI name map misses often (investigate participant SSOT). */
  let devNameFallbackLastLog = 0

  watch(
    [tiles, activeSpeakerPeerId, playerLabels, participantsByPeerId],
    () => {
      const speaker = activeSpeakerPeerId.value
      const participants = participantsByPeerId.value
      const nameOpts = {
        selfPeerId: selfPeerId.value,
        selfDisplayName: selfDisplayName.value,
      }
      const names = displayNameUiByPeerId.value
      const pl = playerLabels.value
      const labels = pl && typeof pl === 'object' ? pl : {}
      const m = tileMapRef.value
      const seen = new Set()
      const order = []
      let devNameFallbacks = 0
      for (const t of tiles.value) {
        const stream = t.stream
        if (!stream) continue
        const id = t.peerId
        seen.add(id)
        const v = stream.getVideoTracks()[0]
        const a = stream.getAudioTracks()[0]
        let label = labels[id] ?? names.get(id)
        if (label == null) {
          label = resolvePeerDisplayNameForUi(id, participants, nameOpts)
          if (import.meta.env.DEV) {
            devNameFallbacks += 1
          }
        }
        let entry = m.get(id)
        if (!entry) {
          entry = {
            identity: id,
            label: '',
            mediaStream: null,
            isLocal: false,
            showVideo: false,
            isMuted: true,
            isSpeaking: false,
          }
          m.set(id, entry)
        }
        entry.identity = id
        entry.label = label
        entry.mediaStream = stream
        entry.isLocal = t.isLocal
        entry.showVideo = v ? v.enabled : false
        entry.isMuted = a ? !a.enabled : true
        entry.isSpeaking = speaker === id
        order.push({ identity: id, isSpeaking: entry.isSpeaking })
      }
      for (const id of [...m.keys()]) {
        if (!seen.has(id)) {
          m.delete(id)
        }
      }
      if (
        import.meta.env.DEV &&
        devNameFallbacks > 0 &&
        Date.now() - devNameFallbackLastLog > 8000
      ) {
        devNameFallbackLastLog = Date.now()
        console.warn('[eat-overlay][dev] displayNameUiMap fallbacks', {
          count: devNameFallbacks,
          tiles: tiles.value.length,
        })
      }
      orderTilesRef.value = order
      triggerRef(tileMapRef)
    },
    /**
     * Shallow sources only: `tiles` is a fresh array from `useCallEngine` when deps change;
     * reuse Map entries + `triggerRef` so MediaStream-backed rows are not reallocated every tick.
     */
    { immediate: true, flush: 'post' },
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
      const dn = normalizeDisplayName(displayName.value)
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
