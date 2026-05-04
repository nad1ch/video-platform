import { describe, expect, it } from 'vitest'
import { inferWsOriginFromHttpApiBase, trimViteApiBase } from '../src/utils/inferSignalingWsUrlFromApiBase'

describe('inferWsOriginFromHttpApiBase', () => {
  it('maps https API origin to wss origin', () => {
    expect(inferWsOriginFromHttpApiBase('https://api.example.com')).toBe('wss://api.example.com/')
  })

  it('returns null for path-only base', () => {
    expect(inferWsOriginFromHttpApiBase('/app')).toBe(null)
  })

  it('maps http to ws for local dev', () => {
    expect(inferWsOriginFromHttpApiBase('http://127.0.0.1:3000')).toBe('ws://127.0.0.1:3000/')
  })
})

describe('trimViteApiBase', () => {
  it('trims slashes', () => {
    expect(trimViteApiBase('https://api.example.com/')).toBe('https://api.example.com')
  })
})
