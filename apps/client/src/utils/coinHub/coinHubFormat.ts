/** Remaining time as `mm:ss` (minutes may exceed 59). */
export function formatMmSsRemaining(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return '00:00'
  }
  const totalSec = Math.floor(remainingMs / 1000)
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
