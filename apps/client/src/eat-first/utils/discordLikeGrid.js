/**
 * Підбір сітки як у Discord / Zoom gallery: cols×rows для N плиток,
 * щоб заповнити контейнер і зберегти плитки близькими до 16:9.
 *
 * @param {number} tileCount
 * @param {number} containerWidth
 * @param {number} containerHeight
 * @returns {{ cols: number, rows: number }}
 */
export function discordLikeGridDims(tileCount, containerWidth, containerHeight) {
  const n = Math.max(0, Math.floor(Number(tileCount) || 0))
  const w = Math.max(1, Number(containerWidth) || 1)
  const h = Math.max(1, Number(containerHeight) || 1)
  if (n <= 0) return { cols: 1, rows: 1 }
  if (n === 1) return { cols: 1, rows: 1 }

  const containerAr = w / h
  const targetCellAr = 16 / 9

  let bestCols = 1
  let bestRows = n
  let bestScore = Infinity

  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const cellW = w / cols
    const cellH = h / rows
    const cellAr = cellW / cellH
    const empty = cols * rows - n
    const arPenalty = Math.abs(cellAr - targetCellAr) / targetCellAr
    const rowColBalance = Math.abs(cols / Math.max(1, rows) - containerAr) * 0.06
    const score = arPenalty * 1.15 + empty * 0.5 + rowColBalance

    if (score < bestScore) {
      bestScore = score
      bestCols = cols
      bestRows = rows
    }
  }

  return { cols: bestCols, rows: bestRows }
}
