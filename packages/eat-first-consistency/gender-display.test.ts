import { describe, expect, it } from 'vitest'
import { formatGenderDisplay, normalizeGenderForStorage } from '@/eat-first/utils/genderDisplay.js'

describe('formatGenderDisplay', () => {
  it('normalizes short labels', () => {
    expect(formatGenderDisplay('Чол.')).toBe('Чоловік')
    expect(formatGenderDisplay('Жін.')).toBe('Жінка')
    expect(formatGenderDisplay('чоловік')).toBe('Чоловік')
    expect(formatGenderDisplay('жінка')).toBe('Жінка')
  })

  it('returns em dash for empty', () => {
    expect(formatGenderDisplay('')).toBe('—')
    expect(formatGenderDisplay(null)).toBe('—')
  })

  it('passes through other strings', () => {
    expect(formatGenderDisplay('Custom')).toBe('Custom')
  })
})

describe('normalizeGenderForStorage', () => {
  it('maps abbreviated to full form', () => {
    expect(normalizeGenderForStorage('Чол.')).toBe('Чоловік')
  })

  it('empty stays empty', () => {
    expect(normalizeGenderForStorage('')).toBe('')
  })
})
