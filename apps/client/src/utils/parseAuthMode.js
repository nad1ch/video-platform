export function parseAuthMode(raw) {
    const s = typeof raw === 'string' ? raw : 'login';
    if (s === 'signup' || s === 'forgot' || s === 'forgot-success' || s === 'reset' || s === 'reset-success' || s === 'login') {
        return s;
    }
    return 'login';
}
