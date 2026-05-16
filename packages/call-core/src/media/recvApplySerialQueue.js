export function createRecvApplySerialQueue(logError = console.error) {
    let tail = Promise.resolve();
    function enqueue(run) {
        const job = tail.then(() => run());
        tail = job.catch((err) => {
            logError(err);
        });
        return job;
    }
    function reset() {
        tail = Promise.resolve();
    }
    return { enqueue, reset };
}
