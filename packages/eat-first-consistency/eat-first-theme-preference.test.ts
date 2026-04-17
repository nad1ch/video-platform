import { describe, expect, it } from 'vitest'
import { eatFirstThemeFromStorageValue } from '@/eat-first/state/eatFirstThemePreference.js'

describe('eatFirstThemeFromStorageValue', () => {
  it('accepts light and dark', () => {
    expect(eatFirstThemeFromStorageValue('light')).toBe('light')
    expect(eatFirstThemeFromStorageValue('dark')).toBe('dark')
  })

  it('defaults to dark for unknown or null', () => {
    expect(eatFirstThemeFromStorageValue(null)).toBe('dark')
    expect(eatFirstThemeFromStorageValue('')).toBe('dark')
    expect(eatFirstThemeFromStorageValue('system')).toBe('dark')
  })
})
