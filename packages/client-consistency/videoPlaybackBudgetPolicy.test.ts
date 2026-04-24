import { describe, expect, it } from 'vitest'
import {
  computeAllowedRemotePlaybackPeerIds,
  rankRemoteVideoPeersForPlayback,
} from '@/components/call/videoPlaybackBudgetPolicy'

describe('videoPlaybackBudgetPolicy', () => {
  const viewportAllVisible = new Map<string, boolean>()

  it('ranks UI speaker then SFU speaker when different', () => {
    const order = rankRemoteVideoPeersForPlayback({
      remotePeerIdsWithVideo: ['z', 'a', 'm', 'srv', 'ui'],
      serverActiveSpeakerPeerId: 'srv',
      uiActiveSpeakerPeerId: 'ui',
      viewportVisibleByPeerId: viewportAllVisible,
    })
    expect(order[0]).toBe('ui')
    expect(order[1]).toBe('srv')
    expect(order.slice(2).sort()).toEqual(['a', 'm', 'z'])
  })

  it('includes both speakers in allowed set when cap is 4 and they differ', () => {
    const allowed = computeAllowedRemotePlaybackPeerIds({
      remotePeerIdsWithVideo: ['p0', 'p1', 'p2', 'p3', 'srv', 'ui'],
      maxActiveRemoteVideos: 4,
      enableVisiblePlaybackBudget: true,
      serverActiveSpeakerPeerId: 'srv',
      uiActiveSpeakerPeerId: 'ui',
      viewportVisibleByPeerId: viewportAllVisible,
    })
    expect(allowed.has('srv')).toBe(true)
    expect(allowed.has('ui')).toBe(true)
    expect(allowed.size).toBe(4)
  })

  it('mobile-style cap 4 keeps first four in priority order', () => {
    const allowed = computeAllowedRemotePlaybackPeerIds({
      remotePeerIdsWithVideo: ['a', 'b', 'c', 'd', 'e', 'f'],
      maxActiveRemoteVideos: 4,
      enableVisiblePlaybackBudget: true,
      serverActiveSpeakerPeerId: null,
      uiActiveSpeakerPeerId: null,
      viewportVisibleByPeerId: viewportAllVisible,
    })
    expect([...allowed].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('when enableVisiblePlaybackBudget is false, all remotes with video are allowed', () => {
    const allowed = computeAllowedRemotePlaybackPeerIds({
      remotePeerIdsWithVideo: ['a', 'b', 'c', 'd', 'e', 'f'],
      maxActiveRemoteVideos: 4,
      enableVisiblePlaybackBudget: false,
      serverActiveSpeakerPeerId: 'z',
      uiActiveSpeakerPeerId: null,
      viewportVisibleByPeerId: viewportAllVisible,
    })
    expect(allowed.size).toBe(6)
  })

  it('fullPowerUnlock allows all remotes while visible budget stays enabled', () => {
    const allowed = computeAllowedRemotePlaybackPeerIds({
      remotePeerIdsWithVideo: ['a', 'b', 'c', 'd', 'e', 'f'],
      maxActiveRemoteVideos: 4,
      enableVisiblePlaybackBudget: true,
      fullPowerUnlock: true,
      serverActiveSpeakerPeerId: null,
      uiActiveSpeakerPeerId: null,
      viewportVisibleByPeerId: viewportAllVisible,
    })
    expect(allowed.size).toBe(6)
  })

  it('places off-screen peers after on-screen in rank', () => {
    const vis = new Map<string, boolean>([
      ['on1', true],
      ['on2', true],
      ['off1', false],
    ])
    const order = rankRemoteVideoPeersForPlayback({
      remotePeerIdsWithVideo: ['off1', 'on2', 'on1'],
      serverActiveSpeakerPeerId: null,
      uiActiveSpeakerPeerId: null,
      viewportVisibleByPeerId: vis,
    })
    expect(order.indexOf('on1')).toBeLessThan(order.indexOf('off1'))
    expect(order.indexOf('on2')).toBeLessThan(order.indexOf('off1'))
  })
})
