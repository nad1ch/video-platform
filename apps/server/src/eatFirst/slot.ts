/** Match client `normalizePlayerSlotId` (eat-first). */
export function normalizeEatFirstSlot(raw: unknown): string {
  const s = String(raw ?? 'p1').trim()
  if (!s) return 'p1'
  const lower = s.toLowerCase()
  const m = lower.match(/^p(\d+)$/)
  if (m) return `p${parseInt(m[1], 10)}`
  const digits = lower.match(/^(\d+)$/)
  if (digits) return `p${digits[1]}`
  return lower
}

export function isValidGameId(raw: string): boolean {
  const s = decodeURIComponent(raw || '').trim()
  return s.length > 0 && s.length <= 80 && /^[-a-zA-Z0-9_]+$/.test(s)
}
