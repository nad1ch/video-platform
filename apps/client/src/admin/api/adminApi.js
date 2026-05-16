import { apiFetch, readJsonIfOk } from '@/utils/apiFetch';
export async function adminGetJson(path) {
    const r = await apiFetch(path);
    if (r.status === 403) {
        return { forbidden: true };
    }
    if (!r.ok) {
        return { forbidden: false, notOk: true };
    }
    const data = await readJsonIfOk(r);
    return { forbidden: false, notOk: false, data };
}
