/**
 * Pure policy: which remote video tiles may keep `<video>` playing under a soft budget (Phase 3).
 * Does not touch WebRTC — CallPage maps this to `playbackSuppressed` on `StreamVideo`.
 */

export type RankRemoteVideoPeersInput = {
  /** Remote `peerId`s that currently show video (camera/screen on). */
  remotePeerIdsWithVideo: readonly string[]
  serverActiveSpeakerPeerId: string | null
  uiActiveSpeakerPeerId: string | null
  /** Future: pin UI — reserved for parity with simulcast `pinnedPeerId`. */
  pinnedPeerId?: string | null
  /**
   * IntersectionObserver / viewport: `false` = off-screen; missing key = on-screen for ranking.
   */
  viewportVisibleByPeerId: ReadonlyMap<string, boolean>
}

/**
 * Priority: UI speaker (Web Audio, low latency) → SFU speaker → pinned → on-screen (sorted) → off-screen.
 */
export function rankRemoteVideoPeersForPlayback(input: RankRemoteVideoPeersInput): string[] {
  const set = new Set(
    input.remotePeerIdsWithVideo.map((id) => id.trim()).filter((id) => id.length > 0),
  )
  const ordered: string[] = []
  const push = (id: string | null | undefined): void => {
    if (typeof id !== 'string') {
      return
    }
    const t = id.trim()
    if (!t || !set.has(t) || ordered.includes(t)) {
      return
    }
    ordered.push(t)
  }

  push(input.uiActiveSpeakerPeerId)
  push(input.serverActiveSpeakerPeerId)
  push(input.pinnedPeerId ?? null)

  const vis = [...set]
    .filter((id) => !ordered.includes(id) && input.viewportVisibleByPeerId.get(id) !== false)
    .sort((a, b) => a.localeCompare(b))
  ordered.push(...vis)

  const off = [...set]
    .filter((id) => !ordered.includes(id))
    .sort((a, b) => a.localeCompare(b))
  ordered.push(...off)

  return ordered
}

export type AllowedRemotePlaybackInput = RankRemoteVideoPeersInput & {
  maxActiveRemoteVideos: number
  /** When false (desktop default/strong), every remote with video is within budget. */
  enableVisiblePlaybackBudget: boolean
  /**
   * Adaptive full-power unlock (healthy desktop): bypass visible playback cap while still using
   * the ranking helper elsewhere; keeps policy pure — CallPage sets this from hysteresis + profile.
   */
  fullPowerUnlock?: boolean
}

/**
 * Peers allowed to keep playback when visible budget applies. When disabled, returns all remotes with video.
 */
export function computeAllowedRemotePlaybackPeerIds(input: AllowedRemotePlaybackInput): Set<string> {
  const ids = input.remotePeerIdsWithVideo
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
  if (!input.enableVisiblePlaybackBudget || input.fullPowerUnlock === true) {
    return new Set(ids)
  }
  const cap = Math.max(1, Math.floor(input.maxActiveRemoteVideos))
  const ranked = rankRemoteVideoPeersForPlayback(input)
  return new Set(ranked.slice(0, cap))
}
