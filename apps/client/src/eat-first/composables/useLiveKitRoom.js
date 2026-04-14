import { shallowRef, ref, watch, onUnmounted } from 'vue'
import { Room, RoomEvent, ConnectionState } from 'livekit-client'
import { fetchLiveKitToken } from '../services/livekitToken.js'
import {
  getLiveKitServerUrl,
  getLiveKitVideoCaptureDefaults,
  getLiveKitPublishDefaults,
} from '../config/livekit.js'

/**
 * Керування одним екземпляром Room: connect / disconnect / reconnect.
 *
 * @param {{
 *   enabled: import('vue').Ref<boolean>,
 *   roomName: import('vue').Ref<string> | import('vue').ComputedRef<string>,
 *   identity: import('vue').Ref<string> | import('vue').ComputedRef<string>,
 *   displayName: import('vue').Ref<string> | import('vue').ComputedRef<string>,
 *   canPublish: import('vue').Ref<boolean> | import('vue').ComputedRef<boolean>,
 * }} options
 */
export function useLiveKitRoom(options) {
  const { enabled, roomName, identity, displayName, canPublish } = options

  const room = shallowRef(null)
  const connectionState = ref(ConnectionState.Disconnected)
  const error = shallowRef(null)
  const activeSpeakers = shallowRef(/** @type {import('livekit-client').Participant[]} */ ([]))

  let userRequestedDisconnect = false
  let reconnectTimer = null
  let sessionGeneration = 0

  function clearReconnect() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect() {
    clearReconnect()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!userRequestedDisconnect && enabled.value) void runConnect()
    }, 3000)
  }

  function bindRoomEvents(r) {
    r.on(RoomEvent.ConnectionStateChanged, (state) => {
      connectionState.value = state
    })
    r.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      activeSpeakers.value = speakers
    })
    r.on(RoomEvent.Disconnected, () => {
      if (userRequestedDisconnect) return
      connectionState.value = ConnectionState.Disconnected
      scheduleReconnect()
    })
  }

  async function teardownRoom(stopTracks = true) {
    const r = room.value
    room.value = null
    activeSpeakers.value = []
    connectionState.value = ConnectionState.Disconnected
    if (r) {
      try {
        await r.disconnect(stopTracks)
      } catch {
        /* */
      }
    }
  }

  async function runConnect() {
    const mySession = sessionGeneration
    error.value = null

    if (!enabled.value) return

    const url = getLiveKitServerUrl()
    const rn = String(roomName.value ?? '').trim()
    const id = String(identity.value ?? '').trim()
    if (!url || !rn || !id) return

    clearReconnect()
    await teardownRoom(true)
    if (userRequestedDisconnect || mySession !== sessionGeneration) return

    const r = new Room({
      adaptiveStream: true,
      dynacast: true,
      autoSubscribe: false,
      disconnectOnPageLeave: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: getLiveKitVideoCaptureDefaults(),
      publishDefaults: getLiveKitPublishDefaults(),
    })
    bindRoomEvents(r)
    room.value = r

    try {
      const token = await fetchLiveKitToken({
        roomName: rn,
        identity: id,
        name: displayName.value,
        canPublish: canPublish.value,
      })
      if (userRequestedDisconnect || mySession !== sessionGeneration) {
        await r.disconnect(true).catch(() => {})
        if (room.value === r) room.value = null
        return
      }
      await r.connect(url, token)
      await r.startAudio().catch(() => {})
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      await teardownRoom(true)
      if (!userRequestedDisconnect && enabled.value) {
        scheduleReconnect()
      }
    }
  }

  async function disconnect() {
    userRequestedDisconnect = true
    sessionGeneration++
    clearReconnect()
    await teardownRoom(true)
  }

  watch(
    () => ({
      en: enabled.value,
      rn: String(roomName.value ?? '').trim(),
      id: String(identity.value ?? '').trim(),
      pub: canPublish.value,
    }),
    async (cur, prev) => {
      if (!cur.en) {
        userRequestedDisconnect = true
        sessionGeneration++
        clearReconnect()
        await teardownRoom(true)
        return
      }

      userRequestedDisconnect = false

      if (!cur.rn || !cur.id) return

      const needNew =
        !prev ||
        !prev.en ||
        prev.rn !== cur.rn ||
        prev.id !== cur.id ||
        prev.pub !== cur.pub

      if (needNew) {
        sessionGeneration++
        await runConnect()
      }
    },
    { immediate: true, flush: 'post' },
  )

  onUnmounted(() => {
    userRequestedDisconnect = true
    sessionGeneration++
    clearReconnect()
    void teardownRoom(true)
  })

  return {
    room,
    connectionState,
    error,
    activeSpeakers,
    disconnect,
  }
}
