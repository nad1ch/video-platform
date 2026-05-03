
export function formatGenderDisplay(gender) {
  const s = String(gender ?? '').trim()
  if (!s) return '—'
  const lower = s.toLowerCase()
  if (s === 'Чол.' || lower.startsWith('чол')) return 'Чоловік'
  if (s === 'Жін.' || lower.startsWith('жін')) return 'Жінка'
  return s
}


export function normalizeGenderForStorage(gender) {
  const s = String(gender ?? '').trim()
  if (!s) return ''
  const d = formatGenderDisplay(s)
  return d === '—' ? s : d
}
