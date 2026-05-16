import { computed, onUnmounted, ref, shallowRef, watch } from 'vue';
import { efSnapshot } from '@/eat-first/services/eatFirstTransport';
import { createLogger } from '@/utils/logger';
const log = createLogger('eat-first:call-snapshot');
export function useEatFirstCallGameSnapshot(gameId, isStreamView) {
    const snapshot = shallowRef(null);
    const loading = ref(false);
    let pollTimer = null;
    async function refresh() {
        const gid = gameId.value.trim();
        if (!gid) {
            snapshot.value = null;
            return;
        }
        loading.value = true;
        try {
            const s = (await efSnapshot(gid));
            snapshot.value = s && typeof s === 'object' && !Array.isArray(s) ? s : null;
        }
        catch (e) {
            log.warn('eat first snapshot fetch failed', e);
            snapshot.value = null;
        }
        finally {
            loading.value = false;
        }
    }
    function stopPoll() {
        if (pollTimer != null) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }
    function startPollIfEligible() {
        if (pollTimer != null)
            return;
        if (isStreamView?.value === true)
            return;
        if (gameId.value.trim().length < 1)
            return;
        pollTimer = setInterval(() => void refresh(), 4000);
    }
    watch(() => gameId.value, () => {
        stopPoll();
        void refresh();
        // OBS / `mode=view` relies on WS `eat:table-state-sync` replay; skip the 4s REST poll.
        startPollIfEligible();
    }, { immediate: true });
    if (isStreamView != null) {
        watch(() => isStreamView.value, (next) => {
            if (next)
                stopPoll();
            else
                startPollIfEligible();
        });
    }
    onUnmounted(stopPoll);
    const room = computed(() => {
        const r = snapshot.value?.room;
        return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
    });
    const ownerUserId = computed(() => {
        const raw = room.value.ownerUserId;
        return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
    });
    const gamePhase = computed(() => String(room.value.gamePhase ?? '').trim() || '—');
    const display = computed(() => {
        const d = snapshot.value?.display;
        if (d && typeof d === 'object' && !Array.isArray(d)) {
            const o = d;
            const hostSeat = Number(o.hostDisplaySeat);
            const playerCount = Number(o.playerCount);
            if (Number.isFinite(hostSeat) && Number.isFinite(playerCount)) {
                return { hostDisplaySeat: hostSeat, playerCount };
            }
        }
        const po = room.value.playerOrder;
        if (Array.isArray(po)) {
            const n = po.filter((x) => typeof x === 'string' && String(x).trim().length > 0).length;
            return { hostDisplaySeat: n + 1, playerCount: n };
        }
        return { hostDisplaySeat: 1, playerCount: 0 };
    });
    const speakingTimer = computed(() => {
        const t = room.value.speakingTimer;
        if (typeof t === 'number' && Number.isFinite(t))
            return t;
        if (typeof t === 'string' && t.trim() !== '' && Number.isFinite(Number(t)))
            return Number(t);
        return null;
    });
    const timerRoomFields = computed(() => {
        const r = room.value;
        const startedAt = typeof r.timerStartedAt === 'string' ? r.timerStartedAt.trim() : '';
        const paused = Boolean(r.timerPaused);
        const fr = r.timerRemainingFrozen;
        let frozenRemainingSec = null;
        if (typeof fr === 'number' && Number.isFinite(fr)) {
            frozenRemainingSec = fr;
        }
        else if (typeof fr === 'string' && fr.trim() !== '' && Number.isFinite(Number(fr))) {
            frozenRemainingSec = Number(fr);
        }
        return { startedAt, paused, frozenRemainingSec };
    });
    return { snapshot, room, ownerUserId, gamePhase, display, speakingTimer, timerRoomFields, loading, refresh };
}
