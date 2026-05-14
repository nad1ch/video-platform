import { ref, watch, type Ref } from 'vue'

/**
 * Block 24 — pure call-toast stack composable extracted from `CallPage.vue`
 * and `GameTemplateCallPage.vue`. The core toast stack (`callToasts`,
 * `pushCallToast`, the auto-dismiss timer) and the presence-toast watcher
 * (join/leave) were byte-identical between both pages.
 *
 * Scope (intentionally narrow):
 *   - the `callToasts` ref + `pushCallToast` enqueuer
 *   - the presence-toast watcher that converts the latest unseen
 *     `callPresenceMessages` entry into a `callPage.presenceJoined` /
 *     `callPage.presenceLeft` toast.
 *
 * Out of scope (kept in each page):
 *   - route-specific OBS/Settings toast event handlers
 *     (`onMafiaObsUrlCopiedToast`, `onEatFirstObsUrlCopiedToast`,
 *     `onMafiaSettingsToast`, `onGameRoomObsUrlCopiedToast`,
 *     `onGameRoomSettingsToast`). Those still push directly into
 *     `callToasts.value` because their `id` prefix (`mafia-obs-…`,
 *     `eat-first-obs-…`, etc.) is part of the existing behavior the user
 *     asked us to preserve verbatim.
 *
 * No store / protocol imports. The page hands in:
 *   - `callPresenceMessages` — `useCallOrchestrator` ref
 *   - a `t(key, params)` translator — pages already have `useI18n`
 */

export type CallToastKind = 'join' | 'leave'

export interface CallToast {
  id: string
  text: string
  kind: CallToastKind
}

export interface CallPresenceMessage {
  id: string
  displayName: string
  kind: CallToastKind
}

export interface UseCallPresenceToastsOptions {
  callPresenceMessages: Ref<readonly CallPresenceMessage[]>
  t: (key: string, params?: Record<string, unknown>) => string
}

export interface UseCallPresenceToastsApi {
  callToasts: Ref<CallToast[]>
  pushCallToast: (text: string, kind?: CallToastKind, ttlMs?: number) => void
}

export function useCallPresenceToasts(
  options: UseCallPresenceToastsOptions,
): UseCallPresenceToastsApi {
  const { callPresenceMessages, t } = options

  const callToasts = ref<CallToast[]>([])
  let lastPresenceToastSourceId = ''

  function pushCallToast(text: string, kind: CallToastKind = 'join', ttlMs = 4200): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    callToasts.value = [...callToasts.value, { id, text, kind }]
    window.setTimeout(() => {
      callToasts.value = callToasts.value.filter((x) => x.id !== id)
    }, ttlMs)
  }

  watch(
    () => callPresenceMessages.value[callPresenceMessages.value.length - 1]?.id,
    () => {
      const msgs = callPresenceMessages.value
      const last = msgs[msgs.length - 1]
      if (!last || last.id === lastPresenceToastSourceId) {
        return
      }
      lastPresenceToastSourceId = last.id

      const name = last.displayName
      const text =
        last.kind === 'join'
          ? t('callPage.presenceJoined', { name })
          : t('callPage.presenceLeft', { name })
      const id = `toast-${last.id}`
      callToasts.value = [...callToasts.value, { id, text, kind: last.kind }]
      window.setTimeout(() => {
        callToasts.value = callToasts.value.filter((x) => x.id !== id)
      }, 4200)
    },
  )

  return { callToasts, pushCallToast }
}
