import { computed, ref } from 'vue';
import { adminGetJson } from '@/admin/api/adminApi';
import { adminDatabaseConfiguredFromPayload, interpretAdminGetJson, streamerDeleteOutcome, streamerPostOutcome, } from '@/admin/state/adminStatePure';
import { apiFetch } from '@/utils/apiFetch';
async function fetchLooseAdminJson(path) {
    const r = await apiFetch(path);
    if (r.status === 403) {
        return { tag: 'forbidden' };
    }
    return { tag: 'ok', data: (await r.json()) };
}
export function useAdminUsersState() {
    const users = ref([]);
    const loading = ref(true);
    const errorKey = ref(null);
    const databaseConfigured = ref(true);
    const lastUpdated = ref(null);
    async function load() {
        loading.value = true;
        errorKey.value = null;
        try {
            const res = await adminGetJson('/api/admin/users');
            const out = interpretAdminGetJson(res);
            if (out.tag === 'forbidden') {
                errorKey.value = 'forbidden';
                users.value = [];
                return;
            }
            if (out.tag === 'bad') {
                errorKey.value = 'load';
                users.value = [];
                return;
            }
            const j = out.data;
            databaseConfigured.value = adminDatabaseConfiguredFromPayload(j);
            users.value = Array.isArray(j.users) ? j.users : [];
            lastUpdated.value = new Date();
        }
        catch {
            errorKey.value = 'load';
            users.value = [];
        }
        finally {
            loading.value = false;
        }
    }
    return { users, loading, errorKey, databaseConfigured, lastUpdated, load };
}
export function useAdminStatsState() {
    const data = ref(null);
    const loading = ref(true);
    const errorKey = ref(null);
    const reloading = ref(false);
    const databaseConfigured = computed(() => adminDatabaseConfiguredFromPayload(data.value));
    async function fetchAdminStats() {
        const res = await adminGetJson('/api/admin/stats');
        const out = interpretAdminGetJson(res);
        if (out.tag === 'forbidden') {
            errorKey.value = 'forbidden';
            data.value = null;
            return;
        }
        if (out.tag === 'bad') {
            errorKey.value = 'load';
            data.value = null;
            return;
        }
        errorKey.value = null;
        data.value = out.data;
    }
    async function load() {
        loading.value = true;
        errorKey.value = null;
        try {
            await fetchAdminStats();
        }
        catch {
            errorKey.value = 'load';
            data.value = null;
        }
        finally {
            loading.value = false;
        }
    }
    async function reload() {
        reloading.value = true;
        errorKey.value = null;
        try {
            await fetchAdminStats();
        }
        catch {
            errorKey.value = 'load';
            data.value = null;
        }
        finally {
            reloading.value = false;
        }
    }
    return { data, loading, errorKey, reloading, databaseConfigured, load, reload };
}
export function useAdminStreamersState() {
    const streamers = ref([]);
    const owners = ref([]);
    const loading = ref(true);
    const saving = ref(false);
    const errorKey = ref(null);
    const databaseConfigured = ref(true);
    const slug = ref('');
    const ownerId = ref('');
    const ownersWithTwitch = computed(() => owners.value.filter((o) => Boolean(o.twitchId?.trim())));
    async function loadUsers() {
        const got = await fetchLooseAdminJson('/api/admin/users');
        if (got.tag === 'forbidden') {
            throw new Error('forbidden');
        }
        const data = got.data;
        if (data.databaseConfigured === false) {
            databaseConfigured.value = false;
            owners.value = [];
            return;
        }
        databaseConfigured.value = true;
        owners.value =
            data.users?.map((u) => ({
                id: u.id,
                displayName: u.displayName,
                twitchId: u.twitchId,
            })) ?? [];
    }
    async function loadStreamers() {
        const got = await fetchLooseAdminJson('/api/admin/streamers');
        if (got.tag === 'forbidden') {
            throw new Error('forbidden');
        }
        const data = got.data;
        if (data.databaseConfigured === false) {
            databaseConfigured.value = false;
            streamers.value = [];
            return;
        }
        databaseConfigured.value = true;
        streamers.value = data.streamers ?? [];
    }
    async function refresh() {
        loading.value = true;
        errorKey.value = null;
        try {
            await Promise.all([loadUsers(), loadStreamers()]);
        }
        catch {
            errorKey.value = 'load';
        }
        finally {
            loading.value = false;
        }
    }
    async function createStreamer() {
        saving.value = true;
        errorKey.value = null;
        try {
            const r = await apiFetch('/api/admin/streamers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: slug.value.trim(),
                    ownerId: ownerId.value,
                }),
            });
            const o = streamerPostOutcome(r);
            if (o === 'forbidden') {
                errorKey.value = 'forbidden';
                return;
            }
            if (o === 'save') {
                errorKey.value = 'save';
                return;
            }
            slug.value = '';
            ownerId.value = '';
            await loadStreamers();
        }
        catch {
            errorKey.value = 'save';
        }
        finally {
            saving.value = false;
        }
    }
    async function removeStreamer(id) {
        saving.value = true;
        errorKey.value = null;
        try {
            const r = await apiFetch(`/api/admin/streamers/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            const o = streamerDeleteOutcome(r);
            if (o === 'forbidden') {
                errorKey.value = 'forbidden';
                return;
            }
            if (o === 'save') {
                errorKey.value = 'save';
                return;
            }
            await loadStreamers();
        }
        catch {
            errorKey.value = 'save';
        }
        finally {
            saving.value = false;
        }
    }
    return {
        streamers,
        owners,
        loading,
        saving,
        errorKey,
        databaseConfigured,
        slug,
        ownerId,
        ownersWithTwitch,
        refresh,
        createStreamer,
        removeStreamer,
    };
}
