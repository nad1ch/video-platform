import { computed, ref } from 'vue'

export type EatOption = { id: string; label: string; votes: number }

/**
 * Isolated demo state for /eat. Replace this composable (or wire it to real API / WS)
 * when migrating code from eat-first-overlay — do not share Pinia stores with Wordle/Call.
 */
export function useEatFirstLocalDemo(seed: { id: string; label: string }[]) {
  const options = ref<EatOption[]>(seed.map((s) => ({ ...s, votes: 0 })))

  function vote(id: string): void {
    const o = options.value.find((x) => x.id === id)
    if (o) {
      o.votes += 1
    }
  }

  function reset(): void {
    options.value = seed.map((s) => ({ ...s, votes: 0 }))
  }

  const totalVotes = computed(() => options.value.reduce((acc, o) => acc + o.votes, 0))

  return { options, vote, reset, totalVotes }
}
