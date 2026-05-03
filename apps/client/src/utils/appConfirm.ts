



export function appConfirm(message: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.confirm(message)
}
