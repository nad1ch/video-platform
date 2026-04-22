import { describe, expect, it } from 'vitest'
import { mafiaViewQueryIsView } from '../../apps/client/src/composables/mafiaStreamViewRoute'

describe('mafiaViewQueryIsView', () => {
  it('is true only for mode=view (string or first array value)', () => {
    expect(mafiaViewQueryIsView('view')).toBe(true)
    expect(mafiaViewQueryIsView(['view', 'x'])).toBe(true)
    expect(mafiaViewQueryIsView(undefined)).toBe(false)
    expect(mafiaViewQueryIsView('host')).toBe(false)
    expect(mafiaViewQueryIsView(['host'])).toBe(false)
  })
})
