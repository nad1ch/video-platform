import { describe, expect, it } from 'vitest'
import { formatCallRoomChip, generateCallRoomCode } from '../../apps/client/src/utils/callRoomUi'

describe('formatCallRoomChip', () => {
  it('empty → ellipsis', () => {
    expect(formatCallRoomChip('')).toBe('\u22EF')
    expect(formatCallRoomChip('   ')).toBe('\u22EF')
  })

  it('short ids stay partially hidden', () => {
    expect(formatCallRoomChip('ab')).toBe(`a\u22EF`)
    expect(formatCallRoomChip('demo')).toBe(`d\u22EFo`)
  })

  it('long ids use two-letter ends', () => {
    expect(formatCallRoomChip('abcdefgh')).toBe(`ab\u22EFgh`)
  })
})

describe('generateCallRoomCode', () => {
  it('8 chars a-z0-9', () => {
    const code = generateCallRoomCode()
    expect(code).toMatch(/^[a-z0-9]{8}$/)
  })
})
