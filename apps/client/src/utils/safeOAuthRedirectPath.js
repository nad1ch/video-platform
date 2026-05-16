export function safeOAuthRedirectPath(redirectPath) {
    return typeof redirectPath === 'string' &&
        redirectPath.startsWith('/') &&
        !redirectPath.startsWith('//')
        ? redirectPath
        : '/app';
}
