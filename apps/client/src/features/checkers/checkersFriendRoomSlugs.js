import { readStorageJson, writeStorageJson } from '@/utils/storageJson.js';
const STORAGE_KEY = 'checkers:friend-room-slugs:v1';
function readSlugs() {
    const raw = readStorageJson(typeof localStorage !== 'undefined' ? localStorage : null, STORAGE_KEY, []);
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.length > 0) : [];
}
function writeSlugs(slugs) {
    writeStorageJson(typeof localStorage !== 'undefined' ? localStorage : null, STORAGE_KEY, slugs);
}
export function checkersFriendSlugSet() {
    return new Set(readSlugs());
}
export function addCheckersFriendSlug(roomId) {
    const id = roomId.trim().slice(0, 80);
    if (!id)
        return;
    const list = readSlugs();
    if (list.includes(id))
        return;
    list.push(id);
    writeSlugs(list);
}
export function removeCheckersFriendSlug(roomId) {
    const id = roomId.trim().slice(0, 80);
    if (!id)
        return;
    const next = readSlugs().filter((s) => s !== id);
    writeSlugs(next);
}
