import { computed } from 'vue';
import { MafiaWs } from '@/composables/mafiaWsProtocol';
import { nominationTargetSeatsFromSpeakingFlat } from '@/utils/speakingNominationQueue';
import { decideSpeakingTileClick } from '@/utils/speakingNominationController';
const MAFIA_FORCE_CAMERA_OFF_SIGNAL = MafiaWs.forceCameraOff;
const MAFIA_FORCE_MUTE_ALL_SIGNAL = MafiaWs.forceMuteAll;
export function useMafiaCallHostUi(deps) {
    const { isMafiaRoute, mafiaViewUi, selfPeerId, mafiaGameStore, mafiaNumberByPeer, sendSignalingMessage, pushCallToast, t, } = deps;
    // ---- Host-side seat-highlight computeds (drive the tile-wrap class bindings) ----
    const mafiaHostNightActionSeatSet = computed(() => {
        const a = mafiaGameStore.nightActions;
        const s = new Set();
        for (const x of [a.mafia, a.doctor, a.sheriff, a.don]) {
            if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
                s.add(x);
            }
        }
        return s;
    });
    const mafiaHostSpeakingNominationTargetSeatSet = computed(() => nominationTargetSeatsFromSpeakingFlat(mafiaGameStore.speakingQueue));
    function isMafiaHostNightActionSeat(seat) {
        if (seat == null) {
            return false;
        }
        return mafiaHostNightActionSeatSet.value.has(seat);
    }
    function isMafiaHostSpeakingNominationUiSeat(seat) {
        if (seat == null) {
            return false;
        }
        return mafiaHostSpeakingNominationTargetSeatSet.value.has(seat);
    }
    // ---- Thin outbound handlers ----
    function onMafiaToggleLifeFromTile(peerId) {
        if (typeof peerId !== 'string' || peerId.length < 1) {
            return;
        }
        mafiaGameStore.hostToggleMafiaPlayerLife(peerId);
    }
    function onMafiaForceCameraOffFromTile(peerId) {
        if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
            return;
        }
        if (typeof peerId !== 'string' || peerId.length < 1 || peerId === selfPeerId.value) {
            return;
        }
        sendSignalingMessage({ type: MAFIA_FORCE_CAMERA_OFF_SIGNAL, payload: { peerId } });
    }
    function onMafiaForceMuteAll(muted) {
        if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
            return;
        }
        sendSignalingMessage({ type: MAFIA_FORCE_MUTE_ALL_SIGNAL, payload: { muted } });
    }
    function onMafiaSetEliminationBackground(payload) {
        mafiaGameStore.setPeerEliminationBackground(payload.peerId, payload.background);
    }
    // ---- Mafia tile-click router (swap / speaking / night-action) ----
    //
    // Mirrors the Mafia tail of the original `onMafiaHostTileClick` in CallPage,
    // line-for-line. The EatFirst branch of that function stays in CallPage; it
    // is not the Mafia composable's concern.
    function handleMafiaHostTileClick(ev, row) {
        if (mafiaViewUi.value) {
            return;
        }
        if (!isMafiaRoute.value || !mafiaGameStore.isMafiaHost) {
            return;
        }
        const clickTarget = ev.target;
        if (clickTarget instanceof Element) {
            if (clickTarget.closest('button, input, textarea, a, [data-no-mafia-tile-host]')) {
                return;
            }
            if (clickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
                return;
            }
        }
        if (mafiaGameStore.hostInteractionMode === 'swap') {
            const pid = row.tile.peerId;
            const sel = mafiaGameStore.hostSeatSwapSelectionPeerId;
            if (sel == null) {
                mafiaGameStore.setSeatSwapSelectionPeerId(pid);
            }
            else if (sel === pid) {
                mafiaGameStore.setSeatSwapSelectionPeerId(null);
            }
            else {
                mafiaGameStore.swapSeatsByPeerId(sel, pid);
            }
            ev.stopPropagation();
            return;
        }
        const seat = mafiaNumberByPeer.value.get(row.tile.peerId);
        if (seat == null) {
            return;
        }
        if (mafiaGameStore.hostInteractionMode === 'speaking') {
            // Route the tile click through the shared speaking-nomination state
            // machine. The controller was extracted FROM this branch — it owns
            // the exact same first-click / same-seat / second-click / duplicate-by
            // / duplicate-target rules. Mafia is the behavioral source of truth;
            // this is a pure refactor with zero observable change.
            const intent = decideSpeakingTileClick({
                mode: 'speaking',
                seat,
                draft: mafiaGameStore.speakingNominationDraftBySeat,
                queue: mafiaGameStore.speakingQueue,
            });
            switch (intent.kind) {
                case 'set-draft':
                    mafiaGameStore.setSpeakingNominationDraftBySeat(intent.seat);
                    break;
                case 'clear-draft':
                    mafiaGameStore.setSpeakingNominationDraftBySeat(null);
                    break;
                case 'append-pair':
                    mafiaGameStore.appendSpeakingNominationPair(intent.by, intent.target);
                    break;
                case 'reject-duplicate-by':
                    pushCallToast(t('mafiaPage.speakingByAlreadyNominatedToast', {
                        by: intent.bySeat,
                        target: intent.existingTarget,
                    }), 'leave');
                    if (intent.clearDraftAfter) {
                        mafiaGameStore.setSpeakingNominationDraftBySeat(null);
                    }
                    break;
                case 'reject-duplicate-target':
                    pushCallToast(t('mafiaPage.speakingTargetAlreadyNominatedToast', {
                        target: intent.targetSeat,
                        by: intent.existingBySeat ?? '?',
                    }), 'leave');
                    break;
                case 'ignore':
                default:
                    break;
            }
        }
        else {
            mafiaGameStore.assignOrClearNightActionForActiveRole(seat);
        }
        ev.stopPropagation();
    }
    return {
        isMafiaHostNightActionSeat,
        isMafiaHostSpeakingNominationUiSeat,
        onMafiaToggleLifeFromTile,
        onMafiaForceCameraOffFromTile,
        onMafiaForceMuteAll,
        onMafiaSetEliminationBackground,
        handleMafiaHostTileClick,
    };
}
