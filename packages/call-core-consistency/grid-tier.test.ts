import { describe, expect, it } from 'vitest'
import { gridSizeTierFromParticipantCount } from '../call-core/src/media/gridTier'

describe('gridSizeTierFromParticipantCount', () => {
  it('treats zero participants as large tiles tier', () => {
    expect(gridSizeTierFromParticipantCount(0)).toBe('lg')
  })

  it('maps participant counts to tiers', () => {
    expect(gridSizeTierFromParticipantCount(1)).toBe('lg')
    expect(gridSizeTierFromParticipantCount(4)).toBe('lg')
    expect(gridSizeTierFromParticipantCount(5)).toBe('md')
    expect(gridSizeTierFromParticipantCount(9)).toBe('md')
    expect(gridSizeTierFromParticipantCount(10)).toBe('sm')
    expect(gridSizeTierFromParticipantCount(99)).toBe('sm')
  })
})
