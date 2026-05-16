import { apiFetch } from '@/utils/apiFetch';
export class CoinHubApiError extends Error {
    name = 'CoinHubApiError';
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
async function parseError(res) {
    try {
        const b = (await res.json());
        return new CoinHubApiError(res.status, b?.error?.code ?? 'HTTP', (b?.error?.message ?? res.statusText) || 'Request failed');
    }
    catch {
        return new CoinHubApiError(res.status, 'HTTP', res.statusText || 'Request failed');
    }
}
async function parseJson(res) {
    if (!res.ok) {
        throw await parseError(res);
    }
    return (await res.json());
}
export async function getCoinHub() {
    const r = await apiFetch('/api/coinhub');
    return parseJson(r);
}
export async function postCoinHubClaim() {
    const r = await apiFetch('/api/coinhub/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return parseJson(r);
}
export async function postCoinHubSpin() {
    const r = await apiFetch('/api/coinhub/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return parseJson(r);
}
export async function postCoinHubCaseOpen(caseId) {
    const r = await apiFetch('/api/coinhub/case/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
    });
    return parseJson(r);
}
