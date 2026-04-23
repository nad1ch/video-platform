/**
 * Rarity tiers for daily spin / strip visuals (coin value → tier).
 * Shared by `coinHubStripMath`, `coinHubSpinReel`, and UI.
 */
export type SpinRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/**
 * Value bands (clear hierarchy for strip + win VFX + audio).
 * &lt;10 common · 10–19 uncommon · 20–49 rare · 50–99 epic · 100+ legendary
 */
export function getSpinRarity(value: number): SpinRarity {
  if (!Number.isFinite(value) || value < 0) {
    return 'common'
  }
  if (value < 10) {
    return 'common'
  }
  if (value < 20) {
    return 'uncommon'
  }
  if (value < 50) {
    return 'rare'
  }
  if (value < 100) {
    return 'epic'
  }
  return 'legendary'
}

export function getSpinRarityForLabel(label: string): SpinRarity {
  const n = Number.parseInt(label, 10)
  if (Number.isNaN(n)) {
    return 'common'
  }
  return getSpinRarity(n)
}
