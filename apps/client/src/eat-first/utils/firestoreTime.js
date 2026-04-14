/** Мілісекунди з Firestore Timestamp або сумісного об’єкта. */
export function millisFromFirestore(ts) {
  if (ts == null) return null
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return null
}
