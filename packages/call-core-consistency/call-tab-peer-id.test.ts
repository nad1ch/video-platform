import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear() {
      m.clear()
    },
    getItem(key: string) {
      return m.has(key) ? m.get(key)! : null
    },
    key(index: number) {
      return Array.from(m.keys())[index] ?? null
    },
    removeItem(key: string) {
      m.delete(key)
    },
    setItem(key: string, value: string) {
      m.set(key, value)
    },
  }
}

describe('callTabPeerId', () => {
  const LS_KEY = 'streamassist_call_device_id'
  const SS_PEER_KEY = 'streamassist_call_tab_peer_id'
  let prevLocalStorage: Storage | undefined
  let prevSessionStorage: Storage | undefined

  beforeEach(() => {
    vi.resetModules()
    prevLocalStorage = globalThis.localStorage
    prevSessionStorage = globalThis.sessionStorage
    globalThis.localStorage = memoryStorage()
    globalThis.sessionStorage = memoryStorage()
    vi.stubGlobal('crypto', {
      randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    })
    vi.stubGlobal('performance', {
      getEntriesByType: (type: string) => {
        if (type === 'navigation') {
          return [{ type: 'navigate' }] as PerformanceNavigationTiming[]
        }
        return []
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (prevLocalStorage === undefined) {
      Reflect.deleteProperty(globalThis, 'localStorage')
    } else {
      globalThis.localStorage = prevLocalStorage
    }
    if (prevSessionStorage === undefined) {
      Reflect.deleteProperty(globalThis, 'sessionStorage')
    } else {
      globalThis.sessionStorage = prevSessionStorage
    }
  })

  it('readOrCreateCallDeviceId returns runtime when localStorage is missing', async () => {
    Reflect.deleteProperty(globalThis, 'localStorage')
    const { readOrCreateCallDeviceId } = await import('../call-core/src/utils/callTabPeerId')
    expect(readOrCreateCallDeviceId()).toBe('runtime')
  })

  it('readOrCreateCallDeviceId returns existing id when valid length', async () => {
    globalThis.localStorage.setItem(LS_KEY, 'device12345678')
    const { readOrCreateCallDeviceId } = await import('../call-core/src/utils/callTabPeerId')
    expect(readOrCreateCallDeviceId()).toBe('device12345678')
    expect(globalThis.localStorage.getItem(LS_KEY)).toBe('device12345678')
  })

  it('readOrCreateCallDeviceId replaces too-short stored id', async () => {
    globalThis.localStorage.setItem(LS_KEY, 'short')
    const { readOrCreateCallDeviceId } = await import('../call-core/src/utils/callTabPeerId')
    expect(readOrCreateCallDeviceId()).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(globalThis.localStorage.getItem(LS_KEY)).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('readOrCreateCallDeviceId replaces too-long stored id', async () => {
    const tooLong = 'x'.repeat(129)
    globalThis.localStorage.setItem(LS_KEY, tooLong)
    const { readOrCreateCallDeviceId } = await import('../call-core/src/utils/callTabPeerId')
    expect(readOrCreateCallDeviceId()).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('readOrCreateCallDeviceId returns runtime when storage throws', async () => {
    const throwing: Storage = {
      ...memoryStorage(),
      setItem() {
        throw new Error('quota')
      },
    }
    globalThis.localStorage = throwing
    const { readOrCreateCallDeviceId } = await import('../call-core/src/utils/callTabPeerId')
    expect(readOrCreateCallDeviceId()).toBe('runtime')
  })

  it('newCallTabPeerId uses 8-char device prefix and hyphenated tab uuid', async () => {
    globalThis.localStorage.setItem(LS_KEY, 'device12345678')
    const { newCallTabPeerId } = await import('../call-core/src/utils/callTabPeerId')
    expect(newCallTabPeerId()).toBe('peer-device12-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('newCallTabPeerId ignores cloned sessionStorage on navigate (duplicate-tab case)', async () => {
    globalThis.localStorage.setItem(LS_KEY, 'device12345678')
    globalThis.sessionStorage.setItem(SS_PEER_KEY, 'peer-device12-stale-stale-stale-stale')
    const { newCallTabPeerId } = await import('../call-core/src/utils/callTabPeerId')
    expect(newCallTabPeerId()).toBe('peer-device12-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(globalThis.sessionStorage.getItem(SS_PEER_KEY)).toBe(
      'peer-device12-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    )
  })

  it('newCallTabPeerId reuses sessionStorage id on reload', async () => {
    vi.stubGlobal('performance', {
      getEntriesByType: (type: string) => {
        if (type === 'navigation') {
          return [{ type: 'reload' }] as PerformanceNavigationTiming[]
        }
        return []
      },
    })
    globalThis.localStorage.setItem(LS_KEY, 'device12345678')
    const stable = 'peer-device12-stale-stale-stale-stale'
    globalThis.sessionStorage.setItem(SS_PEER_KEY, stable)
    const { newCallTabPeerId } = await import('../call-core/src/utils/callTabPeerId')
    expect(newCallTabPeerId()).toBe(stable)
  })
})
