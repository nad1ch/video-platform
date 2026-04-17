/**
 * Stubs — `callableApiEnabled()` is always false; eat-first uses the StreamAssist API.
 * If these throw, a stale branch re-enabled Callable by mistake.
 */
export async function callPromoteToHost() {
  throw new Error('Callable API is disabled')
}

export async function callLinkPlayerSlot() {
  throw new Error('Callable API is disabled')
}

export async function callSubmitVote() {
  throw new Error('Callable API is disabled')
}

export async function callHostClearVotes() {
  throw new Error('Callable API is disabled')
}

export async function callHostDeleteVote() {
  throw new Error('Callable API is disabled')
}

export async function callHostSetGamePhase() {
  throw new Error('Callable API is disabled')
}
