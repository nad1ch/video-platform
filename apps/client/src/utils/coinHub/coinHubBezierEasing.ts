




const X1 = 0.1
const Y1 = 0.7
const X2 = 0.1
const Y2 = 1

function bezierX(t: number, x1: number, x2: number): number {
  return 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
}

function bezierY(t: number, y1: number, y2: number): number {
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
}




function yForTime(u: number): number {
  if (u <= 0) {
    return 0
  }
  if (u >= 1) {
    return 1
  }
  let tLow = 0
  let tHigh = 1
  for (let k = 0; k < 14; k += 1) {
    const t = (tLow + tHigh) * 0.5
    const x = bezierX(t, X1, X2)
    if (x < u) {
      tLow = t
    } else {
      tHigh = t
    }
  }
  const t = (tLow + tHigh) * 0.5
  return bezierY(t, Y1, Y2)
}


export function spinCubicBezierProgress(u: number): number {
  return yForTime(Math.min(1, Math.max(0, u)))
}





const SX1 = 0.15
const SY1 = 0.85
const SX2 = 0.3
const SY2 = 1

function slotYForTime(u: number): number {
  if (u <= 0) {
    return 0
  }
  if (u >= 1) {
    return 1
  }
  let tLow = 0
  let tHigh = 1
  for (let k = 0; k < 16; k += 1) {
    const t = (tLow + tHigh) * 0.5
    const x = bezierX(t, SX1, SX2)
    if (x < u) {
      tLow = t
    } else {
      tHigh = t
    }
  }
  const t = (tLow + tHigh) * 0.5
  return bezierY(t, SY1, SY2)
}

export function slotCubicBezierProgress(u: number): number {
  return slotYForTime(Math.min(1, Math.max(0, u)))
}


const DX1 = 0.05
const DY1 = 0.8
const DX2 = 0.2
const DY2 = 1

function dailySpinYForTime(u: number): number {
  if (u <= 0) {
    return 0
  }
  if (u >= 1) {
    return 1
  }
  let tLow = 0
  let tHigh = 1
  for (let k = 0; k < 16; k += 1) {
    const t = (tLow + tHigh) * 0.5
    const x = bezierX(t, DX1, DX2)
    if (x < u) {
      tLow = t
    } else {
      tHigh = t
    }
  }
  const t = (tLow + tHigh) * 0.5
  return bezierY(t, DY1, DY2)
}

export function dailySpinReelProgress(u: number): number {
  return dailySpinYForTime(Math.min(1, Math.max(0, u)))
}





export function dailySpinPhaseTimeRemap(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  const t1 = 0.6 / 3.9
  const t2 = 2.1 / 3.9
  const w1 = 0.48
  const w2 = 0.3
  if (x <= t1) {
    return (x / t1) * w1
  }
  if (x <= t2) {
    return w1 + ((x - t1) / (t2 - t1)) * w2
  }
  return w1 + w2 + ((x - t2) / (1 - t2)) * (1 - w1 - w2)
}
