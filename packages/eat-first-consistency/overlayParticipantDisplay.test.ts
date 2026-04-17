import { describe, expect, it } from 'vitest'
import { resolveOverlayPeerDisplayName } from '@/eat-first/utils/overlayParticipantDisplay.js'

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
