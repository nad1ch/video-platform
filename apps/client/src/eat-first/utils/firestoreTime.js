/** Milliseconds from legacy Firestore Timestamp, server ISO string, or `{ seconds }`. */
export function millisFromFirestore(ts) {
  if (ts == null) return null
  if (typeof ts === 'string') {
    const ms = Date.parse(ts)
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return null
}
