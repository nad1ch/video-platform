import type { MafiaLastNightResult, MafiaNightActions } from './mafiaGameTypes'

/**
 * If mafia and doctor target the same seat, no one dies.
 * If mafia’s target is set and differs (or doctor not set to same seat), the mafia target dies.
 * If the mafia night action is not set, there is no result yet.
 */
export function computeMafiaLastNightResult(actions: MafiaNightActions): MafiaLastNightResult | null {
  const m = actions.mafia
  const d = actions.doctor
  if (m == null) {
    return null
  }
  if (d != null && m === d) {
    return { saved: true }
  }
  return { died: m, saved: false }
}
