/** Parse #rrggbb or #rgb to RGBA bytes (alpha 255). */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
  const h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16)
    const g = parseInt(h[1]! + h[1]!, 16)
    const b = parseInt(h[2]! + h[2]!, 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      return null
    }
    return { r, g, b, a: 255 }
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      return null
    }
    return { r, g, b, a: 255 }
  }
  return null
}

/**
 * Stack flood fill on ImageData (device pixels). Replaces contiguous region matching seed color.
 */
export function floodFillImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  fillR: number,
  fillG: number,
  fillB: number,
  fillA: number,
  maxPixels = 2_500_000,
): void {
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) {
    return
  }
  const start = (seedY * width + seedX) * 4
  const tr = data[start]!
  const tg = data[start + 1]!
  const tb = data[start + 2]!
  const ta = data[start + 3]!
  if (tr === fillR && tg === fillG && tb === fillB && ta === fillA) {
    return
  }
  const stack: number[] = [seedX, seedY]
  let filled = 0
  while (stack.length && filled < maxPixels) {
    const y = stack.pop()!
    const x = stack.pop()!
    if (x < 0 || y < 0 || x >= width || y >= height) {
      continue
    }
    const i = (y * width + x) * 4
    if (data[i] !== tr || data[i + 1] !== tg || data[i + 2] !== tb || data[i + 3] !== ta) {
      continue
    }
    data[i] = fillR
    data[i + 1] = fillG
    data[i + 2] = fillB
    data[i + 3] = fillA
    filled += 1
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
}
