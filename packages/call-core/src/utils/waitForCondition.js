export function waitForCondition(predicate, timeoutMs, intervalMs = 50) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
            if (predicate()) {
                resolve();
                return;
            }
            if (Date.now() - started > timeoutMs) {
                reject(new Error('Timeout waiting for condition'));
                return;
            }
            setTimeout(tick, intervalMs);
        };
        tick();
    });
}
