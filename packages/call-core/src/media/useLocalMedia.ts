import { onUnmounted, ref, shallowRef } from 'vue'
import { applyWebcamContentHint, DEFAULT_CALL_AUDIO_CONSTRAINTS } from './defaultMediaConstraints'
import type { VideoQualityPreset } from './videoQualityPreset'
import { getCallVideoConstraints } from './videoQualityPreset'

export type UseLocalMediaOptions = {
  /** Defaults to `'balanced'` when omitted. */
  getVideoQualityPreset?: () => VideoQualityPreset
}

export function useLocalMedia(options?: UseLocalMediaOptions) {
  const resolvePreset = (): VideoQualityPreset => options?.getVideoQualityPreset?.() ?? 'balanced'
  const localStream = shallowRef<MediaStream | null>(null)
  const micEnabled = ref(true)
  const camEnabled = ref(true)
  /** Bumps when local stream or tracks change so <video> re-runs play(). */
  const localPlayRev = ref(0)

  function syncFlagsFromStream(): void {
    const stream = localStream.value
    if (!stream) {
      micEnabled.value = true
      camEnabled.value = true
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
    const preset = resolvePreset()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { ...DEFAULT_CALL_AUDIO_CONSTRAINTS },
      video: { ...getCallVideoConstraints(preset) },
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
    micEnabled.value = true
    camEnabled.value = true
    localPlayRev.value += 1
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
    camEnabled.value = true
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

  onUnmounted(() => {
    stopLocalMedia()
  })

  return {
    localStream,
    localPlayRev,
    micEnabled,
    camEnabled,
    startLocalMedia,
    stopLocalMedia,
    toggleMic,
    toggleCam,
  }
}
