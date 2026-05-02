import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js'

const STORAGE_KEY = 'checkers:friend-room-slugs:v1'

function readSlugs(): string[] {
  const raw = readStorageJson(typeof localStorage !== 'undefined' ? localStorage : null, STORAGE_KEY, [])
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s.length > 0) : []
}

function writeSlugs(slugs: string[]): void {
  writeStorageJson(typeof localStorage !== 'undefined' ? localStorage : null, STORAGE_KEY, slugs)
}

export function checkersFriendSlugSet(): Set<string> {
  return new Set(readSlugs())
}

export function addCheckersFriendSlug(roomId: string): void {
  const id = roomId.trim().slice(0, 80)
  if (!id) return
  const list = readSlugs()
  if (list.includes(id)) return
  list.push(id)
  writeSlugs(list)
}

export function removeCheckersFriendSlug(roomId: string): void {
  const id = roomId.trim().slice(0, 80)
  if (!id) return
  const next = readSlugs().filter((s) => s !== id)
  writeSlugs(next)
}
