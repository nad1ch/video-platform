import { describe, expect, it } from 'vitest'
import {
  callableApiEnabledFromFlags,
  trimFunctionsRegionEnv,
} from '@/eat-first/api/callableApiPure.js'

describe('callableApiPure', () => {
  it('trimFunctionsRegionEnv trims and stringifies', () => {
    expect(trimFunctionsRegionEnv('  eu-west1  ')).toBe('eu-west1')
    expect(trimFunctionsRegionEnv(undefined)).toBe('')
    expect(trimFunctionsRegionEnv(null)).toBe('')
  })

  it('callableApiEnabledFromFlags requires both flags', () => {
    expect(callableApiEnabledFromFlags(true, 'eu-west1')).toBe(true)
    expect(callableApiEnabledFromFlags(false, 'eu-west1')).toBe(false)
    expect(callableApiEnabledFromFlags(true, '')).toBe(false)
    expect(callableApiEnabledFromFlags(true, '   ')).toBe(false)
  })
})
