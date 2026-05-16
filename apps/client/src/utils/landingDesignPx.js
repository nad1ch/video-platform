const pxCache = new Map();
export function landingDesignPx(value) {
    let s = pxCache.get(value);
    if (s === undefined) {
        s = `calc(var(--u) * ${value})`;
        pxCache.set(value, s);
    }
    return s;
}
