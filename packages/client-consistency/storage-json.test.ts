import { describe, expect, it } from 'vitest'
import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'

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

describe('readStorageJson', () => {
  it('returns fallback when storage missing', () => {
    expect(readStorageJson(null, 'k', 7)).toBe(7)
    expect(readStorageJson(undefined, 'k', 7)).toBe(7)
  })

  it('parses JSON or falls back', () => {
    const s = memoryStorage()
    expect(readStorageJson(s, 'k', [])).toEqual([])
    s.setItem('k', JSON.stringify({ a: 1 }))
    expect(readStorageJson(s, 'k', null)).toEqual({ a: 1 })
    s.setItem('k', 'not json')
    expect(readStorageJson(s, 'k', 'fb')).toBe('fb')
    s.setItem('k', '')
    expect(readStorageJson(s, 'k', 'empty')).toBe('empty')
  })
})

describe('writeStorageJson', () => {
  it('no-ops when storage missing', () => {
    expect(() => writeStorageJson(null, 'k', { x: 1 })).not.toThrow()
  })

  it('serializes value', () => {
    const s = memoryStorage()
    writeStorageJson(s, 'k', { b: 2 })
    expect(s.getItem('k')).toBe('{"b":2}')
  })
})
