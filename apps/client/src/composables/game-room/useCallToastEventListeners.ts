import { onMounted, onUnmounted, type Ref } from 'vue'
import type { CallToast, CallToastKind } from './useCallPresenceToasts'

/**
 * Block 27 — registers window event listeners that push prefixed toasts
 * onto the shared `callToasts` ring. Extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`, which carried three / two near-identical
 * handler functions plus matching `window.addEventListener` /
 * `removeEventListener` pairs:
 *
 *   - Mafia OBS-URL-copied  (`mafia-obs-…`,    text from i18n)
 *   - EatFirst OBS-URL-copied (`eat-first-obs-…`, route-gated)
 *   - Mafia / GameRoom Settings (`mafia-settings-…` / `gameroom-settings-…`,
 *     kind `'leave'`, optional `event.detail.text` override)
 *   - GameRoom OBS-URL-copied (`gameroom-obs-…`)
 *
 * Each handler followed an identical "push toast with route-specific id
 * prefix + auto-dismiss after 4200 ms" pattern. The id-prefix shape
 * (`<prefix>-<Date.now()>`) is preserved 1:1 from the pages because it
 * is the existing observable shape (Block 25 intentionally did NOT route
 * these through `pushCallToast`'s random-suffix id).
 *
 * The composable is store-free / protocol-free. The route-specific
 * event names + i18n callbacks are supplied as inputs.
 */

const DEFAULT_TOAST_TTL_MS = 4200

export interface CallToastEventDescriptor {
  /** Window event name to listen for (e.g. `MAFIA_OBS_URL_TOAST_EVENT`). */
  eventName: string
  /**
   * Id prefix to use when constructing the toast id. Final id is
   * `${idPrefix}-${Date.now()}` — same shape both pages used inline.
   */
  idPrefix: string
  /**
   * Returns the toast text. The handler passes the raw window event;
   * the implementer can read `event.detail` for `CustomEvent` payloads
   * or fall back to a static i18n string. Returning `null` skips the
   * toast for this event firing (used for the EatFirst-only route gate).
   */
  getText: (event: Event) => string | null
  /** Toast kind. Defaults to `'join'`. Settings handlers use `'leave'`. */
  kind?: CallToastKind
  /**
   * Optional override for the auto-dismiss timeout. Defaults to 4200 ms,
   * matching the inline pages' value.
   */
  ttlMs?: number
}

export interface UseCallToastEventListenersOptions {
  /**
   * The `callToasts` ring from `useCallPresenceToasts`. The composable
   * appends new toasts to its `.value` array and schedules a filter to
   * remove them on TTL expiry — same mutation style as the inline page
   * handlers.
   */
  callToasts: Ref<CallToast[]>
  events: readonly CallToastEventDescriptor[]
}

export function useCallToastEventListeners(
  options: UseCallToastEventListenersOptions,
): void {
  const { callToasts, events } = options

  // One bound handler per descriptor so the matching `removeEventListener`
  // can pass the same function reference.
  const boundHandlers: Array<{ eventName: string; handler: (ev: Event) => void }> = []

  for (const descriptor of events) {
    const kind: CallToastKind = descriptor.kind ?? 'join'
    const ttlMs = descriptor.ttlMs ?? DEFAULT_TOAST_TTL_MS
    const handler = (event: Event): void => {
      const text = descriptor.getText(event)
      if (text == null) {
        return
      }
      const id = `${descriptor.idPrefix}-${Date.now()}`
      callToasts.value = [...callToasts.value, { id, text, kind }]
      window.setTimeout(() => {
        callToasts.value = callToasts.value.filter((x) => x.id !== id)
      }, ttlMs)
    }
    boundHandlers.push({ eventName: descriptor.eventName, handler })
  }

  onMounted(() => {
    for (const { eventName, handler } of boundHandlers) {
      window.addEventListener(eventName, handler)
    }
  })

  onUnmounted(() => {
    for (const { eventName, handler } of boundHandlers) {
      window.removeEventListener(eventName, handler)
    }
  })
}
