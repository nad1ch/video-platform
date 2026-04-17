import { describe, expect, it } from 'vitest'
import {
  overlayAvatarUrlForTile,
  resolveOverlayPeerDisplayName,
} from '@/eat-first/utils/overlayParticipantDisplay.js'

describe('resolveOverlayPeerDisplayName', () => {
  const opts = (selfPeerId: string, selfDisplayName: string) => ({ selfPeerId, selfDisplayName })

  it('self: trimmed name or You', () => {
    expect(resolveOverlayPeerDisplayName('me', {}, opts('me', '  Ann  '))).toBe('Ann')
    expect(resolveOverlayPeerDisplayName('me', {}, opts('me', '   '))).toBe('You')
  })

  it('remote: uses server map when non-empty', () => {
    expect(
      resolveOverlayPeerDisplayName('p1', { p1: 'Remote' }, opts('me', 'You')),
    ).toBe('Remote')
  })

  it('remote: Guest fallback matches call-core guest id (last 6)', () => {
    const longId = 'xxxxxxxx-aaaa-bbbb-cccc-dddddddddddd'
    expect(resolveOverlayPeerDisplayName(longId, {}, opts('me', 'You'))).toBe(
      `Guest ${longId.slice(-6)}`,
    )
  })

  it('remote: empty string in map falls through to guest (same as store labelFor)', () => {
    expect(resolveOverlayPeerDisplayName('p1', { p1: '' }, opts('me', 'You'))).toBe('Guest p1')
  })
})

describe('overlayAvatarUrlForTile', () => {
  it('local tile uses auth avatar only', () => {
    expect(overlayAvatarUrlForTile({}, true, 'https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(overlayAvatarUrlForTile({ avatar: 'https://x/y.jpg' }, true, 'https://cdn.example/a.png')).toBe(
      'https://cdn.example/a.png',
    )
  })

  it('remote tile uses player fields', () => {
    expect(overlayAvatarUrlForTile({ avatar: ' https://p/q.png ' }, false, undefined)).toBe('https://p/q.png')
    expect(overlayAvatarUrlForTile({ photoUrl: 'https://a/b' }, false, undefined)).toBe('https://a/b')
  })

  it('returns empty when no URL', () => {
    expect(overlayAvatarUrlForTile({}, false, undefined)).toBe('')
    expect(overlayAvatarUrlForTile({ avatar: '  ' }, false, undefined)).toBe('')
  })
})
