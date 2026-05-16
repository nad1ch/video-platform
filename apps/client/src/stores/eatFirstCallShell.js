import { defineStore } from 'pinia';
import { ref } from 'vue';
import { remapEatFirstSpeakingQueueForSwap, swapEatFirstPlayerOrder, } from '@/eat-first/utils/eatFirstPlayerOrderSwap';
import { appendSpeakingPair, applySpeakingQueueFromSignaling as applySpeakingQueueFromSignalingShared, removeSpeakingPairAt, } from '@/utils/speakingNominationController';
/**
 * Minimal shell/header bridge for `/app/eat` call mode only.
 * Set from `EatFirstCallPage`; cleared on unmount so Mafia/header never reads stale host state.
 */
export const useEatFirstCallShellStore = defineStore('eatFirstCallShell', () => {
    const isEatFirstRoomHost = ref(false);
    const hostPeerId = ref(null);
    const currentGameId = ref('');
    const playerOrder = ref([]);
    /** Legacy seat-keyed mirror; the canonical lookup is `traitsBySlot[slotId]`. */
    const traitsBySeat = ref({});
    const revealedTraitsBySeat = ref({});
    const traitOverridesBySeat = ref({});
    /**
     * Authoritative trait list per slot id (`p1`..`p11`). Populated from the
     * Eat First snapshot polling; consumed by call-tile overlay through the
     * peer→slot map and `playerOrder` from signaling (`eat:trait-state-sync` /
     * `eat:table-state-sync`).
     */
    const traitsBySlot = ref({});
    /** Action card snapshot per slot — host sees all seated players; each player sees own tile only (call UI). */
    const actionCardBySlot = ref({});
    /**
     * Last used action card (host panel "Останньо використано"). Snapshot picks
     * the player with `activeCard.used === true` whose patch was most recently
     * persisted; pure UI hint, never authoritative game state.
     */
    const lastUsedActionCard = ref(null);
    const playerCount = ref(0);
    const connectedPlayerCount = ref(0);
    /**
     * Nomination queue: pair-encoded when even length `[by1, target1, ...]` (same as Mafia call).
     * Odd length is legacy target-only when decoding. Local-only (no server sync).
     */
    const speakingQueue = ref([]);
    /** When true, tile clicks use two-step nomination (nominator, then nominated). */
    const speakingMode = ref(false);
    /** First click in speaking mode: nominator seat; second click completes the pair. */
    const speakingNominationDraftBySeat = ref(null);
    /**
     * Host tile-click interaction mode. Mirrors the Mafia / Game Template
     * `hostInteractionMode` pattern — `'swap'` makes a tile click select-or-
     * commit a positional swap; `'idle'` lets the existing speaking-mode
     * branch handle the click. Mutually exclusive with `speakingMode` (the
     * setters enforce this — entering swap mode also turns speakingMode off
     * and vice versa).
     */
    const hostInteractionMode = ref('idle');
    /**
     * Peer id of the first tile clicked while in swap mode, waiting for a
     * second tile click to commit the swap. `null` when no selection is
     * pending. Cleared automatically on swap commit, mode change, or host
     * loss.
     */
    const hostSeatSwapSelectionPeerId = ref(null);
    /**
     * Outbound `eat:players-update` payload queued by `swapEatFirstSlotsInPlayerOrder`.
     * `CallPage` watches this ref and sends the WS frame; the existing
     * deep watcher on `speakingQueue` handles the queue rebroadcast. The
     * server's existing `handleEatFirstPlayersUpdate` validates and
     * broadcasts `eat:table-state-sync` to all peers.
     */
    const playersUpdateBroadcastPayload = ref(null);
    function clearSpeakingNominationDraft() {
        speakingNominationDraftBySeat.value = null;
    }
    /** Speaking countdown from signaling (`eat:table-state-sync`). Snapshot polling must not replace this. */
    const eatFirstCallTimerFromTableSync = ref(null);
    /**
     * Live host-selected timer preset (ms). Mirrored across all peers via
     * `eat:timer-preset-select`. `null` means "no live override; clients
     * use their local default". Survives Start/Stop so the chip returns
     * to the host's last picked idle duration after a Stop.
     */
    const selectedTimerDurationMs = ref(null);
    function setEatFirstSelectedTimerDurationMs(durationMs) {
        if (durationMs == null || !Number.isFinite(durationMs)) {
            selectedTimerDurationMs.value = null;
            return;
        }
        selectedTimerDurationMs.value = Math.floor(durationMs);
    }
    function setEatFirstCallShellHost(isHost) {
        isEatFirstRoomHost.value = isHost;
        if (!isHost) {
            speakingQueue.value = [];
            speakingMode.value = false;
            clearSpeakingNominationDraft();
            hostInteractionMode.value = 'idle';
            hostSeatSwapSelectionPeerId.value = null;
        }
    }
    function setEatFirstHostPeer(hostPeer, selfPeerId) {
        hostPeerId.value = hostPeer;
        isEatFirstRoomHost.value =
            typeof hostPeer === 'string' &&
                hostPeer.length > 0 &&
                typeof selfPeerId === 'string' &&
                selfPeerId.length > 0 &&
                hostPeer === selfPeerId;
        if (!isEatFirstRoomHost.value) {
            speakingQueue.value = [];
            speakingMode.value = false;
            clearSpeakingNominationDraft();
            hostInteractionMode.value = 'idle';
            hostSeatSwapSelectionPeerId.value = null;
        }
    }
    function setGameId(id) {
        const next = typeof id === 'string' ? id.trim() : '';
        if (next !== currentGameId.value) {
            eatFirstCallTimerFromTableSync.value = null;
        }
        currentGameId.value = next;
    }
    function setEatFirstCallTimerFromTableSync(next) {
        eatFirstCallTimerFromTableSync.value = next;
    }
    function setPlayerOrder(order) {
        playerOrder.value = order;
    }
    function setTraitsBySeat(next) {
        traitsBySeat.value = next;
    }
    function setTraitsBySlot(next) {
        traitsBySlot.value = next;
    }
    function setActionCardBySlot(next) {
        actionCardBySlot.value = next;
    }
    /**
     * Patch a single slot's action card without dropping cards we already
     * hydrated for other slots — used by the `eat:action-card-rerolled`
     * signaling fast-path so the host UI updates before the next snapshot poll.
     */
    function setActionCardForSlot(slotId, card) {
        const sid = String(slotId ?? '').trim();
        if (sid.length < 1)
            return;
        actionCardBySlot.value = { ...actionCardBySlot.value, [sid]: card };
    }
    function setLastUsedActionCard(next) {
        lastUsedActionCard.value = next;
    }
    function setRevealedTraitsBySeat(next) {
        revealedTraitsBySeat.value = next;
    }
    function setTraitOverridesBySeat(next) {
        traitOverridesBySeat.value = next;
    }
    function markTraitRevealedBySeat(seat, traitKey) {
        if (!Number.isFinite(seat) || seat < 1 || typeof traitKey !== 'string' || traitKey.trim().length < 1)
            return;
        const key = traitKey.trim();
        const prevSeat = revealedTraitsBySeat.value[seat] ?? {};
        revealedTraitsBySeat.value = {
            ...revealedTraitsBySeat.value,
            [seat]: { ...prevSeat, [key]: true },
        };
    }
    function setTraitOverrideBySeat(seat, traitKey, value) {
        if (!Number.isFinite(seat) || seat < 1 || typeof traitKey !== 'string' || traitKey.trim().length < 1)
            return;
        const key = traitKey.trim();
        const val = typeof value === 'string' ? value.trim() : '';
        if (!val)
            return;
        const prevSeat = traitOverridesBySeat.value[seat] ?? {};
        traitOverridesBySeat.value = {
            ...traitOverridesBySeat.value,
            [seat]: { ...prevSeat, [key]: val },
        };
    }
    function setPlayerCount(count) {
        playerCount.value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    }
    function setConnectedPlayerCount(count) {
        connectedPlayerCount.value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    }
    function toggleSpeakingMode() {
        // Host-gated for parity with Mafia / Game Template. The bar adapter
        // already hides tools for non-host, so this is defense-in-depth; it
        // also matches `setHostInteractionMode` and every other speaking-queue
        // action in the file.
        if (!isEatFirstRoomHost.value)
            return;
        speakingMode.value = !speakingMode.value;
        if (!speakingMode.value) {
            clearSpeakingNominationDraft();
            return;
        }
        // Mutual exclusion with swap mode — Mafia / Game Template clear the
        // alternative mode through their `setHostInteractionMode` setter.
        hostInteractionMode.value = 'idle';
        hostSeatSwapSelectionPeerId.value = null;
    }
    /**
     * Set the host tile-click interaction mode. Entering `'swap'` exits
     * speaking mode (mutually exclusive). Leaving `'swap'` clears any
     * pending swap selection. No-op for non-host.
     */
    function setHostInteractionMode(mode) {
        if (!isEatFirstRoomHost.value)
            return;
        hostInteractionMode.value = mode;
        if (mode === 'swap') {
            speakingMode.value = false;
            clearSpeakingNominationDraft();
        }
        else {
            hostSeatSwapSelectionPeerId.value = null;
        }
    }
    /**
     * Record / clear the first-click selection in swap mode. No-op for
     * non-host; `null` clears the pending selection.
     */
    function setHostSeatSwapSelectionPeerId(peerId) {
        if (!isEatFirstRoomHost.value)
            return;
        hostSeatSwapSelectionPeerId.value = peerId;
    }
    function clearPlayersUpdateBroadcastPayload() {
        playersUpdateBroadcastPayload.value = null;
    }
    /**
     * Positional player swap (Choice A — Mafia / Game Template parity):
     * swap the two slots' POSITIONS in `playerOrder` and remap the
     * speaking-queue 1-based seat numbers locally. `slotByPeer`, `traitsBySlot`,
     * `actionCardBySlot` are untouched — players keep their slot-bound
     * traits and cards; only the visual order changes.
     *
     * Queues `playersUpdateBroadcastPayload` for the outbound `eat:players-update`
     * frame (CallPage owns the WS send). The existing deep watcher on
     * `speakingQueue` rebroadcasts via `eat:speaking-queue-update`. Inbound
     * `eat:table-state-sync` arrives shortly after and is idempotent on the
     * host (sets `playerOrder` to the same value).
     *
     * Always clears `hostSeatSwapSelectionPeerId` so the host can start a
     * fresh selection cycle. Leaves `hostInteractionMode` as-is so the
     * host can perform consecutive swaps without re-clicking the button.
     * No-op for non-host or identical / unknown slot ids.
     */
    function swapEatFirstSlotsInPlayerOrder(slotA, slotB) {
        if (!isEatFirstRoomHost.value)
            return;
        const currentOrder = playerOrder.value;
        const seatA = currentOrder.indexOf(slotA) + 1;
        const seatB = currentOrder.indexOf(slotB) + 1;
        const next = swapEatFirstPlayerOrder(currentOrder, slotA, slotB);
        if (next === currentOrder) {
            hostSeatSwapSelectionPeerId.value = null;
            return;
        }
        playerOrder.value = [...next];
        if (seatA >= 1 && seatB >= 1) {
            const remapped = remapEatFirstSpeakingQueueForSwap(speakingQueue.value, seatA, seatB);
            if (remapped !== speakingQueue.value) {
                speakingQueue.value = [...remapped];
            }
        }
        playersUpdateBroadcastPayload.value = { playerOrder: [...next] };
        hostSeatSwapSelectionPeerId.value = null;
    }
    function setSpeakingNominationDraftBySeat(seat) {
        if (!isEatFirstRoomHost.value)
            return;
        if (seat == null) {
            clearSpeakingNominationDraft();
            return;
        }
        if (!Number.isInteger(seat) || seat < 1)
            return;
        speakingNominationDraftBySeat.value = seat;
    }
    function appendSpeakingNominationPair(by, target) {
        if (!isEatFirstRoomHost.value)
            return;
        // Delegate to the shared controller helper so Mafia / Game Template /
        // Eat First share an identical append rule (returns input ref on
        // invalid seats, preserves pair-encoded layout).
        const next = appendSpeakingPair(speakingQueue.value, by, target);
        if (next === speakingQueue.value)
            return;
        speakingQueue.value = [...next];
        clearSpeakingNominationDraft();
    }
    function removeSpeakingNominationPairAt(pairIndex) {
        if (!isEatFirstRoomHost.value)
            return;
        // Shared helper handles both canonical pair-encoded (even length) and
        // legacy target-only (odd length) cases.
        const next = removeSpeakingPairAt(speakingQueue.value, pairIndex);
        if (next === speakingQueue.value)
            return;
        speakingQueue.value = [...next];
    }
    function clearSpeakingQueue() {
        speakingQueue.value = [];
        clearSpeakingNominationDraft();
    }
    /**
     * Apply an inbound `eat:speaking-queue-update` payload via the shared
     * controller. The controller normalizes the array (integer filter,
     * odd-length truncation) and decides whether the nomination draft must be
     * cleared:
     *
     *   - host  ⇒ draft preserved (host may already be selecting the next
     *     `[by, target]` pair after their previous append fired the outbound
     *     watcher; wiping the draft here would lose the in-flight selection
     *     between rapid clicks — this is the regression fix vs the pre-share
     *     implementation, which always cleared)
     *   - non-host ⇒ draft cleared
     *
     * This call site is the sole apply path so the regression cannot recur
     * without touching this branch.
     */
    function applySpeakingQueueFromSignaling(seats) {
        const { nextQueue, shouldClearDraft } = applySpeakingQueueFromSignalingShared(seats, {
            isHost: isEatFirstRoomHost.value,
        });
        speakingQueue.value = nextQueue;
        if (shouldClearDraft)
            clearSpeakingNominationDraft();
    }
    return {
        isEatFirstRoomHost,
        hostPeerId,
        currentGameId,
        eatFirstCallTimerFromTableSync,
        selectedTimerDurationMs,
        setEatFirstSelectedTimerDurationMs,
        playerOrder,
        traitsBySeat,
        traitsBySlot,
        actionCardBySlot,
        lastUsedActionCard,
        revealedTraitsBySeat,
        traitOverridesBySeat,
        playerCount,
        connectedPlayerCount,
        speakingQueue,
        speakingMode,
        speakingNominationDraftBySeat,
        hostInteractionMode,
        hostSeatSwapSelectionPeerId,
        playersUpdateBroadcastPayload,
        setHostInteractionMode,
        setHostSeatSwapSelectionPeerId,
        swapEatFirstSlotsInPlayerOrder,
        clearPlayersUpdateBroadcastPayload,
        setEatFirstCallShellHost,
        setEatFirstHostPeer,
        setGameId,
        setEatFirstCallTimerFromTableSync,
        setPlayerOrder,
        setTraitsBySeat,
        setTraitsBySlot,
        setActionCardBySlot,
        setActionCardForSlot,
        setLastUsedActionCard,
        setRevealedTraitsBySeat,
        setTraitOverridesBySeat,
        markTraitRevealedBySeat,
        setTraitOverrideBySeat,
        setPlayerCount,
        setConnectedPlayerCount,
        toggleSpeakingMode,
        setSpeakingNominationDraftBySeat,
        appendSpeakingNominationPair,
        removeSpeakingNominationPairAt,
        clearSpeakingQueue,
        applySpeakingQueueFromSignaling,
    };
});
