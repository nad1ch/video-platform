import { onBeforeUnmount, ref, watch } from 'vue';
const MAFIA_SPEAKING_HINT_VISIBLE_MS = 4500;
export function useMafiaSpeakingHint(deps) {
    const { isMafiaRoute, mafiaViewUi, mafiaGameStore } = deps;
    const mafiaSpeakingOrderHintVisible = ref(false);
    let mafiaSpeakingOrderHintTimer;
    function clearSpeakingHintTimer() {
        if (mafiaSpeakingOrderHintTimer != null) {
            clearTimeout(mafiaSpeakingOrderHintTimer);
            mafiaSpeakingOrderHintTimer = undefined;
        }
    }
    watch(() => mafiaGameStore.hostInteractionMode, (mode, prev) => {
        if (!isMafiaRoute.value || mafiaViewUi.value || !mafiaGameStore.isMafiaHost) {
            return;
        }
        if (mode !== 'speaking' || prev == null || prev === 'speaking') {
            return;
        }
        mafiaSpeakingOrderHintVisible.value = true;
        clearSpeakingHintTimer();
        mafiaSpeakingOrderHintTimer = setTimeout(() => {
            mafiaSpeakingOrderHintVisible.value = false;
            mafiaSpeakingOrderHintTimer = undefined;
        }, MAFIA_SPEAKING_HINT_VISIBLE_MS);
    });
    onBeforeUnmount(() => {
        clearSpeakingHintTimer();
    });
    return {
        mafiaSpeakingOrderHintVisible,
    };
}
