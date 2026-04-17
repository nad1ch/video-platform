/** Wire shape from `adminGetJson` — pure interpretation for users/stats loaders. */
export type AdminGetJsonWireResult<T> =
  | { forbidden: true }
  | { forbidden: false; notOk: true }
  | { forbidden: false; notOk: false; data: T | null }

/** Normalize `adminGetJson` result without changing branching semantics. */
export function interpretAdminGetJson<T>(
  res: AdminGetJsonWireResult<T>,
): { tag: 'forbidden' } | { tag: 'bad' } | { tag: 'ok'; data: T } {
  if (res.forbidden) {
    return { tag: 'forbidden' }
  }
  if (res.notOk || res.data == null) {
    return { tag: 'bad' }
  }
  return { tag: 'ok', data: res.data }
}

export function streamerPostOutcome(r: Pick<Response, 'status' | 'ok'>): 'forbidden' | 'save' | 'ok' {
  if (r.status === 403) {
    return 'forbidden'
  }
  if (!r.ok) {
    return 'save'
  }
  return 'ok'
}

export function streamerDeleteOutcome(r: Pick<Response, 'status' | 'ok'>): 'forbidden' | 'save' | 'ok' {
  if (r.status === 403) {
    return 'forbidden'
  }
  if (!r.ok && r.status !== 204) {
    return 'save'
  }
  return 'ok'
}

/** `databaseConfigured !== false` from API payloads (users/stats/streamers). */
export function adminDatabaseConfiguredFromPayload(payload: { databaseConfigured?: boolean } | null | undefined): boolean {
  return payload?.databaseConfigured !== false
}
