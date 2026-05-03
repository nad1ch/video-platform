
export const UI_MIN_ROUND = 1
export const UI_MAX_ROUND = 8

export function clampRoundForOverlay(raw) {
  return Math.min(UI_MAX_ROUND, Math.max(UI_MIN_ROUND, Math.floor(Number(raw) || 1)))
}
