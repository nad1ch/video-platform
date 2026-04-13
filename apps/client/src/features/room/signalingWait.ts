export function waitForSignalingMessage<T>(
  addMessageListener: (handler: (data: unknown) => void) => () => void,
  predicate: (data: unknown) => data is T,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      unsubscribe()
      reject(new Error('signaling wait timeout'))
    }, timeoutMs)

    const unsubscribe = addMessageListener((data) => {
      if (settled || !predicate(data)) {
        return
      }
      settled = true
      window.clearTimeout(timer)
      unsubscribe()
      resolve(data)
    })
  })
}
