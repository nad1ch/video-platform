import type { CallEngineOptions } from './useCallEngine'
import { useCallEngine } from './useCallEngine'

/**
 * Stable public entry for the call stack. Today this is a thin facade over `useCallEngine`
 * (same return shape and behavior) so UI and integrations depend on one name; future
 * orchestration (metrics, retry policy, side-effect boundaries) can live here without
 * rewiring mediasoup or signaling internals.
 */
export function useCallOrchestrator(options?: CallEngineOptions) {
  return useCallEngine(options)
}
