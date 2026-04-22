import { describe, expect, it } from 'vitest'
import { mafiaSeatLabel, type MafiaSeatLabelRow } from '../../apps/client/src/utils/mafiaSeatLabel'

const rows: MafiaSeatLabelRow[] = [
  { peerId: 'a', number: 1, displayName: 'Bohdan' },
  { peerId: 'b', number: 2, displayName: 'Ivan' },
]

describe('mafiaSeatLabel', () => {
  it('renders "1 Name" / "2 Name" (no #)', () => {
    expect(mafiaSeatLabel(1, rows)).toBe('1 Bohdan')
    expect(mafiaSeatLabel(2, rows)).toBe('2 Ivan')
  })

  it('falls back to seat number when name is missing', () => {
    expect(mafiaSeatLabel(3, rows)).toBe('3')
  })
})
