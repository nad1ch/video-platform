export function trimApiBaseEnv(raw) {
    if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw.trim().replace(/\/$/, '');
    }
    return '';
}
export function sameOriginPrefixFromBaseUrl(apiBaseTrimmed, baseUrl) {
    if (apiBaseTrimmed) {
        return apiBaseTrimmed;
    }
    const b = typeof baseUrl === 'string' && baseUrl.length > 0 ? baseUrl : '/';
    if (b === '/' || b === '') {
        return '';
    }
    return b.replace(/\/$/, '');
}
export function buildApiUrl(prefix, path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return prefix ? `${prefix}${p}` : p;
}
