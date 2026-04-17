import { describe, expect, it } from 'vitest'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'

describe('safeOAuthRedirectPath', () => {
  it('allows same-origin relative paths', () => {
    expect(safeOAuthRedirectPath('/eat-first')).toBe('/eat-first')
    expect(safeOAuthRedirectPath('/')).toBe('/')
  })

  it('blocks protocol-relative and non-relative', () => {
    expect(safeOAuthRedirectPath('//evil.example/path')).toBe('/app')
    expect(safeOAuthRedirectPath('https://evil.example')).toBe('/app')
    expect(safeOAuthRedirectPath('relative-no-slash')).toBe('/app')
  })

  it('defaults for missing or non-string', () => {
    expect(safeOAuthRedirectPath(undefined)).toBe('/app')
    expect(safeOAuthRedirectPath('')).toBe('/app')
  })
})
