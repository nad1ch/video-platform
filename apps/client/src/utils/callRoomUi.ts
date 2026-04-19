/**
 * Call room helpers (pure). Used by CallPage room chip + popover.
 */

const ROOM_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ELLIPSIS = '\u22EF' // ⋯

/** Short discreet label; full id is shown inside the popover. */
export function formatCallRoomChip(roomId: string): string {
  const t = typeof roomId === 'string' ? roomId.trim() : ''
  if (!t) {
    return ELLIPSIS
  }
  if (t.length <= 2) {
    return `${t[0] ?? ''}${ELLIPSIS}`
  }
  if (t.length <= 5) {
    return `${t[0]}${ELLIPSIS}${t[t.length - 1]}`
  }
  return `${t.slice(0, 2)}${ELLIPSIS}${t.slice(-2)}`
}

/** 8-char lowercase alphanumeric room slug (256^8 space; fine for ad-hoc rooms). */
export function generateCallRoomCode(): string {
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length]!
  }
  return out
}
