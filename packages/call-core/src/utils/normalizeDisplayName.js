export function normalizeDisplayName(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value.trim();
    }
    return String(value).trim();
}
