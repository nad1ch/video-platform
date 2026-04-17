import { describe, expect, it } from 'vitest'
import { normalizeDisplayName } from '../src/utils/normalizeDisplayName'

describe('normalizeDisplayName', () => {
  it('trims strings', () => {
    expect(normalizeDisplayName('  a  ')).toBe('a')
  })

  it('null and undefined to empty', () => {
    expect(normalizeDisplayName(null)).toBe('')
    expect(normalizeDisplayName(undefined)).toBe('')
  })

  it('coerces non-strings', () => {
    expect(normalizeDisplayName(42)).toBe('42')
  })

  it('empty string stays empty', () => {
    expect(normalizeDisplayName('')).toBe('')
  })
})
