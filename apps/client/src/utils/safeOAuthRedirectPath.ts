/**
 * Sanitize post-OAuth return path: same-origin relative only (`/foo`).
 * Blocks protocol-relative URLs (`//evil.example`) and other non-relative input.
 */
export function safeOAuthRedirectPath(redirectPath?: string): string {
  return typeof redirectPath === 'string' &&
    redirectPath.startsWith('/') &&
    !redirectPath.startsWith('//')
    ? redirectPath
    : '/'
}
