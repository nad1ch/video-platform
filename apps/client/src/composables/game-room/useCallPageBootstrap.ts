import { onMounted, onUnmounted, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import { normalizeDisplayName } from 'call-core'

/**
 * Block 28 — bundles the three byte-identical `onMounted` side-effects
 * that both `CallPage.vue` and `GameTemplateCallPage.vue` carried at
 * the call-page entry point:
 *
 *   1. Auth-load IIFE — awaits `ensureAuthLoaded()` and, if the user
 *      already has a real display name AND the session's self display
 *      name is empty / the placeholder `'You'`, copies the auth name
 *      onto `session.selfDisplayName`. Then sets `callAuthReady` to
 *      true so the route watcher gates can resume.
 *
 *   2. `?callDebug=1` URL parse — reads `window.location.search` once,
 *      if the value is `'1'` or `'true'` flips
 *      `session.setCallDebugOverlay(true)`. Wrapped in `try {} catch
 *      { /* ignore *\/ }` exactly as both pages had it.
 *
 *   3. DEV-only `__CALL_DEBUG__` global — exposes `stageSize` and
 *      `orderedTiles` to the DevTools console (`globalThis.__CALL_DEBUG__`)
 *      under `import.meta.env.DEV`. The `onUnmounted` teardown
 *      `delete`s the same global, matching the inline pages 1:1.
 *
 * `callAuthReady` is page-owned: the page declares the ref before the
 * route watchers that gate on it (`[route.name, route.query.room,
 * callAuthReady.value]` with `{ immediate: true }`), and this
 * composable mutates `.value = true` once the auth-load resolves. The
 * page therefore keeps its existing declaration line; only the
 * mutation moves into the composable's onMounted IIFE.
 *
 * No store / protocol imports. `session` is duck-typed against the
 * call-core session shape so the composable does not import the
 * Pinia store directly (the page passes it in).
 */

export interface UseCallPageBootstrapSession {
  selfDisplayName: string
  setCallDebugOverlay: (v: boolean) => void
}

export interface UseCallPageBootstrapUser {
  displayName: string
}

export interface UseCallPageBootstrapOptions {
  /**
   * The Pinia session store (`useCallSessionStore()` from `storeToRefs`
   * is NOT used here — the page passes the store proxy itself so we
   * can both READ `selfDisplayName` and WRITE through it inside the
   * IIFE without piping through extra refs).
   */
  session: UseCallPageBootstrapSession
  /** Reactive user ref from `useAuth()`. May be `null` until loaded. */
  user: Ref<UseCallPageBootstrapUser | null> | ComputedRef<UseCallPageBootstrapUser | null>
  /** From `useAuth()`. Awaited once at mount. */
  ensureAuthLoaded: () => Promise<void>
  /**
   * `stageSize` from `useCallTileLayoutFlip`. Stored on
   * `globalThis.__CALL_DEBUG__` in DEV only. The composable does not
   * dereference it — it just hands the ref to the DevTools surface.
   */
  stageSize: ShallowRef<{ width: number; height: number }>
  /**
   * `orderedTiles` from `useCallTileOrdering`. Same DEV-only surface.
   */
  orderedTiles: ComputedRef<readonly { peerId: string }[]>
  /**
   * Page-owned ready flag. The composable mutates `.value = true` once
   * the auth-load IIFE resolves. The page declares this ref before any
   * route watcher that gates on it so the watcher's source can read
   * `.value` at watcher-construction time without TDZ.
   */
  callAuthReady: Ref<boolean>
}

type CallDebugGlobalContainer = {
  __CALL_DEBUG__?: {
    stageSize: UseCallPageBootstrapOptions['stageSize']
    orderedTiles: UseCallPageBootstrapOptions['orderedTiles']
  }
}

export function useCallPageBootstrap(
  options: UseCallPageBootstrapOptions,
): void {
  const { session, user, ensureAuthLoaded, stageSize, orderedTiles, callAuthReady } = options

  onMounted(() => {
    void (async () => {
      await ensureAuthLoaded()
      const authName = normalizeDisplayName(user.value?.displayName)
      const cur = normalizeDisplayName(session.selfDisplayName)
      if (authName && (!cur || cur === 'You')) {
        session.selfDisplayName = authName
      }
      callAuthReady.value = true
    })()

    try {
      const q = new URLSearchParams(window.location.search).get('callDebug')
      if (q === '1' || q === 'true') {
        session.setCallDebugOverlay(true)
      }
    } catch {
      /* ignore */
    }

    if (import.meta.env.DEV) {
      ;(globalThis as unknown as CallDebugGlobalContainer).__CALL_DEBUG__ = {
        stageSize,
        orderedTiles,
      }
    }
  })

  onUnmounted(() => {
    if (import.meta.env.DEV) {
      delete (globalThis as unknown as CallDebugGlobalContainer).__CALL_DEBUG__
    }
  })
}
