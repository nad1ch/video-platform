import { computed } from 'vue';
import { GameRoomWs } from '@/composables/gameRoomWsProtocol';
import { nominationTargetSeatsFromSpeakingFlat } from '@/utils/speakingNominationQueue';
import { decideSpeakingTileClick } from '@/utils/speakingNominationController';
const FORCE_CAMERA_OFF_SIGNAL = GameRoomWs.forceCameraOff;
const FORCE_MUTE_ALL_SIGNAL = GameRoomWs.forceMuteAll;
export function useGameRoomCallHostUi(deps) {
    const { isGameRoomRoute, viewUi, selfPeerId, gameStore, seatNumberByPeer, sendSignalingMessage, pushCallToast, t, } = deps;
    // ---- Host-side seat-highlight ------------------------------------------
    const hostSpeakingNominationTargetSeatSet = computed(() => nominationTargetSeatsFromSpeakingFlat(gameStore.speakingQueue));
    function isHostSpeakingNominationUiSeat(seat) {
        if (seat == null) {
            return false;
        }
        return hostSpeakingNominationTargetSeatSet.value.has(seat);
    }
    // ---- Thin outbound handlers --------------------------------------------
    function onToggleLifeFromTile(peerId) {
        if (typeof peerId !== 'string' || peerId.length < 1) {
            return;
        }
        gameStore.hostToggleGameRoomPlayerLife(peerId);
    }
    function onForceCameraOffFromTile(peerId) {
        if (!isGameRoomRoute.value || !gameStore.isGameRoomHost) {
            return;
        }
        if (typeof peerId !== 'string' || peerId.length < 1 || peerId === selfPeerId.value) {
            return;
        }
        sendSignalingMessage({ type: FORCE_CAMERA_OFF_SIGNAL, payload: { peerId } });
    }
    function onForceMuteAll(muted) {
        if (!isGameRoomRoute.value || !gameStore.isGameRoomHost) {
            return;
        }
        sendSignalingMessage({ type: FORCE_MUTE_ALL_SIGNAL, payload: { muted } });
    }
    // ---- Host tile-click router (swap / speaking) ---------------------------
    //
    // Mafia's `night` branch (`mafiaGameStore.assignOrClearNightActionForActiveRole`)
    // is intentionally NOT mirrored here — roles + night actions are Mafia-only.
    // For any non-swap, non-speaking mode the click is a no-op; future games
    // can layer their own per-mode click semantics on top of this composable
    // by exposing a `defaultModeHandler` dep in a follow-up phase.
    function handleHostTileClick(ev, row) {
        if (viewUi.value) {
            return;
        }
        if (!isGameRoomRoute.value || !gameStore.isGameRoomHost) {
            return;
        }
        const clickTarget = ev.target;
        if (clickTarget instanceof Element) {
            if (clickTarget.closest('button, input, textarea, a, [data-no-game-room-tile-host]')) {
                return;
            }
            if (clickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
                return;
            }
        }
        if (gameStore.hostInteractionMode === 'swap') {
            const pid = row.tile.peerId;
            const sel = gameStore.hostSeatSwapSelectionPeerId;
            if (sel == null) {
                gameStore.setSeatSwapSelectionPeerId(pid);
            }
            else if (sel === pid) {
                gameStore.setSeatSwapSelectionPeerId(null);
            }
            else {
                gameStore.swapSeatsByPeerId(sel, pid);
            }
            ev.stopPropagation();
            return;
        }
        const seat = seatNumberByPeer.value.get(row.tile.peerId);
        if (seat == null) {
            return;
        }
        if (gameStore.hostInteractionMode === 'speaking') {
            // Route the tile click through the shared speaking-nomination state
            // machine. The controller was extracted from Mafia (the behavioral
            // source of truth); Game Template's prior inline state machine was
            // a verbatim copy, so this migration is a pure refactor. The
            // `'speaking'` mode literal is hard-coded here because the enclosing
            // `if` already proved we're in speaking mode — passing the Game
            // Template mode through the controller's `'idle' | 'speaking' |
            // 'swap'` type without conversion.
            const intent = decideSpeakingTileClick({
                mode: 'speaking',
                seat,
                draft: gameStore.speakingNominationDraftBySeat,
                queue: gameStore.speakingQueue,
            });
            switch (intent.kind) {
                case 'set-draft':
                    gameStore.setSpeakingNominationDraftBySeat(intent.seat);
                    break;
                case 'clear-draft':
                    gameStore.setSpeakingNominationDraftBySeat(null);
                    break;
                case 'append-pair':
                    gameStore.appendSpeakingNominationPair(intent.by, intent.target);
                    break;
                case 'reject-duplicate-by':
                    pushCallToast(t('gameRoom.speakingByAlreadyNominatedToast', {
                        by: intent.bySeat,
                        target: intent.existingTarget,
                    }), 'leave');
                    if (intent.clearDraftAfter) {
                        gameStore.setSpeakingNominationDraftBySeat(null);
                    }
                    break;
                case 'reject-duplicate-target':
                    pushCallToast(t('gameRoom.speakingTargetAlreadyNominatedToast', {
                        target: intent.targetSeat,
                        by: intent.existingBySeat ?? '?',
                    }), 'leave');
                    break;
                case 'ignore':
                default:
                    break;
            }
        }
        // Mafia's `else { ... assignOrClearNightActionForActiveRole ... }` branch
        // is deliberately omitted. Default click is a no-op for the generic
        // game-room.
        ev.stopPropagation();
    }
    return {
        isHostSpeakingNominationUiSeat,
        onToggleLifeFromTile,
        onForceCameraOffFromTile,
        onForceMuteAll,
        handleHostTileClick,
    };
}
