/** Legacy no-op: anonymous Firebase auth was only used for Callable Functions. */
export function ensureAnonymousAuth() {
  return Promise.resolve()
}
