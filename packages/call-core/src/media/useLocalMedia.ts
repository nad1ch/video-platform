import { onUnmounted, ref, shallowRef } from 'vue'
import { detectIsMobileRuntime } from './runtimeMobileDetection'
import { applyWebcamContentHint, DEFAULT_CALL_AUDIO_CONSTRAINTS } from './defaultMediaConstraints'
import {
  buildCallAudioDevMicSnapshot,
  logCallAudioDevDiagnostics,
} from '../audio/callAudioDevDiagnostics'
import {
  applyOutgoingCallMicCaptureConstraints,
  mergeCallOutgoingMicAudioCaptureConstraints,
} from '../audio/noiseSuppressionPreference'
import type { VideoPublishTier } from './videoQualityPreset'
import {
  persistVideoInputDeviceIdFromTrack,
  readPreferredVideoInputDeviceId,
  selectPreferredVideoInputDeviceId,
} from './preferredVideoInputDevice'
import { getCallVideoConstraintsForRuntime } from './videoQualityPreset'

/** Re-export local alias to keep diff small at call sites in this file. */
const detectMobileForLocalCapture = detectIsMobileRuntime

export type UseLocalMediaOptions = {
  
  getVideoPublishTier?: () => VideoPublishTier
  
  mediaMode?: () => 'audio-video' | 'audio-only'
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
  const resolveMediaMode = (): 'audio-video' | 'audio-only' =>
    options?.mediaMode?.() === 'audio-only' ? 'audio-only' : 'audio-video'
  const localStream = shallowRef<MediaStream | null>(null)

  const micEnabled = ref(false)
  const camEnabled = ref(false)

  const localPlayRev = ref(0)

  const audioInputDevices = ref<CallMediaDeviceOption[]>([])
  const videoInputDevices = ref<CallMediaDeviceOption[]>([])
  const audioOutputDevices = ref<CallMediaDeviceOption[]>([])

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

  function mapAudioOutputs(list: MediaDeviceInfo[]): CallMediaDeviceOption[] {
    return list
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({
        deviceId: d.deviceId,
        label:
          typeof d.label === 'string' && d.label.trim().length > 0 ? d.label.trim() : 'Speaker',
      }))
  }

  async function refreshMediaDevices(): Promise<void> {
    const all = await safeEnumerateDevices()
    audioInputDevices.value = mapInputs(all, 'audioinput')
    videoInputDevices.value = mapInputs(all, 'videoinput')
    audioOutputDevices.value = mapAudioOutputs(all)
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
      micEnabled.value = false
      camEnabled.value = false
      return
    }
    const a = stream.getAudioTracks()[0]
    const v = stream.getVideoTracks()[0]
    micEnabled.value = a ? a.enabled : false
    camEnabled.value = v ? v.enabled : false
  }

  /**
   * React to mid-call track death: USB camera unplug, OS-level permission
   * revoke, or any other cause that flips `track.readyState` to `'ended'`
   * without an explicit `track.stop()` call from us. Without this listener
   * the UI continues to render `camEnabled === true` while the track is
   * dead and remotes see frozen frames.
   *
   * The listener is idempotent and self-detaching: it only acts when the
   * track is still part of the current `localStream` (so a deliberate
   * `track.stop()` from `stopLocalMedia` / `swapLocal*Input` is a no-op
   * because the track was already removed before being stopped).
   *
   * Bumping `localPlayRev` triggers preview/peer-publication watchers in
   * `useCallEngine` so the outbound producer is updated to a null-track
   * (or the next available device) via the normal replaceTrack path.
   */
  function attachLocalTrackEndedListener(track: MediaStreamTrack): void {
    const onEnded = (): void => {
      const stream = localStream.value
      if (!stream) {
        return
      }
      const stillAttached = stream.getTracks().includes(track)
      if (!stillAttached) {
        return
      }
      try {
        stream.removeTrack(track)
      } catch {
        /* track may already be detached */
      }
      if (track.kind === 'video') {
        camEnabled.value = false
      } else if (track.kind === 'audio') {
        micEnabled.value = false
      }
      localPlayRev.value += 1
      if (import.meta.env.DEV) {
        console.warn('[local] track ended unexpectedly (unplug / revoke)', {
          kind: track.kind,
          id: track.id,
          label: track.label,
        })
      }
    }
    track.addEventListener('ended', onEnded, { once: true })
  }

  async function startLocalMedia(): Promise<MediaStream> {
    if (import.meta.env.DEV) {
      console.log('[local] starting media')
    }
    stopLocalMedia()
    const mediaMode = resolveMediaMode()
    if (mediaMode === 'audio-only') {
      const requestedAudio = mergeCallOutgoingMicAudioCaptureConstraints(DEFAULT_CALL_AUDIO_CONSTRAINTS)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: requestedAudio,
        video: false,
      })
      logCallAudioDevDiagnostics('after-initial-capture', {
        mediaMode: 'audio-only',
        ...buildCallAudioDevMicSnapshot(stream.getAudioTracks()[0], {
          requestedAudioConstraints: requestedAudio,
        }),
      })
      localStream.value = stream
      for (const t of stream.getAudioTracks()) {
        t.enabled = false
        attachLocalTrackEndedListener(t)
      }
      const micOnly = stream.getAudioTracks()[0]
      if (micOnly) {
        await applyOutgoingCallMicCaptureConstraints(micOnly)
      }
      micEnabled.value = false
      camEnabled.value = false
      localPlayRev.value += 1
      await refreshMediaDevices()
      return stream
    }
    const tier = resolveTier()
    const devices = await safeEnumerateDevices()
    const preferred = selectPreferredVideoInputDeviceId(devices, readPreferredVideoInputDeviceId())
    const videoConstraints = {
      ...getCallVideoConstraintsForRuntime(tier, detectMobileForLocalCapture()),
    }
    const requestedAudio = mergeCallOutgoingMicAudioCaptureConstraints(DEFAULT_CALL_AUDIO_CONSTRAINTS)
    const stream =
      preferred !== undefined
        ? await getUserMediaWithDeviceIdExactThenIdeal(
            {
              audio: requestedAudio,
              video: { ...videoConstraints, deviceId: { ideal: preferred } },
            },
            'video',
          )
        : await navigator.mediaDevices.getUserMedia({
            audio: requestedAudio,
            video: videoConstraints,
          })
    logCallAudioDevDiagnostics('after-initial-capture', {
      mediaMode: 'audio-video',
      ...buildCallAudioDevMicSnapshot(stream.getAudioTracks()[0], {
        requestedAudioConstraints: requestedAudio,
      }),
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
    for (const t of stream.getAudioTracks()) {
      t.enabled = false
      attachLocalTrackEndedListener(t)
    }
    for (const t of stream.getVideoTracks()) {
      t.enabled = false
      attachLocalTrackEndedListener(t)
    }
    const micAv = stream.getAudioTracks()[0]
    if (micAv) {
      await applyOutgoingCallMicCaptureConstraints(micAv)
    }
    micEnabled.value = false
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
    micEnabled.value = false
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

  /**
   * Privacy-correct camera toggle.
   *
   *   - OFF: stop AND remove the local video track(s). `MediaStreamTrack.enabled = false`
   *     alone keeps the device capture loop running and the laptop camera LED ON; only
   *     `track.stop()` (with no other live consumers of the device) releases the LED.
   *     Audio is left untouched.
   *   - ON: acquire a fresh camera track via `getUserMedia` using the same constraints
   *     and preferred-device logic as `startLocalMedia` / `swapLocalVideoInput`, attach
   *     the content hint + ended listener, and add it to the existing `localStream`
   *     so the outbound producer's `replaceTrack` path picks it up via the existing
   *     `useCallEngine` watcher (camEnabled change → applyCamStateForOutbound → replaceOutboundVideoTrack).
   *
   * Remotes still see the avatar correctly because `set-outbound-video-paused` is emitted
   * server-side from a separate watcher on `camEnabled` — that decoupling means we can
   * release the device locally without leaving the "frozen last frame" artifact the
   * original `enabled=false` design was avoiding.
   *
   * Async: the ON path awaits `getUserMedia`. Callers in `useCallEngine` already run
   * inside async wrappers and must `await` this to keep `applyCamStateForOutbound`
   * ordering correct.
   */
  async function toggleCam(): Promise<void> {
    const stream = localStream.value
    if (!stream) {
      return
    }
    const liveVideo = stream.getVideoTracks().find((t) => t.readyState === 'live')
    if (liveVideo) {
      // OFF: release the device.
      for (const t of stream.getVideoTracks()) {
        try {
          stream.removeTrack(t)
        } catch {
          /* already detached */
        }
        try {
          t.stop()
        } catch {
          /* already stopped */
        }
      }
      camEnabled.value = false
      localPlayRev.value += 1
      if (import.meta.env.DEV) {
        console.log('[local] camera off — track stopped + removed (LED should release)')
      }
      return
    }
    // ON: reacquire camera with the same constraints `startLocalMedia` would have used.
    const tier = resolveTier()
    const videoConstraints = {
      ...getCallVideoConstraintsForRuntime(tier, detectMobileForLocalCapture()),
    }
    const devices = await safeEnumerateDevices()
    const preferred = selectPreferredVideoInputDeviceId(devices, readPreferredVideoInputDeviceId())
    let tmp: MediaStream
    try {
      tmp =
        preferred !== undefined
          ? await getUserMediaWithDeviceIdExactThenIdeal(
              { video: { ...videoConstraints, deviceId: { ideal: preferred } } },
              'video',
            )
          : await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[local] toggleCam ON: getUserMedia failed', e)
      }
      // Leave camEnabled false; UI stays consistent.
      return
    }
    const nt = tmp.getVideoTracks()[0]
    if (!nt) {
      for (const t of tmp.getTracks()) {
        t.stop()
      }
      return
    }
    applyWebcamContentHint(nt)
    // Discard any non-video tracks (we asked for video-only above, but defend in depth).
    for (const t of tmp.getTracks()) {
      if (t !== nt) {
        t.stop()
      }
    }
    stream.addTrack(nt)
    attachLocalTrackEndedListener(nt)
    persistVideoInputDeviceIdFromTrack(nt)
    camEnabled.value = true
    localPlayRev.value += 1
    await refreshMediaDevices()
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
    const prevEnabled = old ? old.enabled : false
    const requestedAudio = {
      ...mergeCallOutgoingMicAudioCaptureConstraints(DEFAULT_CALL_AUDIO_CONSTRAINTS),
      deviceId: { ideal: deviceId },
    }
    const tmp = await getUserMediaWithDeviceIdExactThenIdeal(
      {
        audio: requestedAudio,
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
    attachLocalTrackEndedListener(nt)
    syncFlagsFromStream()
    localPlayRev.value += 1
    logCallAudioDevDiagnostics('after-mic-device-swap', {
      ...buildCallAudioDevMicSnapshot(nt, { requestedAudioConstraints: requestedAudio }),
    })
    await applyOutgoingCallMicCaptureConstraints(nt)
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
        video: {
          ...getCallVideoConstraintsForRuntime(tier, detectMobileForLocalCapture()),
          deviceId: { ideal: deviceId },
        },
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
    attachLocalTrackEndedListener(nt)
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
    audioOutputDevices,
    refreshMediaDevices,
    startLocalMedia,
    stopLocalMedia,
    toggleMic,
    toggleCam,
    swapLocalAudioInput,
    swapLocalVideoInput,
  }
}
