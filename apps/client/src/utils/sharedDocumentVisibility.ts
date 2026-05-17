/**
 * Audit Perf-C / M11: a single shared `visibilitychange` listener that fans
 * out to subscribers, instead of `<StreamVideo>` registering its own listener
 * per tile. With 8–12 cameras open, a per-tile listener creates 8–12 separate
 * document-level subscriptions all reacting to the same event — wasted
 * DOM-event dispatch per visibility flip.
 *
 * Subscribers receive a callback when `document.visibilityState` becomes
 * `'visible'`. The listener is lazily attached on the first subscription and
 * lazily detached when the last subscription is removed.
 */

type VisibilitySubscriber = () => void

const subscribers = new Set<VisibilitySubscriber>()
let attached = false
let handler: (() => void) | null = null

function attachIfNeeded(): void {
  if (attached || typeof document === 'undefined') return
  handler = (): void => {
    if (document.visibilityState !== 'visible') return
    // Snapshot to allow subscribers to detach themselves during dispatch
    // (otherwise a removal mid-iteration is well-defined for Set but
    // intentions stay clearer with a copy).
    const snapshot: VisibilitySubscriber[] = []
    for (const cb of subscribers) snapshot.push(cb)
    for (const cb of snapshot) {
      try {
        cb()
      } catch {
        /* never let one subscriber's failure swallow the others */
      }
    }
  }
  document.addEventListener('visibilitychange', handler)
  attached = true
}

function detachIfEmpty(): void {
  if (!attached || subscribers.size > 0) return
  if (handler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handler)
  }
  handler = null
  attached = false
}

export function onDocumentBecameVisible(cb: VisibilitySubscriber): () => void {
  subscribers.add(cb)
  attachIfNeeded()
  return (): void => {
    subscribers.delete(cb)
    detachIfEmpty()
  }
}
