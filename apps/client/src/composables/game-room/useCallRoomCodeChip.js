import { onBeforeUnmount, ref, watch } from 'vue';
import { generateCallRoomCode } from '@/utils/callRoomUi';
import { normalizeDisplayName } from 'call-core';
export function useCallRoomCodeChip(options) {
    const { roomPopoverOpen, displayRoomCode, switchToRoom } = options;
    const roomJoinDraft = ref('');
    const roomCopyFlash = ref(false);
    let roomCopyFlashTimer = null;
    watch(roomPopoverOpen, (open) => {
        if (open) {
            roomJoinDraft.value = displayRoomCode();
        }
    });
    async function copyRoomToClipboard() {
        const text = normalizeDisplayName(roomJoinDraft.value) || displayRoomCode();
        try {
            await navigator.clipboard.writeText(text);
        }
        catch {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            catch {
                return;
            }
        }
        if (roomCopyFlashTimer !== null) {
            clearTimeout(roomCopyFlashTimer);
        }
        roomCopyFlash.value = true;
        roomCopyFlashTimer = setTimeout(() => {
            roomCopyFlashTimer = null;
            roomCopyFlash.value = false;
        }, 1600);
    }
    async function onGenerateNewRoom() {
        const nextRoom = generateCallRoomCode();
        roomJoinDraft.value = nextRoom;
        await switchToRoom(nextRoom);
    }
    function submitRoomDraft() {
        const id = normalizeDisplayName(roomJoinDraft.value);
        if (!id) {
            return;
        }
        void switchToRoom(id);
    }
    onBeforeUnmount(() => {
        if (roomCopyFlashTimer !== null) {
            clearTimeout(roomCopyFlashTimer);
            roomCopyFlashTimer = null;
        }
    });
    return {
        roomJoinDraft,
        roomCopyFlash,
        copyRoomToClipboard,
        onGenerateNewRoom,
        submitRoomDraft,
    };
}
