import { onBeforeUnmount, ref, watch } from 'vue';
const GAME_ROOM_SPEAKING_HINT_VISIBLE_MS = 4500;
export function useGameRoomSpeakingHint(deps) {
    const { isGameRoomRoute, viewUi, gameStore } = deps;
    const speakingOrderHintVisible = ref(false);
    let speakingOrderHintTimer;
    function clearSpeakingHintTimer() {
        if (speakingOrderHintTimer != null) {
            clearTimeout(speakingOrderHintTimer);
            speakingOrderHintTimer = undefined;
        }
    }
    watch(() => gameStore.hostInteractionMode, (mode, prev) => {
        if (!isGameRoomRoute.value || viewUi.value || !gameStore.isGameRoomHost) {
            return;
        }
        if (mode !== 'speaking' || prev == null || prev === 'speaking') {
            return;
        }
        speakingOrderHintVisible.value = true;
        clearSpeakingHintTimer();
        speakingOrderHintTimer = setTimeout(() => {
            speakingOrderHintVisible.value = false;
            speakingOrderHintTimer = undefined;
        }, GAME_ROOM_SPEAKING_HINT_VISIBLE_MS);
    });
    onBeforeUnmount(() => {
        clearSpeakingHintTimer();
    });
    return {
        speakingOrderHintVisible,
    };
}
