import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Anchor id in `AppShellLayout` — CallPage teleports the room popover here. */
export const CALL_ROOM_DROPDOWN_HOST_ID = 'call-room-dropdown-host'

export const CALL_ROOM_POPOVER_PANEL_ID = 'call-room-popover-panel'

/**
 * Room popover open state for the shell header button on `/app/call`.
 * Reset on CallPage unmount.
 */
export const useCallRoomHeaderJoinStore = defineStore('callRoomHeaderJoin', () => {
  const roomPopoverOpen = ref(false)

  function toggleRoomPopover(): void {
    roomPopoverOpen.value = !roomPopoverOpen.value
  }

  function closeRoomPopover(): void {
    roomPopoverOpen.value = false
  }

  function reset(): void {
    roomPopoverOpen.value = false
  }

  return {
    roomPopoverOpen,
    toggleRoomPopover,
    closeRoomPopover,
    reset,
  }
})
