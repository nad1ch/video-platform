const isDev = import.meta.env.DEV

/**
 * Tiny namespaced logger: verbose in dev, errors only in production builds.
 */
export function createLogger(scope: string) {
  const prefix = `[${scope}]`
  return {
    debug: (...args: unknown[]) => {
      if (isDev) {
        console.debug(prefix, ...args)
      }
    },
    log: (...args: unknown[]) => {
      if (isDev) {
        console.log(prefix, ...args)
      }
    },
    info: (...args: unknown[]) => {
      if (isDev) {
        console.info(prefix, ...args)
      }
    },
    warn: (...args: unknown[]) => {
      if (isDev) {
        console.warn(prefix, ...args)
      }
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args)
    },
  }
}
