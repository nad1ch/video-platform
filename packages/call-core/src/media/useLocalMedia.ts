import { onUnmounted, ref, shallowRef } from 'vue'
import { applyWebcamContentHint, DEFAULT_CALL_AUDIO_CONSTRAINTS } from './defaultMediaConstraints'
import type { VideoPublishTier } from './videoQualityPreset'
import { getCallVideoConstraints } from './videoQualityPreset'

export type UseLocalMediaOptions = {
  /** Defaults to `auto_large_room` when omitted. */
  getVideoPublishTier?: () => VideoPublishTier
}

export type CallMediaDeviceOption = {
  deviceId: string
  label: string
}

async function safeEnumerateDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  try {
    return await navigator.mediaDevices.enumerateDevices()
  } catch {
    return []
  }
}

export function useLocalMedia(options?: UseLocalMediaOptions) {
  const resolveTier = (): VideoPublishTier => options?.getVideoPublishTier?.() ?? 'auto_large_room'
  const localStream = shallowRef<MediaStream | null>(null)
  const micEnabled = ref(true)
  /** Camera off until the user turns it on (Meet / Discord style). */
  const camEnabled = ref(false)
  /** Bumps when local stream or tracks change so <video> re-runs play(). */
  const localPlayRev = ref(0)

  const audioInputDevices = ref<CallMediaDeviceOption[]>([])
  const videoInputDevices = ref<CallMediaDeviceOption[]>([])

  function mapInputs(list: MediaDeviceInfo[], kind: MediaDeviceKind): CallMediaDeviceOption[] {
    return list
      .filter((d) => d.kind === kind)
      .map((d) => ({
        deviceId: d.deviceId,
        label:
          typeof d.label === 'string' && d.label.trim().length > 0
            ? d.label.trim()
            : kind === 'audioinput'
              ? 'Microphone'
              : 'Camera',
      }))
  }

  async function refreshMediaDevices(): Promise<void> {
    const all = await safeEnumerateDevices()
    audioInputDevices.value = mapInputs(all, 'audioinput')
    videoInputDevices.value = mapInputs(all, 'videoinput')
  }

  function onDeviceChange(): void {
    void refreshMediaDevices()
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
  }

  function syncFlagsFromStream(): void {
    const stream = localStream.value
    if (!stream) {
      micEnabled.value = true
      camEnabled.value = false
      return
    }
    const a = stream.getAudioTracks()[0]
    const v = stream.getVideoTracks()[0]
    micEnabled.value = a ? a.enabled : false
    camEnabled.value = v ? v.enabled : false
  }

  async function startLocalMedia(): Promise<MediaStream> {
    if (import.meta.env.DEV) {
      console.log('[local] starting media')
    }
    stopLocalMedia()
    const tier = resolveTier()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { ...DEFAULT_CALL_AUDIO_CONSTRAINTS },
      video: { ...getCallVideoConstraints(tier) },
    })
    for (const t of stream.getVideoTracks()) {
      applyWebcamContentHint(t)
    }
    if (import.meta.env.DEV) {
      console.log(
        '[local] stream tracks',
        stream.getTracks().map((t) => ({
          kind: t.kind,
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      )
    }
    localStream.value = stream
    for (const t of stream.getVideoTracks()) {
      t.enabled = false
    }
    micEnabled.value = true
    camEnabled.value = false
    localPlayRev.value += 1
    await refreshMediaDevices()
    return stream
  }

  function stopLocalMedia(): void {
    const stream = localStream.value
    if (!stream) {
      return
    }
    for (const track of stream.getTracks()) {
      track.stop()
    }
    localStream.value = null
    micEnabled.value = true
    camEnabled.value = false
    audioInputDevices.value = []
    videoInputDevices.value = []
  }

  function toggleMic(): void {
    const stream = localStream.value
    if (!stream) {
      return
    }
    for (const t of stream.getAudioTracks()) {
      t.enabled = !t.enabled
    }
    syncFlagsFromStream()
  }

  function toggleCam(): void {
    const stream = localStream.value
    if (!stream) {
      return
    }
    for (const t of stream.getVideoTracks()) {
      t.enabled = !t.enabled
    }
    syncFlagsFromStream()
    localPlayRev.value += 1
  }

  /**
   * Swap the live microphone track on `localStream` (same stream object).
   * Caller replaces the outbound mediasoup producer when in a call.
   */
  async function swapLocalAudioInput(deviceId: string): Promise<void> {
    const stream = localStream.value
    if (!stream) {
      throw new Error('Local stream not started')
    }
    const old = stream.getAudioTracks()[0]
    const prevEnabled = old ? old.enabled : true
    const tmp = await navigator.mediaDevices.getUserMedia({
      audio: { ...DEFAULT_CALL_AUDIO_CONSTRAINTS, deviceId: { ideal: deviceId } },
    })
    const nt = tmp.getAudioTracks()[0]
    if (!nt) {
      for (const t of tmp.getTracks()) {
        t.stop()
      }
      throw new Error('No audio track from selected device')
    }
    nt.enabled = prevEnabled
    for (const t of tmp.getTracks()) {
      if (t !== nt) {
        t.stop()
      }
    }
    if (old) {
      stream.removeTrack(old)
      old.stop()
    }
    stream.addTrack(nt)
    syncFlagsFromStream()
    localPlayRev.value += 1
    await refreshMediaDevices()
  }

  /**
   * Swap the live camera track on `localStream`.
   * Caller replaces the outbound video producer when not screen-sharing.
   */
  async function swapLocalVideoInput(deviceId: string): Promise<void> {
    const stream = localStream.value
    if (!stream) {
      throw new Error('Local stream not started')
    }
    const old = stream.getVideoTracks()[0]
    const prevEnabled = old ? old.enabled : false
    const tier = resolveTier()
    const tmp = await navigator.mediaDevices.getUserMedia({
      video: { ...getCallVideoConstraints(tier), deviceId: { ideal: deviceId } },
    })
    const nt = tmp.getVideoTracks()[0]
    if (!nt) {
      for (const t of tmp.getTracks()) {
        t.stop()
      }
      throw new Error('No video track from selected device')
    }
    applyWebcamContentHint(nt)
    nt.enabled = prevEnabled
    for (const t of tmp.getTracks()) {
      if (t !== nt) {
        t.stop()
      }
    }
    if (old) {
      stream.removeTrack(old)
      old.stop()
    }
    stream.addTrack(nt)
    syncFlagsFromStream()
    localPlayRev.value += 1
    await refreshMediaDevices()
  }

  onUnmounted(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.removeEventListener) {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
    }
    stopLocalMedia()
  })

  return {
    localStream,
    localPlayRev,
    micEnabled,
    camEnabled,
    audioInputDevices,
    videoInputDevices,
    refreshMediaDevices,
    startLocalMedia,
    stopLocalMedia,
    toggleMic,
    toggleCam,
    swapLocalAudioInput,
    swapLocalVideoInput,
  }
}
