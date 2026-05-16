import { CoinHubApiError } from '@/api/coinHubApi';
export function classifyCoinHubError(e) {
    if (e instanceof CoinHubApiError) {
        if (e.status === 401 || e.status === 403) {
            return { kind: 'auth', message: e.message };
        }
        return { kind: 'http', message: e.message };
    }
    if (e instanceof TypeError) {
        return { kind: 'network', message: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    const low = msg.toLowerCase();
    if (low.includes('failed to fetch') ||
        low.includes('network') ||
        low.includes('load failed') ||
        low.includes('aborted')) {
        return { kind: 'network', message: msg };
    }
    return { kind: 'http', message: msg };
}
