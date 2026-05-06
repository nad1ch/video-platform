/**
 * Opt-in DEV-only capture / publish diagnostics. No effect in production builds
 * (`import.meta.env.PROD`) and no logs unless localStorage is set (avoids dev spam).
 */

export const CALL_AUDIO_DEV_DIAGNOSTICS_STORAGE_KEY = 'streamassist:call:dev-audio-diagnostics-v1'

export function isCallAudioDevDiagnosticsEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false
  }
  if (typeof localStorage === 'undefined') {
    return false
  }
  try {
    return localStorage.getItem(CALL_AUDIO_DEV_DIAGNOSTICS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function cloneJsonSafe(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value)
    }
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function readCapabilities(track: MediaStreamTrack): MediaTrackCapabilities | 'unavailable' {
  try {
    if (typeof track.getCapabilities !== 'function') {
      return 'unavailable'
    }
    return track.getCapabilities()
  } catch {
    return 'unavailable'
  }
}

export type CallAudioDevMicSnapshot = {
  track: {
    id: string
    label: string
    kind: string
    enabled: boolean
    muted: boolean
    readyState: MediaStreamTrack['readyState']
  } | null
  requestedAudioConstraints?: unknown
  settings: unknown
  constraints: unknown
  capabilities: unknown
  noiseSuppressionIntent?: boolean
  noiseSuppressionEffective?: boolean
  autoGainControlEffective?: boolean
  echoCancellationEffective?: boolean
  sampleRate?: number
  channelCount?: number
}

export function buildCallAudioDevMicSnapshot(
  track: MediaStreamTrack | null | undefined,
  extras?: {
    requestedAudioConstraints?: unknown
    noiseSuppressionIntent?: boolean
  },
): CallAudioDevMicSnapshot {
  if (!track || track.kind !== 'audio') {
    return {
      track: null,
      requestedAudioConstraints: extras?.requestedAudioConstraints
        ? cloneJsonSafe(extras.requestedAudioConstraints)
        : undefined,
      settings: {},
      constraints: {},
      capabilities: 'unavailable',
      noiseSuppressionIntent: extras?.noiseSuppressionIntent,
    }
  }
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {}
  const constraints = typeof track.getConstraints === 'function' ? track.getConstraints() : {}
  const caps = readCapabilities(track)
  const asBool = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : undefined

  return {
    track: {
      id: track.id,
      label: track.label,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    },
    requestedAudioConstraints: extras?.requestedAudioConstraints
      ? cloneJsonSafe(extras.requestedAudioConstraints)
      : undefined,
    settings: cloneJsonSafe(settings),
    constraints: cloneJsonSafe(constraints),
    capabilities: caps === 'unavailable' ? caps : cloneJsonSafe(caps),
    noiseSuppressionIntent: extras?.noiseSuppressionIntent,
    noiseSuppressionEffective: asBool(settings.noiseSuppression),
    autoGainControlEffective: asBool(settings.autoGainControl),
    echoCancellationEffective: asBool(settings.echoCancellation),
    sampleRate: settings.sampleRate,
    channelCount: settings.channelCount,
  }
}

/**
 * Logs one structured line. Gated: DEV build + {@link isCallAudioDevDiagnosticsEnabled}.
 * Uses `console.info` so production tree-shaking still applies to DEV-only branches.
 */
export function logCallAudioDevDiagnostics(phase: string, body: Record<string, unknown>): void {
  if (!isCallAudioDevDiagnosticsEnabled()) {
    return
  }
  // Dev-only, double-gated above; call-core has no shared logger dependency.
  console.info('[call-audio-dev]', phase, body)
}
