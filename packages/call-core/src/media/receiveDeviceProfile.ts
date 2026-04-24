/**
 * Receive-side device capability hints for adaptive inbound simulcast policy.
 * Pure, coarse-grained classification — no fingerprinting, safe defaults on missing APIs.
 */

export type ReceiveDeviceProfileKind = 'strong' | 'default' | 'constrained' | 'mobile'

export type ReceiveDeviceProfile = {
  profile: ReceiveDeviceProfileKind
  maxHighStreams: number
  maxMediumStreams: number
  /**
   * Phase 2: permit soft `<video>` playback suppression for off-screen tiles (not used in Phase 1).
   */
  allowRenderSuppression: boolean
  /**
   * Phase 3: max remote tiles allowed to keep `<video>` playing when {@link allowRenderSuppression} is true
   * and visible grid exceeds budget (speakers still ranked first; see client playback budget helper).
   */
  maxActiveRemoteVideos: number
  /**
   * Inbound-stats bad streaks required before `receiveQualityPressure` shifts tier.
   * Lower = react sooner on weak devices (may downgrade layers slightly faster).
   */
  pressureBadStreakToShift: number
}

/** Narrow input so tests and SSR do not need a full `Navigator`. */
export type ReceiveDeviceProfileInput = {
  hardwareConcurrency?: number
  deviceMemory?: number
  userAgent?: string
}

export const RECEIVE_DEVICE_DEFAULT_MAX_HIGH = 2
export const RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM = 8

function mobileProfile(): ReceiveDeviceProfile {
  return {
    profile: 'mobile',
    maxHighStreams: 1,
    maxMediumStreams: 3,
    allowRenderSuppression: true,
    maxActiveRemoteVideos: 4,
    pressureBadStreakToShift: 2,
  }
}

function constrainedProfile(): ReceiveDeviceProfile {
  return {
    profile: 'constrained',
    maxHighStreams: 1,
    maxMediumStreams: 4,
    allowRenderSuppression: true,
    maxActiveRemoteVideos: 5,
    pressureBadStreakToShift: 2,
  }
}

function strongProfile(): ReceiveDeviceProfile {
  return {
    profile: 'strong',
    maxHighStreams: RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
    maxMediumStreams: RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
    allowRenderSuppression: false,
    maxActiveRemoteVideos: 9,
    pressureBadStreakToShift: 4,
  }
}

function defaultProfile(): ReceiveDeviceProfile {
  return {
    profile: 'default',
    maxHighStreams: RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
    maxMediumStreams: RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
    allowRenderSuppression: false,
    maxActiveRemoteVideos: 7,
    pressureBadStreakToShift: 3,
  }
}

function isLikelyHandheldUa(ua: string): boolean {
  if (!ua) {
    return false
  }
  if (/iPhone|iPod|iPad/i.test(ua)) {
    return true
  }
  // Most Android phones and tablets; excludes rare desktop UA quirks by keeping it simple.
  if (/Android/i.test(ua)) {
    return true
  }
  if (/Mobile/i.test(ua) && /Safari/i.test(ua)) {
    return true
  }
  return false
}

/**
 * Classify this client for inbound simulcast slot budgets and receive-pressure tuning.
 */
export function resolveReceiveDeviceProfile(input?: ReceiveDeviceProfileInput): ReceiveDeviceProfile {
  const fallback = defaultProfile()
  if (!input || typeof input !== 'object') {
    return fallback
  }

  const ua = typeof input.userAgent === 'string' ? input.userAgent : ''

  const cores =
    typeof input.hardwareConcurrency === 'number' &&
    Number.isFinite(input.hardwareConcurrency) &&
    input.hardwareConcurrency > 0
      ? Math.floor(input.hardwareConcurrency)
      : 0

  const mem =
    typeof input.deviceMemory === 'number' &&
    Number.isFinite(input.deviceMemory) &&
    input.deviceMemory > 0
      ? input.deviceMemory
      : undefined

  if (isLikelyHandheldUa(ua)) {
    return mobileProfile()
  }

  const weakCpu = cores > 0 && cores <= 4
  const weakRam = mem !== undefined && mem <= 4
  if (weakCpu || weakRam) {
    return constrainedProfile()
  }

  const strongCpu = cores >= 8
  /** Large core count: treat as strong even when `deviceMemory` is missing (common on desktop browsers). */
  const strongManyCores = cores >= 12
  const strongRam = mem !== undefined && mem >= 8
  if (strongCpu && (strongManyCores || strongRam || mem === undefined)) {
    return strongProfile()
  }

  return fallback
}

/**
 * Snapshot of navigator fields for {@link resolveReceiveDeviceProfile} (browser only).
 */
export function readNavigatorDeviceProfileInput(): ReceiveDeviceProfileInput | undefined {
  if (typeof globalThis === 'undefined' || typeof (globalThis as { navigator?: Navigator }).navigator === 'undefined') {
    return undefined
  }
  const nav = (globalThis as { navigator: Navigator & { deviceMemory?: number } }).navigator
  return {
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    userAgent: typeof nav.userAgent === 'string' ? nav.userAgent : '',
  }
}
