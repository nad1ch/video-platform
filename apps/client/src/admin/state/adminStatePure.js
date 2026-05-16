export function interpretAdminGetJson(res) {
    if (res.forbidden) {
        return { tag: 'forbidden' };
    }
    if (res.notOk || res.data == null) {
        return { tag: 'bad' };
    }
    return { tag: 'ok', data: res.data };
}
export function streamerPostOutcome(r) {
    if (r.status === 403) {
        return 'forbidden';
    }
    if (!r.ok) {
        return 'save';
    }
    return 'ok';
}
export function streamerDeleteOutcome(r) {
    if (r.status === 403) {
        return 'forbidden';
    }
    if (!r.ok && r.status !== 204) {
        return 'save';
    }
    return 'ok';
}
export function adminDatabaseConfiguredFromPayload(payload) {
    return payload?.databaseConfigured !== false;
}
