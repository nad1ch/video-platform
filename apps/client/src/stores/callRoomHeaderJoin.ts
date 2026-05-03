import { defineStore } from 'pinia'
import { ref } from 'vue'


export const CALL_ROOM_DROPDOWN_HOST_ID = 'call-room-dropdown-host'

export const CALL_ROOM_POPOVER_PANEL_ID = 'call-room-popover-panel'





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
