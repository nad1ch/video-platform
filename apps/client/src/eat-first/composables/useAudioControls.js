import { ref, watch } from 'vue'
import { Room } from 'livekit-client'
import { getLiveKitVideoCaptureDefaults } from '../config/livekit.js'

const defaultAudioCapture = () => ({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
})

/**
 * Локальний мікрофон / камера, пристрої, обмеження від AI echo/noise/AGC.
 *
 * @param {import('vue').ShallowRef<import('livekit-client').Room | null>} roomRef
 * @param {{
 *   canControl: import('vue').Ref<boolean> | import('vue').ComputedRef<boolean>,
 * }} options
 */
/**
 * Vue інколи полегковує ref при передачі в prop — тоді замість ShallowRef приходить Room | null.
 * @param {import('vue').ShallowRef<import('livekit-client').Room | null> | import('livekit-client').Room | null} roomRef
 */
function getRoomFromRef(roomRef) {
  if (roomRef == null) return null
  if (typeof roomRef === 'object' && 'value' in roomRef) {
    return /** @type {import('livekit-client').Room | null} */ (roomRef.value)
  }
  return /** @type {import('livekit-client').Room | null} */ (roomRef)
}

export function useAudioControls(roomRef, options) {
  const { canControl } = options

  const micEnabled = ref(false)
  const cameraEnabled = ref(false)

  const audioInputDevices = ref(/** @type {MediaDeviceInfo[]} */ ([]))
  const audioOutputDevices = ref(/** @type {MediaDeviceInfo[]} */ ([]))
  const videoInputDevices = ref(/** @type {MediaDeviceInfo[]} */ ([]))

  const selectedAudioInputId = ref('')
  const selectedAudioOutputId = ref('')
  const selectedVideoInputId = ref('')

  async function refreshDevices() {
    try {
      const [aIn, aOut, vIn] = await Promise.all([
        Room.getLocalDevices('audioinput', true),
        Room.getLocalDevices('audiooutput', false),
        Room.getLocalDevices('videoinput', true),
      ])
      audioInputDevices.value = aIn
      audioOutputDevices.value = aOut
      videoInputDevices.value = vIn
    } catch {
      /* permissions / insecure context */
    }
  }

  async function setMicEnabled(on) {
    const room = getRoomFromRef(roomRef)
    if (!room || !canControl.value) return
    const capture = defaultAudioCapture()
    if (selectedAudioInputId.value) {
      capture.deviceId = { exact: selectedAudioInputId.value }
    }
    await room.localParticipant.setMicrophoneEnabled(on, capture)
    micEnabled.value = room.localParticipant.isMicrophoneEnabled
  }

  async function setCameraEnabled(on) {
    const room = getRoomFromRef(roomRef)
    if (!room || !canControl.value) return
    const base = getLiveKitVideoCaptureDefaults()
    const opts = selectedVideoInputId.value
      ? { ...base, deviceId: { exact: selectedVideoInputId.value } }
      : base
    await room.localParticipant.setCameraEnabled(!!on, opts)
    cameraEnabled.value = room.localParticipant.isCameraEnabled
  }

  async function setAudioInput(deviceId) {
    selectedAudioInputId.value = deviceId
    const room = getRoomFromRef(roomRef)
    if (!room || !canControl.value) return
    if (micEnabled.value) {
      await room.switchActiveDevice('audioinput', deviceId, true)
      await setMicEnabled(true)
    } else {
      await room.switchActiveDevice('audioinput', deviceId, true)
    }
  }

  async function setAudioOutput(deviceId) {
    selectedAudioOutputId.value = deviceId
    const room = getRoomFromRef(roomRef)
    if (!room) return
    await room.switchActiveDevice('audiooutput', deviceId, true)
  }

  async function setVideoInput(deviceId) {
    selectedVideoInputId.value = deviceId
    const room = getRoomFromRef(roomRef)
    if (!room || !canControl.value) return
    if (cameraEnabled.value) {
      await room.switchActiveDevice('videoinput', deviceId, true)
      await setCameraEnabled(true)
    } else {
      await room.switchActiveDevice('videoinput', deviceId, true)
    }
  }

  watch(
    () => getRoomFromRef(roomRef),
    (room) => {
      if (!room) {
        micEnabled.value = false
        cameraEnabled.value = false
        return
      }
      micEnabled.value = room.localParticipant.isMicrophoneEnabled
      cameraEnabled.value = room.localParticipant.isCameraEnabled
      void refreshDevices()
    },
    { immediate: true },
  )

  return {
    micEnabled,
    cameraEnabled,
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    refreshDevices,
    setMicEnabled,
    setCameraEnabled,
    setAudioInput,
    setAudioOutput,
    setVideoInput,
  }
}
