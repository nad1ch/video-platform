import { ref, watch } from 'vue';
import { normalizeDisplayName } from 'call-core';
/**
 * Block 25 — pure chat-inbound-toast composable extracted from
 * `CallPage.vue` and `GameTemplateCallPage.vue`. The two routes carried
 * this code structurally identically, differing only in the `isViewMode`
 * guard composition (Mafia ORs `mafiaViewUi` with `eatFirstViewUi`;
 * Game Template reads a single `gameRoomViewUi`). That difference is
 * isolated into the `isViewMode` input.
 *
 * Scope:
 *   - `callChatInboundToasts` queue (max 4, each TTL 3800 ms)
 *   - `dismissCallChatInboundToast` — manual close from the X button
 *   - `openChatFromInboundToast` — toast click opens the chat panel
 *   - `inCall` reset watcher (leaving the call clears the queue)
 *   - `chatOpen` sync watcher (opening the chat marks all current
 *     messages as seen so re-opening doesn't re-fire toasts)
 *   - `callChatMessages` watcher that enqueues a toast for each new
 *     inbound message (skipping self, view-mode, joining)
 *
 * The composable does not import any store / protocol. `chatOpen` is
 * the writable ref from `useCallChatPanel` that
 * `openChatFromInboundToast` toggles to `true`.
 */
const CHAT_INBOUND_TOAST_TTL_MS = 3800;
const MAX_CHAT_INBOUND_TOASTS = 4;
export function useCallChatInboundToasts(options) {
    const { isInCall, joining, isViewMode, callChatMessages, selfPeerId, chatOpen } = options;
    const callChatInboundToasts = ref([]);
    let lastSeenCallChatLineId = '';
    function dismissCallChatInboundToast(toastId) {
        callChatInboundToasts.value = callChatInboundToasts.value.filter((x) => x.toastId !== toastId);
    }
    function pushCallChatInboundToast(line) {
        const previewRaw = line.text.trim();
        const preview = previewRaw.length > 96 ? `${previewRaw.slice(0, 96)}…` : previewRaw;
        const title = normalizeDisplayName(line.displayName).trim() || '—';
        const toastId = `chat-toast-${line.id}`;
        callChatInboundToasts.value = [
            ...callChatInboundToasts.value.filter((x) => x.lineId !== line.id),
            { toastId, lineId: line.id, title, preview },
        ].slice(-MAX_CHAT_INBOUND_TOASTS);
        window.setTimeout(() => dismissCallChatInboundToast(toastId), CHAT_INBOUND_TOAST_TTL_MS);
    }
    function openChatFromInboundToast(toastId) {
        dismissCallChatInboundToast(toastId);
        chatOpen.value = true;
    }
    watch(() => isInCall.value, (inCall) => {
        if (!inCall) {
            lastSeenCallChatLineId = '';
            callChatInboundToasts.value = [];
        }
    });
    watch(chatOpen, (open) => {
        const msgs = callChatMessages.value;
        if (open && msgs.length > 0) {
            lastSeenCallChatLineId = msgs[msgs.length - 1].id;
        }
    });
    watch(callChatMessages, (msgs) => {
        if (!isInCall.value ||
            joining.value ||
            isViewMode.value ||
            msgs.length === 0) {
            return;
        }
        const last = msgs[msgs.length - 1];
        if (chatOpen.value) {
            lastSeenCallChatLineId = last.id;
            return;
        }
        if (last.id === lastSeenCallChatLineId) {
            return;
        }
        lastSeenCallChatLineId = last.id;
        const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
        if (selfId.length > 0 && last.peerId === selfId) {
            return;
        }
        pushCallChatInboundToast(last);
    }, { deep: true });
    return {
        callChatInboundToasts,
        dismissCallChatInboundToast,
        openChatFromInboundToast,
    };
}
