



export function safeOAuthRedirectPath(redirectPath?: string): string {
  return typeof redirectPath === 'string' &&
    redirectPath.startsWith('/') &&
    !redirectPath.startsWith('//')
    ? redirectPath
    : '/app'
}
