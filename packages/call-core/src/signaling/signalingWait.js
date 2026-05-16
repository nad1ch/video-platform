export function waitForSignalingMessage(addMessageListener, predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = window.setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            unsubscribe();
            reject(new Error('signaling wait timeout'));
        }, timeoutMs);
        const unsubscribe = addMessageListener((data) => {
            if (settled || !predicate(data)) {
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            unsubscribe();
            resolve(data);
        });
    });
}
