
export type MafiaSeatLabelRow = { number: number; displayName: string }

/**
 * **Tiles / video only:** `1 Name` (seat + displayName from rows).
 * Do not use for queue, host actions, or other game logic UI (use `mafiaGameSeatText` there).
 */
export function mafiaSeatLabel(seat: number, rows: readonly MafiaSeatLabelRow[]): string {
  if (!Number.isFinite(seat) || seat < 1) {
    return String(seat)
  }
  const row = rows.find((p) => p.number === seat)
  const name = row?.displayName?.trim() ?? ''
  if (name.length > 0) {
    return `${seat} ${name}`
  }
  return String(seat)
}




export function mafiaGameSeatText(seat: number): string {
  if (Number.isInteger(seat) && seat >= 1) {
    return String(seat)
  }
  return String(seat)
}
