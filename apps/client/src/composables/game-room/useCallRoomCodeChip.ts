import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { generateCallRoomCode } from '@/utils/callRoomUi'
import { normalizeDisplayName } from 'call-core'

/**
 * Block 25 — pure call-room-chip composable extracted from `CallPage.vue`
 * and `GameTemplateCallPage.vue`. Both routes carried this code
 * byte-equivalently except for the inlined "display the current room
 * code" function (`displayCallOrMafiaRoomCode` vs `displayCallOrGameRoomCode`)
 * and the inlined `switchToRoom` (route-specific signaling prefix).
 *
 * Scope:
 *   - `roomJoinDraft` (`v-model:room-join-draft` on `<CallRoomPopover>`)
 *   - `roomCopyFlash` (`:room-copy-flash` on `<CallRoomPopover>`)
 *   - `roomCopyFlashTimer` lifetime (cleared on `onBeforeUnmount`)
 *   - `watch(roomPopoverOpen)` that syncs the draft to `displayRoomCode()`
 *     on every popover-open transition
 *   - `copyRoomToClipboard` — Clipboard API first, `document.execCommand`
 *     fallback, then a 1600 ms flash
 *   - `onGenerateNewRoom` — generates a fresh code and switches to it
 *   - `submitRoomDraft` — normalizes the draft and switches to it
 *
 * Route-specific bits (kept as inputs, never imported by the composable):
 *   - `displayRoomCode` → page-side normalizer (Mafia strips
 *     `mafia:` prefix; Game Template strips `gameroom:` prefix)
 *   - `switchToRoom` → page-side route + signaling-prefix logic (Mafia
 *     uses `mafiaSignalingRoomId`; Game Template uses
 *     `gameRoomSignalingRoomId`)
 *   - `roomPopoverOpen` → `storeToRefs(useCallRoomHeaderJoinStore())`
 *     ref from the page
 *
 * No store / protocol imports. `generateCallRoomCode` is a pure util,
 * `normalizeDisplayName` is a pure call-core string helper — both are
 * route-agnostic.
 */

export interface UseCallRoomCodeChipOptions {
  /**
   * Reactive flag for the call-room popover. The composable watches it
   * to sync the draft on open. The page provides it via
   * `storeToRefs(useCallRoomHeaderJoinStore())`.
   */
  roomPopoverOpen: Ref<boolean>
  /**
   * Returns the current room code as the user reads it (e.g. with
   * route-specific prefix stripped). Called every time the popover
   * opens and inside `copyRoomToClipboard` as the fallback when the
   * draft is empty.
   */
  displayRoomCode: () => string
  /**
   * Route-specific room switcher. Owned by the page because it has to
   * apply the route-specific signaling prefix and call `router.replace`
   * with the route-specific name. Called from `onGenerateNewRoom` and
   * `submitRoomDraft`.
   */
  switchToRoom: (nextRaw: string, opts?: { fromRoute?: boolean }) => Promise<void>
}

export interface UseCallRoomCodeChipApi {
  roomJoinDraft: Ref<string>
  roomCopyFlash: Ref<boolean>
  copyRoomToClipboard: () => Promise<void>
  onGenerateNewRoom: () => Promise<void>
  submitRoomDraft: () => void
}

export function useCallRoomCodeChip(
  options: UseCallRoomCodeChipOptions,
): UseCallRoomCodeChipApi {
  const { roomPopoverOpen, displayRoomCode, switchToRoom } = options

  const roomJoinDraft = ref('')
  const roomCopyFlash = ref(false)
  let roomCopyFlashTimer: ReturnType<typeof setTimeout> | null = null

  watch(roomPopoverOpen, (open) => {
    if (open) {
      roomJoinDraft.value = displayRoomCode()
    }
  })

  async function copyRoomToClipboard(): Promise<void> {
    const text = normalizeDisplayName(roomJoinDraft.value) || displayRoomCode()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        return
      }
    }
    if (roomCopyFlashTimer !== null) {
      clearTimeout(roomCopyFlashTimer)
    }
    roomCopyFlash.value = true
    roomCopyFlashTimer = setTimeout(() => {
      roomCopyFlashTimer = null
      roomCopyFlash.value = false
    }, 1600)
  }

  async function onGenerateNewRoom(): Promise<void> {
    const nextRoom = generateCallRoomCode()
    roomJoinDraft.value = nextRoom
    await switchToRoom(nextRoom)
  }

  function submitRoomDraft(): void {
    const id = normalizeDisplayName(roomJoinDraft.value)
    if (!id) {
      return
    }
    void switchToRoom(id)
  }

  onBeforeUnmount(() => {
    if (roomCopyFlashTimer !== null) {
      clearTimeout(roomCopyFlashTimer)
      roomCopyFlashTimer = null
    }
  })

  return {
    roomJoinDraft,
    roomCopyFlash,
    copyRoomToClipboard,
    onGenerateNewRoom,
    submitRoomDraft,
  }
}
