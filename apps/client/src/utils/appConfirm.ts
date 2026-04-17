/**
 * Central entry for confirmation prompts. Currently wraps `window.confirm`;
 * replace implementation later (e.g. in-app modal) without touching call sites.
 */
export function appConfirm(message: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.confirm(message)
}
