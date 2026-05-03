import type { CaseState } from './types'


export const HUB_CASE_IDS: readonly string[] = [
  'luck-0',
  'luck-1',
  'luck-2',
  'luck-3',
  'free',
  'subscriber',
]

type SeedCase = { caseId: string; state: CaseState; cooldownUntilMsFromNow: number | null }


const CASE_SEED: readonly SeedCase[] = [
  { caseId: 'luck-0', state: 'available', cooldownUntilMsFromNow: null },
  { caseId: 'luck-1', state: 'available', cooldownUntilMsFromNow: null },
  { caseId: 'luck-2', state: 'locked', cooldownUntilMsFromNow: null },
  {
    caseId: 'luck-3',
    state: 'cooldown',
    cooldownUntilMsFromNow: 60 * 60 * 1000, // 1h demo; GET reconciles to available when past
  },
  { caseId: 'free', state: 'available', cooldownUntilMsFromNow: null },
  { caseId: 'subscriber', state: 'locked', cooldownUntilMsFromNow: null },
]

export function caseSeedForCreate(createdAt: Date): Array<{
  caseId: string
  state: string
  cooldownUntil: Date | null
}> {
  return CASE_SEED.map((c) => ({
    caseId: c.caseId,
    state: c.state,
    cooldownUntil:
      c.cooldownUntilMsFromNow == null
        ? null
        : new Date(createdAt.getTime() + c.cooldownUntilMsFromNow),
  }))
}


const DAILY_SPIN_WEIGHTS: ReadonlyArray<{ value: number; w: number }> = [
  { value: 5, w: 30 },
  { value: 8, w: 25 },
  { value: 12, w: 20 },
  { value: 20, w: 10 },
  { value: 25, w: 8 },
  { value: 50, w: 5 },
  { value: 100, w: 2 },
]





export function pickDailySpinAmount(rng: () => number = Math.random): number {
  const total = DAILY_SPIN_WEIGHTS.reduce((a, b) => a + b.w, 0)
  const r = rng() * total
  let acc = 0
  for (const item of DAILY_SPIN_WEIGHTS) {
    acc += item.w
    if (r < acc) {
      return item.value
    }
  }
  return DAILY_SPIN_WEIGHTS[DAILY_SPIN_WEIGHTS.length - 1]!.value
}


export const CASE_OPEN_REWARD: Readonly<Record<string, number>> = {
  'luck-0': 100,
  'luck-1': 120,
  'luck-2': 0,
  'luck-3': 200,
  free: 30,
  subscriber: 0,
}


export const CASE_OPEN_COOLDOWN_MS = 24 * 60 * 60 * 1000
