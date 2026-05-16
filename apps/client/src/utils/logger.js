const isDev = import.meta.env.DEV;
export function createLogger(scope) {
    const prefix = `[${scope}]`;
    return {
        debug: (...args) => {
            if (isDev) {
                console.debug(prefix, ...args);
            }
        },
        log: (...args) => {
            if (isDev) {
                console.log(prefix, ...args);
            }
        },
        info: (...args) => {
            if (isDev) {
                console.info(prefix, ...args);
            }
        },
        warn: (...args) => {
            if (isDev) {
                console.warn(prefix, ...args);
            }
        },
        error: (...args) => {
            console.error(prefix, ...args);
        },
    };
}
