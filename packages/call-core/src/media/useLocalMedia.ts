import { onUnmounted, ref, shallowRef } from 'vue'
import { applyWebcamContentHint, DEFAULT_CALL_AUDIO_CONSTRAINTS } from './defaultMediaConstraints'
import type { VideoPublishTier } from './videoQualityPreset'
import {
  persistVideoInputDeviceIdFromTrack,
  readPreferredVideoInputDeviceId,
  selectPreferredVideoInputDeviceId,
} from './preferredVideoInputDevice'
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

/** Explicit pick from enumerateDevices: `ideal` can keep the previous device; `exact` forces the switch. */
async function getUserMediaWithDeviceIdExactThenIdeal(
  constraints: MediaStreamConstraints,
  kind: 'audio' | 'video',
): Promise<MediaStream> {
  const pick = constraints[kind]
  if (!pick || typeof pick !== 'object') {
    return await navigator.mediaDevices.getUserMedia(constraints)
  }
  const o = pick as Record<string, unknown>
  const raw = o.deviceId
  let deviceId: string | undefined
  if (typeof raw === 'string') {
    deviceId = raw.trim()
  } else if (raw && typeof raw === 'object' && 'exact' in raw) {
    const ex = (raw as { exact?: unknown }).exact
    deviceId = typeof ex === 'string' ? ex.trim() : undefined
  } else if (raw && typeof raw === 'object' && 'ideal' in raw) {
    const id = (raw as { ideal?: unknown }).ideal
    deviceId = typeof id === 'string' ? id.trim() : undefined
  }
  if (!deviceId) {
    return await navigator.mediaDevices.getUserMedia(constraints)
  }
  const withExact = {
    ...constraints,
    [kind]: { ...o, deviceId: { exact: deviceId } },
  } as MediaStreamConstraints
  try {
    return await navigator.mediaDevices.getUserMedia(withExact)
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[local] ${kind} exact deviceId failed, retry ideal`, e)
    }
    return await navigator.mediaDevices.getUserMedia(constraints)
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
    const devices = await safeEnumerateDevices()
    const preferred = selectPreferredVideoInputDeviceId(devices, readPreferredVideoInputDeviceId())
    const videoConstraints = { ...getCallVideoConstraints(tier) }
    const stream =
      preferred !== undefined
        ? await getUserMediaWithDeviceIdExactThenIdeal(
            {
              audio: { ...DEFAULT_CALL_AUDIO_CONSTRAINTS },
              video: { ...videoConstraints, deviceId: { ideal: preferred } },
            },
            'video',
          )
        : await navigator.mediaDevices.getUserMedia({
            audio: { ...DEFAULT_CALL_AUDIO_CONSTRAINTS },
            video: videoConstraints,
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
    persistVideoInputDeviceIdFromTrack(stream.getVideoTracks()[0])
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
    const tmp = await getUserMediaWithDeviceIdExactThenIdeal(
      {
        audio: { ...DEFAULT_CALL_AUDIO_CONSTRAINTS, deviceId: { ideal: deviceId } },
      },
      'audio',
    )
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
    const tmp = await getUserMediaWithDeviceIdExactThenIdeal(
      {
        video: { ...getCallVideoConstraints(tier), deviceId: { ideal: deviceId } },
      },
      'video',
    )
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
    persistVideoInputDeviceIdFromTrack(nt)
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
