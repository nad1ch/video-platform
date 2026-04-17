import { describe, expect, it } from 'vitest'
import { buildApiUrl, sameOriginPrefixFromBaseUrl, trimApiBaseEnv } from '@/utils/apiUrlPure'

describe('trimApiBaseEnv', () => {
  it('trims and strips trailing slash', () => {
    expect(trimApiBaseEnv('  https://api.example.com/  ')).toBe('https://api.example.com')
    expect(trimApiBaseEnv('/app/')).toBe('/app')
  })

  it('returns empty for non-string or blank', () => {
    expect(trimApiBaseEnv(undefined)).toBe('')
    expect(trimApiBaseEnv(null)).toBe('')
    expect(trimApiBaseEnv('')).toBe('')
    expect(trimApiBaseEnv('   ')).toBe('')
    expect(trimApiBaseEnv(42)).toBe('')
  })
})

describe('sameOriginPrefixFromBaseUrl', () => {
  it('uses api base when set', () => {
    expect(sameOriginPrefixFromBaseUrl('https://x.com', '/app/')).toBe('https://x.com')
  })

  it('uses BASE_URL without trailing slash when api base empty', () => {
    expect(sameOriginPrefixFromBaseUrl('', '/app/')).toBe('/app')
    expect(sameOriginPrefixFromBaseUrl('', '/app')).toBe('/app')
  })

  it('returns empty at site root', () => {
    expect(sameOriginPrefixFromBaseUrl('', '/')).toBe('')
    expect(sameOriginPrefixFromBaseUrl('', '')).toBe('')
  })

  it('defaults missing base to root', () => {
    expect(sameOriginPrefixFromBaseUrl('', undefined)).toBe('')
  })
})

describe('buildApiUrl', () => {
  it('prefixes path when prefix set', () => {
    expect(buildApiUrl('/app', 'api/foo')).toBe('/app/api/foo')
    expect(buildApiUrl('/app', '/api/foo')).toBe('/app/api/foo')
  })

  it('no duplicate slash when path already absolute', () => {
    expect(buildApiUrl('', '/api/foo')).toBe('/api/foo')
  })
})
