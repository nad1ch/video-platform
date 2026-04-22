import { describe, expect, it } from 'vitest'
import { mafiaEliminationAvatarKindForPeerId } from '../../apps/client/src/utils/mafiaEliminationAvatarKind'

describe('mafiaEliminationAvatarKindForPeerId', () => {
  it('returns a stable kind for a peer id', () => {
    const a = mafiaEliminationAvatarKindForPeerId('peer-abc')
    const b = mafiaEliminationAvatarKindForPeerId('peer-abc')
    expect(a).toBe(b)
    expect(a === 'skull' || a === 'ghost' || a === 'cross').toBe(true)
  })

  it('falls back for empty id', () => {
    expect(mafiaEliminationAvatarKindForPeerId('')).toBe('skull')
  })
})
